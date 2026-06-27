import logging
import threading
import time
from datetime import datetime
from app.models.alert import Alert
from app import db

logger = logging.getLogger(__name__)


class CascadeService:
    """F18: Emergency contact cascade with priority escalation."""

    def __init__(self, twilio_service):
        self.twilio = twilio_service

    def fire_cascade(self, case, user, contacts: list, lat: float, lng: float,
                     address: str, tracking_url: str, nearest_station=None):
        """
        Fire emergency contact cascade in background thread.
        Contact 1 → wait 2min → Contact 2 → wait 2min → Contact 3 → Police
        """
        thread = threading.Thread(
            target=self._cascade_worker,
            args=(case, user, contacts, lat, lng, address, tracking_url, nearest_station),
            daemon=True
        )
        thread.start()
        logger.info(f"Cascade thread started for case {case.case_id}")

    def _cascade_worker(self, case, user, contacts, lat, lng, address, tracking_url, nearest_station):
        """Background worker executing the cascade."""
        from flask import current_app
        app = current_app._get_current_object()

        with app.app_context():
            try:
                sorted_contacts = sorted(contacts, key=lambda c: c.get('priority', 99))

                for i, contact in enumerate(sorted_contacts[:5]):
                    phone = contact.get('phone', '')
                    name = contact.get('name', f'Contact {i + 1}')
                    priority = i + 1

                    # Send SMS alert
                    sms_result = self.twilio.send_sos_sms(
                        to=phone,
                        user_name=user.name,
                        lat=lat,
                        lng=lng,
                        case_id=case.case_id,
                        tracking_url=tracking_url,
                    )

                    # Log alert
                    alert = Alert(
                        case_id=case.id,
                        user_id=user.id,
                        contact_phone=phone,
                        contact_name=name,
                        contact_priority=priority,
                        alert_type='sms',
                        twilio_sid=sms_result.get('sid'),
                    )
                    db.session.add(alert)
                    db.session.commit()

                    logger.info(f"Alert sent to {name} ({phone}) - Priority {priority}")

                    # After contact 3, also alert police
                    if priority >= 3 and nearest_station:
                        self._alert_police(case, user, lat, lng, tracking_url, nearest_station)

                    # Wait 2 minutes before next contact (unless last contact)
                    if i < len(sorted_contacts) - 1:
                        time.sleep(120)

                        # Check if case still active
                        from app.models.case import Case
                        updated_case = Case.query.get(case.id)
                        if not updated_case or updated_case.status != 'active':
                            logger.info(f"Case {case.case_id} no longer active, stopping cascade")
                            break

                # Final police alert if not already sent
                if nearest_station and len(sorted_contacts) < 3:
                    self._alert_police(case, user, lat, lng, tracking_url, nearest_station)

            except Exception as e:
                logger.error(f"Cascade worker error for case {case.case_id}: {e}")

    def _alert_police(self, case, user, lat, lng, tracking_url, station):
        """F19: Alert nearest police station."""
        if not station.sms_number:
            logger.warning(f"Station {station.name} has no SMS number")
            return

        result = self.twilio.send_police_alert_sms(
            to=station.sms_number,
            user_name=user.name,
            lat=lat,
            lng=lng,
            case_id=case.case_id,
            tracking_url=tracking_url,
            audio_url=case.audio_url,
        )

        alert = Alert(
            case_id=case.id,
            user_id=user.id,
            contact_phone=station.sms_number,
            contact_name=f"Police: {station.name}",
            contact_priority=99,
            alert_type='police',
            twilio_sid=result.get('sid'),
        )
        db.session.add(alert)
        db.session.commit()

        logger.info(f"Police alerted: {station.name} - SID: {result.get('sid')}")
