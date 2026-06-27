"""Generate realistic sample crime data for Andhra Pradesh districts."""
import csv
import random
import os
from datetime import datetime, timedelta

# Real AP district headquarters coordinates
AP_DISTRICTS = [
    ('Prakasam', 15.3373, 79.4438),
    ('Nellore', 14.4426, 79.9865),
    ('Kurnool', 15.8281, 78.0373),
    ('Guntur', 16.3067, 80.4365),
    ('Krishna', 16.5062, 80.6480),
    ('Visakhapatnam', 17.6868, 83.2185),
    ('Vijayawada', 16.5062, 80.6480),
    ('Tirupati', 13.6288, 79.4192),
    ('Kadapa', 14.4673, 78.8242),
    ('Anantapur', 14.6819, 77.6006),
]

CRIME_TYPES = [
    'theft', 'assault', 'harassment', 'robbery', 'eve_teasing',
    'domestic_violence', 'snatching', 'burglary', 'road_crime'
]

def generate_sample_data(num_records=500):
    records = []
    base_date = datetime(2024, 1, 1)
    rng = random.Random(42)

    for i in range(num_records):
        district_name, base_lat, base_lng = rng.choice(AP_DISTRICTS)

        # Cluster crimes around specific points
        cluster_offset_lat = rng.gauss(0, 0.02)
        cluster_offset_lng = rng.gauss(0, 0.02)

        lat = round(base_lat + cluster_offset_lat, 6)
        lng = round(base_lng + cluster_offset_lng, 6)

        # Time distribution: more crimes at night
        rand_days = rng.randint(0, 365)
        incident_date = base_date + timedelta(days=rand_days)

        # Higher probability of night crimes
        if rng.random() < 0.6:
            hour = rng.choice([20, 21, 22, 23, 0, 1, 2, 3, 4, 5])
        else:
            hour = rng.randint(6, 20)

        crime_type = rng.choice(CRIME_TYPES)
        severity = rng.choice(['low', 'medium', 'high'])

        records.append({
            'id': i + 1,
            'lat': lat,
            'lng': lng,
            'district': district_name,
            'crime_type': crime_type,
            'severity': severity,
            'date': incident_date.strftime('%Y-%m-%d'),
            'hour': hour,
            'month': incident_date.month,
            'year': incident_date.year,
            'reported': rng.choice([True, True, True, False]),
        })

    return records


if __name__ == '__main__':
    records = generate_sample_data(500)
    os.makedirs('data', exist_ok=True)
    outpath = os.path.join('data', 'sample_crimes.csv')
    with open(outpath, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)
    print(f"Generated {len(records)} crime records → {outpath}")
