from datetime import datetime
from app import db


class Alert(db.Model):
    __tablename__ = 'alerts'

    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    contact_phone = db.Column(db.String(20))
    contact_name = db.Column(db.String(100))
    contact_priority = db.Column(db.Integer, default=1)
    alert_type = db.Column(db.String(30))  # sms, call, email, police
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    read_at = db.Column(db.DateTime)
    response_type = db.Column(db.String(30))  # acknowledged, no_response, escalated
    twilio_sid = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'case_id': self.case_id,
            'contact_phone': self.contact_phone,
            'contact_name': self.contact_name,
            'contact_priority': self.contact_priority,
            'alert_type': self.alert_type,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'response_type': self.response_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Hotspot(db.Model):
    __tablename__ = 'hotspots'

    id = db.Column(db.Integer, primary_key=True)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    radius = db.Column(db.Float, default=500.0)  # meters
    risk_score = db.Column(db.Float, default=0.5)
    crime_types = db.Column(db.JSON, default=list)
    time_risk_matrix = db.Column(db.JSON, default=list)  # 24 hourly risk scores
    cluster_id = db.Column(db.Integer)
    incident_count = db.Column(db.Integer, default=0)
    district = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'lat': self.lat,
            'lng': self.lng,
            'radius': self.radius,
            'risk_score': self.risk_score,
            'crime_types': self.crime_types or [],
            'time_risk_matrix': self.time_risk_matrix or [0.5] * 24,
            'cluster_id': self.cluster_id,
            'incident_count': self.incident_count,
            'district': self.district,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
