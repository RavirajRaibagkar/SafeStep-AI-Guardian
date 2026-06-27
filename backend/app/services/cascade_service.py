import logging
import threading
import time
from datetime import datetime

logger = logging.getLogger(__name__)


class CascadeService:
    """F18: Emergency contact cascade with priority escalation."""

    def __init__(self, twilio_service):
        self.twilio = twilio_service

    def fire_cascade(self, case, user, contacts, lat, lng, address, tracking_url, nearest_station=None):
        """Fire cascade in a daemon thread — passes app reference for context."""
        from flask import current_app
        app = current_app._get_current_object()

        # Snapshot data we need (avoid SQLAlchemy detached-instance errors in thread)
        case_id = case.id
        case_id_str = case.case_id
        user_name = user.name
        user_phone = user.phone
        audio_url = case.audio_url

        station_data = None
        if nearest_station:
            station_data = {
                'id': nearest_station.id,
                'name': nearest_station.name,
                'sms_number': nearest_station.sms_number,
            }

        thread = threading.Thread(
            target=self._cascade_worker,
            args=(app, case_id, case_id_str, user_name, user_phone,
                  contacts, lat, lng, tracking_url, audio_url, station_data),
            daemon=True,
        )
        thread.start()
        logger.info(f"Cascade thread started for case {case_id_str}")

    def _cascade_worker(self, app, case_id, case_id_str, user_name, user_phone,
                        contacts, lat, lng, tracking_url, audio_url, station_data):
        """Background cascade worker — runs with pushed app context."""
        with app.app_context():
            from app import db
            from app.models.alert import Alert
            from app.models.case import Case

            try:
                sorted_contacts = sorted(contacts, key=lambda c: c.get('priority', 99))

                for i, contact in enumerate(sorted_contacts[:5]):
                    phone = contact.get('phone', '')
                    name = contact.get('name', f'Contact {i + 1}')
                    priority = i + 1

                    sms_result = self.twilio.send_sos_sms(
                        to=phone,
                        user_name=user_name,
                        lat=lat,
                        lng=lng,
                        case_id=case_id_str,
                        tracking_url=tracking_url,
                    )

                    alert = Alert(
                        case_id=case_id,
                        user_id=0,  # resolved later from case
                        contact_phone=phone,
                        contact_name=name,
                        contact_priority=priority,
                        alert_type='sms',
                        twilio_sid=sms_result.get('sid'),
                    )
                    db.session.add(alert)

                    try:
                        db.session.commit()
                    except Exception:
                        db.session.rollback()

                    logger.info(f"Alert sent to {name} ({phone}) — Priority {priority}")

                    # After contact 3, also notify police
                    if priority >= 3 and station_data:
                        self._alert_police(app, case_id, case_id_str, lat, lng,
                                           tracking_url, audio_url, station_data)

                    # Wait 2 min before next contact (check case is still active)
                    if i < len(sorted_contacts) - 1:
                        time.sleep(120)
                        try:
                            with app.app_context():
                                updated = Case.query.get(case_id)
                                if not updated or updated.status != 'active':
                                    logger.info(f"Case {case_id_str} no longer active — cascade stopped")
                                    return
                        except Exception:
                            return

                # Ensure police are always alerted
                if station_data and len(sorted_contacts) < 3:
                    self._alert_police(app, case_id, case_id_str, lat, lng,
                                       tracking_url, audio_url, station_data)

            except Exception as e:
                logger.error(f"Cascade worker error for case {case_id_str}: {e}")

    def _alert_police(self, app, case_id, case_id_str, lat, lng,
                      tracking_url, audio_url, station_data):
        """F19: Alert nearest police station via SMS."""
        sms_number = station_data.get('sms_number', '')
        if not sms_number:
            logger.warning(f"Station {station_data.get('name')} has no SMS number")
            return

        result = self.twilio.send_police_alert_sms(
            to=sms_number,
            user_name='SafeStep User',
            lat=lat,
            lng=lng,
            case_id=case_id_str,
            tracking_url=tracking_url,
            audio_url=audio_url,
        )

        try:
            with app.app_context():
                from app import db
                from app.models.alert import Alert
                from app.models.case import Case
                case = Case.query.get(case_id)
                alert = Alert(
                    case_id=case_id,
                    user_id=case.user_id if case else 0,
                    contact_phone=sms_number,
                    contact_name=f"Police: {station_data.get('name', 'Unknown')}",
                    contact_priority=99,
                    alert_type='police',
                    twilio_sid=result.get('sid'),
                )
                db.session.add(alert)
                db.session.commit()
        except Exception as e:
            logger.error(f"Failed to log police alert: {e}")

        logger.info(f"Police alerted: {station_data.get('name')} — SID: {result.get('sid')}")
