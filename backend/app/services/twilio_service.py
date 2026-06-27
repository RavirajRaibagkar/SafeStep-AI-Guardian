import os
import logging
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

logger = logging.getLogger(__name__)


class TwilioService:
    def __init__(self):
        self.account_sid = os.environ.get('TWILIO_ACCOUNT_SID', '')
        self.auth_token = os.environ.get('TWILIO_AUTH_TOKEN', '')
        self.from_number = os.environ.get('TWILIO_FROM_NUMBER', '')
        self.client = None

        if self.account_sid and self.auth_token:
            try:
                self.client = Client(self.account_sid, self.auth_token)
                logger.info("Twilio client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Twilio client: {e}")

    def send_sms(self, to: str, body: str) -> dict:
        """Send SMS via Twilio. Returns message SID or error."""
        if not self.client:
            logger.warning(f"[MOCK SMS] To: {to} | Body: {body[:80]}")
            return {'sid': 'MOCK_SID', 'status': 'mock_sent', 'to': to}

        # Ensure E.164 format
        if not to.startswith('+'):
            to = f'+91{to}' if len(to) == 10 else f'+{to}'

        for attempt in range(3):
            try:
                msg = self.client.messages.create(
                    body=body,
                    from_=self.from_number,
                    to=to
                )
                logger.info(f"SMS sent to {to}: SID={msg.sid}")
                return {'sid': msg.sid, 'status': msg.status, 'to': to}
            except TwilioRestException as e:
                logger.error(f"Twilio error (attempt {attempt + 1}): {e}")
                if attempt == 2:
                    return {'error': str(e), 'to': to}

        return {'error': 'Max retries exceeded', 'to': to}

    def make_call(self, to: str, twiml_url: str = None) -> dict:
        """Initiate a voice call via Twilio."""
        if not self.client:
            logger.warning(f"[MOCK CALL] To: {to}")
            return {'sid': 'MOCK_CALL_SID', 'status': 'mock_initiated'}

        if not to.startswith('+'):
            to = f'+91{to}' if len(to) == 10 else f'+{to}'

        twiml = twiml_url or 'http://demo.twilio.com/docs/voice.xml'

        for attempt in range(3):
            try:
                call = self.client.calls.create(
                    to=to,
                    from_=self.from_number,
                    url=twiml
                )
                return {'sid': call.sid, 'status': call.status}
            except TwilioRestException as e:
                logger.error(f"Twilio call error (attempt {attempt + 1}): {e}")
                if attempt == 2:
                    return {'error': str(e)}

        return {'error': 'Max retries exceeded'}

    def send_sos_sms(self, to: str, user_name: str, lat: float, lng: float,
                     case_id: str, tracking_url: str) -> dict:
        """Send formatted SOS alert SMS."""
        body = (
            f"🚨 SAFESTEP EMERGENCY ALERT 🚨\n"
            f"{user_name} needs immediate help!\n"
            f"📍 Location: https://maps.google.com/?q={lat},{lng}\n"
            f"🔗 Live Track: {tracking_url}\n"
            f"📋 Case: {case_id}\n"
            f"Time: {__import__('datetime').datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n"
            f"Reply SAFE if they are OK."
        )
        return self.send_sms(to, body)

    def send_police_alert_sms(self, to: str, user_name: str, lat: float, lng: float,
                               case_id: str, tracking_url: str, audio_url: str = None) -> dict:
        """Send alert SMS to police station."""
        body = (
            f"🚨 SAFESTEP POLICE ALERT\n"
            f"User: {user_name}\n"
            f"GPS: {lat:.6f}, {lng:.6f}\n"
            f"Maps: https://maps.google.com/?q={lat},{lng}\n"
            f"Track: {tracking_url}\n"
            f"Case: {case_id}\n"
            f"Audio: {audio_url or 'Uploading...'}\n"
            f"Please dispatch immediately."
        )
        return self.send_sms(to, body)

    def send_offline_sos_sms(self, contacts: list, user_name: str, lat: float, lng: float) -> list:
        """F28: Offline fallback SMS (no internet needed via SMS API)."""
        timestamp = __import__('datetime').datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
        body = (
            f"SAFESTEP ALERT: {user_name} needs help. "
            f"Last GPS: {lat},{lng}. "
            f"Time: {timestamp}. "
            f"Map: https://maps.google.com/?q={lat},{lng}"
        )
        results = []
        for contact in contacts:
            phone = contact.get('phone', '') if isinstance(contact, dict) else contact
            result = self.send_sms(phone, body)
            results.append(result)
        return results
