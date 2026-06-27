from datetime import datetime
from app import db


class PoliceStation(db.Model):
    __tablename__ = 'police_stations'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.String(500))
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    phone = db.Column(db.String(20))
    sms_number = db.Column(db.String(20))
    district = db.Column(db.String(100))
    mandal = db.Column(db.String(100))
    officer_in_charge = db.Column(db.String(100))
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    cases = db.relationship('Case', backref='nearest_station', lazy=True,
                            foreign_keys='Case.nearest_station_id')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'lat': self.lat,
            'lng': self.lng,
            'phone': self.phone,
            'sms_number': self.sms_number,
            'district': self.district,
            'mandal': self.mandal,
            'officer_in_charge': self.officer_in_charge,
            'active': self.active,
        }
