from app import create_app, db, socketio
from app.models.user import User
from app.models.case import Case
from app.models.alert import Alert, Hotspot
from app.models.station import PoliceStation
import os

app = create_app()


@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'User': User,
        'Case': Case,
        'Alert': Alert,
        'Hotspot': Hotspot,
        'PoliceStation': PoliceStation,
    }


def seed_police_stations():
    """Seed Andhra Pradesh police station data."""
    if PoliceStation.query.count() > 0:
        return

    stations = [
        {'name': 'Ongole Police Station', 'district': 'Prakasam', 'lat': 15.5057, 'lng': 80.0499,
         'address': 'Main Road, Ongole, Prakasam District', 'phone': '0861-2231212',
         'sms_number': '+910861223121', 'mandal': 'Ongole'},
        {'name': 'Nellore Town Police Station', 'district': 'Nellore', 'lat': 14.4426, 'lng': 79.9865,
         'address': 'Police Station Road, Nellore', 'phone': '0861-2310000',
         'sms_number': '+910861231000', 'mandal': 'Nellore'},
        {'name': 'Kurnool City Police Station', 'district': 'Kurnool', 'lat': 15.8281, 'lng': 78.0373,
         'address': 'Station Road, Kurnool', 'phone': '08518-220100',
         'sms_number': '+918518220100', 'mandal': 'Kurnool'},
        {'name': 'Guntur Police Station', 'district': 'Guntur', 'lat': 16.3067, 'lng': 80.4365,
         'address': 'Arundalpet, Guntur', 'phone': '0863-2220000',
         'sms_number': '+910863222000', 'mandal': 'Guntur'},
        {'name': 'Vijayawada Central Police Station', 'district': 'Krishna', 'lat': 16.5062, 'lng': 80.6480,
         'address': 'MG Road, Vijayawada', 'phone': '0866-2474777',
         'sms_number': '+910866247477', 'mandal': 'Vijayawada'},
        {'name': 'Visakhapatnam Police Station', 'district': 'Visakhapatnam', 'lat': 17.6868, 'lng': 83.2185,
         'address': 'Beach Road, Visakhapatnam', 'phone': '0891-2564987',
         'sms_number': '+910891256498', 'mandal': 'Vizag'},
        {'name': 'Tirupati Police Station', 'district': 'Chittoor', 'lat': 13.6288, 'lng': 79.4192,
         'address': 'TP Area, Tirupati', 'phone': '0877-2224567',
         'sms_number': '+910877222456', 'mandal': 'Tirupati'},
        {'name': 'Kadapa Police Station', 'district': 'Kadapa', 'lat': 14.4673, 'lng': 78.8242,
         'address': 'RTC Bus Stand Road, Kadapa', 'phone': '08562-242000',
         'sms_number': '+918562242000', 'mandal': 'Kadapa'},
        {'name': 'Anantapur Police Station', 'district': 'Anantapur', 'lat': 14.6819, 'lng': 77.6006,
         'address': 'Station Road, Anantapur', 'phone': '08554-272000',
         'sms_number': '+918554272000', 'mandal': 'Anantapur'},
        {'name': 'Chirala Police Station', 'district': 'Prakasam', 'lat': 15.8265, 'lng': 80.3522,
         'address': 'Main Bazaar, Chirala', 'phone': '08594-230100',
         'sms_number': '+918594230100', 'mandal': 'Chirala'},
    ]

    for s in stations:
        station = PoliceStation(**s, officer_in_charge='SI In-Charge', active=True)
        db.session.add(station)

    db.session.commit()
    print(f"Seeded {len(stations)} police stations")


def seed_demo_hotspots():
    """Seed demo hotspot data if ML model hasn't run yet."""
    if Hotspot.query.count() > 0:
        return

    from app.ml.hotspot_model import HotspotModel
    import os

    model = HotspotModel()
    data_path = os.path.join('ml', 'data', 'sample_crimes.csv')

    if os.path.exists(data_path):
        df = model.load_csv_data(data_path)
        clusters = model.run_clustering(df)
        model.save_clusters_to_db(clusters)
        print(f"Seeded {len(clusters)} crime hotspot clusters")
    else:
        print("Crime data CSV not found — run ml/generate_data.py first")


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_police_stations()
        seed_demo_hotspots()
        print("Database initialized successfully")

    socketio.run(app, host='0.0.0.0', port=5000, debug=False, use_reloader=False)
