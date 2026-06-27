import random
import string
from datetime import datetime
from app import db


def generate_case_id():
    now = datetime.utcnow()
    suffix = ''.join(random.choices(string.digits, k=6))
    return f"SS-{now.year}-{now.month:02d}-{now.day:02d}-{suffix}"


class Case(db.Model):
    __tablename__ = 'cases'

    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.String(30), unique=True, nullable=False, default=generate_case_id)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    trigger_type = db.Column(db.String(50))  # shake, power_button, voice, keyword, manual
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime)
    status = db.Column(db.String(30), default='active')  # active, resolved, false_alarm, closed
    audio_url = db.Column(db.String(500))
    gps_trail = db.Column(db.JSON, default=list)
    fir_pdf_url = db.Column(db.String(500))
    notes = db.Column(db.Text)
    nearest_station_id = db.Column(db.Integer, db.ForeignKey('police_stations.id'))
    ai_classification = db.Column(db.String(50))  # SCREAM, CRY, NORMAL, PANIC, HELP_CALL
    confidence_score = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    alerts = db.relationship('Alert', backref='case', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'case_id': self.case_id,
            'user_id': self.user_id,
            'trigger_type': self.trigger_type,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'status': self.status,
            'audio_url': self.audio_url,
            'gps_trail': self.gps_trail or [],
            'fir_pdf_url': self.fir_pdf_url,
            'notes': self.notes,
            'ai_classification': self.ai_classification,
            'confidence_score': self.confidence_score,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
