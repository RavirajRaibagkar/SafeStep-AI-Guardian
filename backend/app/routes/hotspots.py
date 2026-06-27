import json
import math
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import db
from app.models.alert import Hotspot
from app.ml.hotspot_model import HotspotModel

hotspots_bp = Blueprint('hotspots', __name__)
hotspot_model = HotspotModel()


def point_in_circle(lat, lng, center_lat, center_lng, radius_m):
    """Check if point is within radius meters of center."""
    R = 6371000
    phi1, phi2 = math.radians(lat), math.radians(center_lat)
    dphi = math.radians(center_lat - lat)
    dlambda = math.radians(center_lng - lng)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    d = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return d <= radius_m


@hotspots_bp.route('/zones', methods=['GET'])
def get_hotspot_zones():
    """F07: Return crime hotspot zones as GeoJSON."""
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius_km = request.args.get('radius', 10, type=float)

    hotspots = Hotspot.query.all()

    # Build GeoJSON FeatureCollection
    features = []
    current_hour = datetime.utcnow().hour

    for h in hotspots:
        # F08: Time-aware risk score
        time_matrix = h.time_risk_matrix or [0.5] * 24
        time_multiplier = time_matrix[current_hour] if len(time_matrix) > current_hour else 0.5
        effective_risk = min(1.0, h.risk_score * (1 + time_multiplier))

        # Color coding
        if effective_risk >= 0.7:
            color = '#FF0000'
            risk_level = 'HIGH'
        elif effective_risk >= 0.4:
            color = '#FF8C00'
            risk_level = 'MEDIUM'
        else:
            color = '#00AA00'
            risk_level = 'LOW'

        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [h.lng, h.lat]
            },
            'properties': {
                'id': h.id,
                'risk_score': round(effective_risk, 3),
                'base_risk': h.risk_score,
                'risk_level': risk_level,
                'color': color,
                'radius': h.radius,
                'crime_types': h.crime_types or [],
                'incident_count': h.incident_count,
                'district': h.district,
                'time_multiplier': round(time_multiplier, 3),
                'current_hour': current_hour,
            }
        }
        features.append(feature)

    return jsonify({
        'type': 'FeatureCollection',
        'features': features,
        'generated_at': datetime.utcnow().isoformat(),
        'count': len(features),
    }), 200


@hotspots_bp.route('/route-score', methods=['GET'])
@jwt_required()
def score_route():
    """F09: Score a route against crime hotspot polygons."""
    waypoints_str = request.args.get('waypoints', '')
    if not waypoints_str:
        return jsonify({'error': 'waypoints parameter required as lat,lng|lat,lng...'}), 400

    try:
        waypoints = []
        for wp in waypoints_str.split('|'):
            parts = wp.split(',')
            waypoints.append({'lat': float(parts[0]), 'lng': float(parts[1])})
    except Exception:
        return jsonify({'error': 'Invalid waypoints format'}), 400

    hotspots = Hotspot.query.all()
    current_hour = datetime.utcnow().hour

    total_risk = 0.0
    hotspot_hits = []

    for wp in waypoints:
        for h in hotspots:
            if point_in_circle(wp['lat'], wp['lng'], h.lat, h.lng, h.radius):
                time_matrix = h.time_risk_matrix or [0.5] * 24
                time_mult = time_matrix[current_hour] if len(time_matrix) > current_hour else 0.5
                effective_risk = min(1.0, h.risk_score * (1 + time_mult))
                total_risk += effective_risk
                hotspot_hits.append({
                    'hotspot_id': h.id,
                    'risk_score': round(effective_risk, 3),
                    'waypoint': wp,
                })

    avg_risk = total_risk / len(waypoints) if waypoints else 0
    safety_score = max(0, 100 - int(avg_risk * 100))

    return jsonify({
        'safety_score': safety_score,
        'risk_score': round(avg_risk, 3),
        'hotspot_intersections': len(hotspot_hits),
        'hotspot_hits': hotspot_hits[:10],
        'label': 'SAFE' if safety_score > 70 else ('CAUTION' if safety_score > 40 else 'DANGER'),
    }), 200


@hotspots_bp.route('/nearby', methods=['GET'])
@jwt_required()
def get_nearby_hotspots():
    """Get hotspots near user's current location."""
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius_km = request.args.get('radius', 2, type=float)

    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng required'}), 400

    hotspots = Hotspot.query.all()
    current_hour = datetime.utcnow().hour
    nearby = []

    for h in hotspots:
        R = 6371
        phi1, phi2 = math.radians(lat), math.radians(h.lat)
        dphi = math.radians(h.lat - lat)
        dlambda = math.radians(h.lng - lng)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        dist_km = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        if dist_km <= radius_km:
            time_matrix = h.time_risk_matrix or [0.5] * 24
            time_mult = time_matrix[current_hour] if len(time_matrix) > current_hour else 0.5
            effective_risk = min(1.0, h.risk_score * (1 + time_mult))
            d = h.to_dict()
            d['distance_km'] = round(dist_km, 3)
            d['effective_risk'] = round(effective_risk, 3)
            nearby.append(d)

    nearby.sort(key=lambda x: x['effective_risk'], reverse=True)

    return jsonify({
        'hotspots': nearby,
        'count': len(nearby),
        'user_at_risk': any(h['effective_risk'] > 0.7 for h in nearby),
    }), 200
