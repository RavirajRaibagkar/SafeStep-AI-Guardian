from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import db
from app.models.user import User

geofence_bp = Blueprint('geofence', __name__)


@geofence_bp.route('/create', methods=['POST'])
@jwt_required()
def create_geofence():
    """F16: Create a safe zone geofence."""
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    required = ['name', 'lat', 'lng', 'radius']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400

    new_zone = {
        'id': f"zone_{datetime.utcnow().timestamp()}",
        'name': data['name'],
        'lat': data['lat'],
        'lng': data['lng'],
        'radius': data.get('radius', 200),  # meters
        'alert_hours': data.get('alert_hours', {'start': 20, 'end': 6}),
        'created_at': datetime.utcnow().isoformat(),
    }

    zones = user.safe_zones or []
    zones.append(new_zone)
    user.safe_zones = zones
    db.session.commit()

    return jsonify({'success': True, 'zone': new_zone, 'all_zones': zones}), 201


@geofence_bp.route('/list', methods=['GET'])
@jwt_required()
def list_geofences():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    return jsonify({'zones': user.safe_zones or []}), 200


@geofence_bp.route('/<zone_id>', methods=['DELETE'])
@jwt_required()
def delete_geofence(zone_id):
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    zones = [z for z in (user.safe_zones or []) if z.get('id') != zone_id]
    user.safe_zones = zones
    db.session.commit()
    return jsonify({'success': True, 'zones': zones}), 200


@geofence_bp.route('/check', methods=['POST'])
@jwt_required()
def check_geofence():
    """F16: Check if user is inside/outside their safe zones."""
    import math
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    lat = data.get('lat')
    lng = data.get('lng')
    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng required'}), 400

    zones = user.safe_zones or []
    current_hour = datetime.utcnow().hour

    zone_statuses = []
    any_safe = False

    for zone in zones:
        R = 6371000
        phi1, phi2 = math.radians(lat), math.radians(zone['lat'])
        dphi = math.radians(zone['lat'] - lat)
        dlambda = math.radians(zone['lng'] - lng)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        dist_m = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        inside = dist_m <= zone.get('radius', 200)
        if inside:
            any_safe = True

        # Check if alert hours apply
        alert_hours = zone.get('alert_hours', {'start': 20, 'end': 6})
        start_h = alert_hours.get('start', 20)
        end_h = alert_hours.get('end', 6)
        in_alert_window = (current_hour >= start_h) or (current_hour < end_h)

        zone_statuses.append({
            'zone_id': zone.get('id'),
            'zone_name': zone.get('name'),
            'inside': inside,
            'distance_m': round(dist_m, 1),
            'alert_applicable': in_alert_window and not inside,
        })

    return jsonify({
        'in_safe_zone': any_safe,
        'zones': zone_statuses,
        'should_alert': not any_safe and any(z['alert_applicable'] for z in zone_statuses),
    }), 200
