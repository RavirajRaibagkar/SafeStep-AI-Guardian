import math
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.station import PoliceStation

police_bp = Blueprint('police', __name__)


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@police_bp.route('/nearest', methods=['GET'])
@jwt_required()
def get_nearest_station():
    """F19: Find nearest police station using Haversine formula."""
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    count = request.args.get('count', 3, type=int)

    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng required'}), 400

    stations = PoliceStation.query.filter_by(active=True).all()
    if not stations:
        return jsonify({'error': 'No stations in database'}), 404

    stations_with_dist = []
    for s in stations:
        dist = haversine(lat, lng, s.lat, s.lng)
        d = s.to_dict()
        d['distance_km'] = round(dist, 3)
        stations_with_dist.append(d)

    stations_with_dist.sort(key=lambda x: x['distance_km'])

    return jsonify({
        'nearest': stations_with_dist[0] if stations_with_dist else None,
        'nearest_stations': stations_with_dist[:count],
    }), 200


@police_bp.route('/stations', methods=['GET'])
def get_all_stations():
    """Get all police stations (for map display)."""
    district = request.args.get('district')
    query = PoliceStation.query.filter_by(active=True)
    if district:
        query = query.filter_by(district=district)
    stations = query.all()
    return jsonify({
        'stations': [s.to_dict() for s in stations],
        'count': len(stations),
    }), 200


@police_bp.route('/eta', methods=['GET'])
@jwt_required()
def get_officer_eta():
    """F21: Get police response ETA (mock officer location for demo)."""
    case_id = request.args.get('case_id')
    station_id = request.args.get('station_id', type=int)

    if not station_id:
        return jsonify({'error': 'station_id required'}), 400

    station = PoliceStation.query.get_or_404(station_id)

    # In production: query dispatch system API
    # For demo: calculate mock ETA based on distance
    user_lat = request.args.get('lat', type=float)
    user_lng = request.args.get('lng', type=float)

    if user_lat and user_lng:
        dist_km = haversine(user_lat, user_lng, station.lat, station.lng)
        eta_minutes = max(3, int(dist_km * 3))  # ~20 km/h average urban speed
    else:
        eta_minutes = 10

    # Mock officer location (moving toward user - demo)
    officer_lat = station.lat + (user_lat - station.lat) * 0.3 if user_lat else station.lat
    officer_lng = station.lng + (user_lng - station.lng) * 0.3 if user_lng else station.lng

    return jsonify({
        'case_id': case_id,
        'station': station.to_dict(),
        'eta_minutes': eta_minutes,
        'officer_lat': round(officer_lat, 6),
        'officer_lng': round(officer_lng, 6),
        'status': 'dispatched',
    }), 200
