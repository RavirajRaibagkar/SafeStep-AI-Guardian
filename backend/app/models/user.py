import json
import bcrypt
from datetime import datetime
from app import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    emergency_contacts = db.Column(db.JSON, default=list)
    safe_zones = db.Column(db.JSON, default=list)
    settings = db.Column(db.JSON, default=dict)
    device_fingerprint = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    cases = db.relationship('Case', backref='user', lazy=True)
    alerts = db.relationship('Alert', backref='user', lazy=True)

    def set_password(self, password: str):
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )

    def get_default_settings(self):
        return {
            'biometric_lock': False,
            'stealth_mode': False,
            'checkin_interval': 60,
            'panic_phrase': 'SafeStep Help',
            'lone_walker_enabled': False,
            'data_retention_days': 90,
            'notifications_enabled': True,
            'fake_call_contact': 'Mom',
        }

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'emergency_contacts': self.emergency_contacts or [],
            'safe_zones': self.safe_zones or [],
            'settings': self.settings or self.get_default_settings(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
