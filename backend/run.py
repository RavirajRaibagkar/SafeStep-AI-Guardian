import os
import sys

# ── Ensure we're in the backend directory ────────────────────
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# ── Create necessary directories ─────────────────────────────
for d in ['uploads/audio', 'uploads/fir', 'uploads/evidence', 'reports/monthly', 'ml/data']:
    os.makedirs(d, exist_ok=True)

from app import create_app, db, socketio
from app.models.user import User
from app.models.case import Case
from app.models.alert import Alert, Hotspot
from app.models.station import PoliceStation


def seed_police_stations(app):
    with app.app_context():
        if PoliceStation.query.count() > 0:
            return
        stations = [
            dict(name='Ongole Police Station', district='Prakasam', lat=15.5057, lng=80.0499,
                 address='Main Road, Ongole', phone='0861-2231212', sms_number='+910861223121', mandal='Ongole'),
            dict(name='Nellore Town Police Station', district='Nellore', lat=14.4426, lng=79.9865,
                 address='Police Station Road, Nellore', phone='0861-2310000', sms_number='+910861231000', mandal='Nellore'),
            dict(name='Kurnool City Police Station', district='Kurnool', lat=15.8281, lng=78.0373,
                 address='Station Road, Kurnool', phone='08518-220100', sms_number='+918518220100', mandal='Kurnool'),
            dict(name='Guntur Police Station', district='Guntur', lat=16.3067, lng=80.4365,
                 address='Arundalpet, Guntur', phone='0863-2220000', sms_number='+910863222000', mandal='Guntur'),
            dict(name='Vijayawada Central Police Station', district='Krishna', lat=16.5062, lng=80.6480,
                 address='MG Road, Vijayawada', phone='0866-2474777', sms_number='+910866247477', mandal='Vijayawada'),
            dict(name='Visakhapatnam Police Station', district='Visakhapatnam', lat=17.6868, lng=83.2185,
                 address='Beach Road, Visakhapatnam', phone='0891-2564987', sms_number='+910891256498', mandal='Vizag'),
            dict(name='Tirupati Police Station', district='Chittoor', lat=13.6288, lng=79.4192,
                 address='TP Area, Tirupati', phone='0877-2224567', sms_number='+910877222456', mandal='Tirupati'),
            dict(name='Kadapa Police Station', district='Kadapa', lat=14.4673, lng=78.8242,
                 address='RTC Bus Stand Road, Kadapa', phone='08562-242000', sms_number='+918562242000', mandal='Kadapa'),
            dict(name='Anantapur Police Station', district='Anantapur', lat=14.6819, lng=77.6006,
                 address='Station Road, Anantapur', phone='08554-272000', sms_number='+918554272000', mandal='Anantapur'),
            dict(name='Chirala Police Station', district='Prakasam', lat=15.8265, lng=80.3522,
                 address='Main Bazaar, Chirala', phone='08594-230100', sms_number='+918594230100', mandal='Chirala'),
        ]
        for s in stations:
            db.session.add(PoliceStation(**s, officer_in_charge='SI In-Charge', active=True))
        db.session.commit()
        print(f"[SEED] {len(stations)} police stations added")


def seed_hotspots(app):
    """Run DBSCAN on sample crime data and seed hotspot table."""
    with app.app_context():
        if Hotspot.query.count() > 0:
            return
        data_path = os.path.join('ml', 'data', 'sample_crimes.csv')
        if not os.path.exists(data_path):
            # Generate if missing
            print("[SEED] Generating crime data...")
            import subprocess
            subprocess.run([sys.executable, os.path.join('ml', 'generate_data.py')], check=False)
        if os.path.exists(data_path):
            from app.ml.hotspot_model import HotspotModel
            model = HotspotModel()
            df = model.load_csv_data(data_path)
            clusters = model.run_clustering(df)
            model.save_clusters_to_db(clusters)
            print(f"[SEED] {len(clusters)} hotspot clusters seeded from ML model")
        else:
            print("[SEED] Could not generate crime data — hotspots skipped")


app = create_app()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("[DB] Tables created")
        seed_police_stations(app)
        seed_hotspots(app)
        print("[DB] Seeding complete")

    print("\n" + "=" * 55)
    print("  🛡️  SafeStep Backend — Y4 Prakasam Police Hackathon")
    print("=" * 55)
    print("  API:      http://localhost:5000/api")
    print("  Socket:   ws://localhost:5000")
    print("  Docs:     http://localhost:5000/api/auth/register")
    print("=" * 55 + "\n")

    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=True,
        use_reloader=False,
        allow_unsafe_werkzeug=True,
    )
