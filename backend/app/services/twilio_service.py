import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class TwilioService:
    """
    SMS and Voice cascade service.
    Falls back to console logging when Twilio credentials are not configured.
    """

    def __init__(self):
        self.account_sid = os.environ.get('TWILIO_ACCOUNT_SID', '')
        self.auth_token = os.environ.get('TWILIO_AUTH_TOKEN', '')
        self.from_number = os.environ.get('TWILIO_FROM_NUMBER', '+15005550006')
        self.enabled = bool(self.account_sid and self.auth_token and
                            not self.account_sid.startswith('ACxx'))
        if self.enabled:
            from twilio.rest import Client
            self._client = Client(self.account_sid, self.auth_token)
            logger.info("[Twilio] Live SMS enabled")
        else:
            self._client = None
            logger.warning("[Twilio] No credentials — SMS will be logged to console only")

    def _send(self, to: str, body: str) -> dict:
        """Internal: send SMS or log to console."""
        if not to:
            logger.warning("[Twilio] No recipient phone number — SMS skipped")
            return {'sid': 'MOCK_NO_NUMBER', 'status': 'skipped'}

        if self.enabled and self._client:
            try:
                msg = self._client.messages.create(
                    body=body[:1600],
                    from_=self.from_number,
                    to=to
                )
                logger.info(f"[Twilio] SMS sent to {to} — SID: {msg.sid}")
                return {'sid': msg.sid, 'status': msg.status}
            except Exception as e:
                logger.error(f"[Twilio] Failed to send SMS to {to}: {e}")
                return {'sid': None, 'status': 'failed', 'error': str(e)}
        else:
            # Console mock — useful for local dev
            mock_sid = f"MOCK_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            print(f"\n{'='*60}")
            print(f"[MOCK SMS] To: {to}")
            print(f"[MOCK SMS] Body: {body[:200]}")
            print(f"[MOCK SMS] SID: {mock_sid}")
            print(f"{'='*60}\n")
            return {'sid': mock_sid, 'status': 'mock_sent'}

    def send_sms(self, to: str, body: str) -> dict:
        return self._send(to, body)

    def send_sos_sms(self, to: str, user_name: str, lat: float, lng: float,
                     case_id: str, tracking_url: str) -> dict:
        """F18: SOS SMS to emergency contacts."""
        maps_link = f"https://maps.google.com/?q={lat},{lng}"
        body = (
            f"🚨 SAFESTEP SOS ALERT\n"
            f"{user_name} needs IMMEDIATE help!\n\n"
            f"📍 Location: {maps_link}\n"
            f"📋 Case ID: {case_id}\n"
            f"🔴 Live Track: {tracking_url}\n\n"
            f"This is an automated emergency alert."
        )
        return self._send(to, body)

    def send_police_alert_sms(self, to: str, user_name: str, lat: float, lng: float,
                              case_id: str, tracking_url: str, audio_url: str = None) -> dict:
        """F19: SOS SMS to police station."""
        maps_link = f"https://maps.google.com/?q={lat},{lng}"
        body = (
            f"🚨 SAFESTEP POLICE ALERT\n"
            f"EMERGENCY: {user_name} needs assistance\n\n"
            f"Case ID: {case_id}\n"
            f"Location: {maps_link}\n"
            f"Track: {tracking_url}\n"
        )
        if audio_url:
            body += f"Evidence: {audio_url}\n"
        return self._send(to, body)

    def send_false_alarm_sms(self, to: str, user_name: str, case_id: str) -> dict:
        body = (
            f"SafeStep: Alert Cancelled\n"
            f"{user_name} has confirmed they are safe.\n"
            f"Case {case_id} has been resolved.\n"
            f"Thank you."
        )
        return self._send(to, body)

    def send_checkin_sms(self, to: str, user_name: str, tracking_url: str) -> dict:
        """F17: Check-in escalation SMS."""
        body = (
            f"SafeStep Check-in Alert\n"
            f"{user_name} did not respond to their safety check.\n"
            f"Live location: {tracking_url}\n"
            f"Please contact them immediately."
        )
        return self._send(to, body)
