from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import db, socketio
from app.models.case import Case
from app.models.user import User

location_bp = Blueprint('location', __name__)

# In-memory store for live location (Redis would be better for production)
live_locations = {}


@location_bp.route('/update', methods=['POST'])
@jwt_required()
def update_location():
    """F03: Real-time location push during active SOS."""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    lat = data.get('lat')
    lng = data.get('lng')
    case_id = data.get('case_id')
    battery = data.get('battery', 100)

    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng required'}), 400

    timestamp = datetime.utcnow().isoformat()

    # Store live location
    live_locations[str(user_id)] = {
        'lat': lat,
        'lng': lng,
        'timestamp': timestamp,
        'case_id': case_id,
        'battery': battery,
    }

    # Append to GPS trail if active case
    if case_id:
        case = Case.query.filter_by(case_id=case_id, user_id=user_id).first()
        if case and case.status == 'active':
            trail = case.gps_trail or []
            trail.append({'lat': lat, 'lng': lng, 'timestamp': timestamp})
            # Keep last 1000 points max
            if len(trail) > 1000:
                trail = trail[-1000:]
            case.gps_trail = trail
            db.session.commit()

    # Broadcast via Socket.io (F03)
    socketio.emit('location_update', {
        'case_id': case_id,
        'user_id': user_id,
        'lat': lat,
        'lng': lng,
        'battery': battery,
        'timestamp': timestamp,
    }, room=f'case_{case_id}')

    return jsonify({'success': True, 'timestamp': timestamp}), 200


@location_bp.route('/live/<user_id>', methods=['GET'])
@jwt_required()
def get_live_location(user_id):
    """Guardian dashboard: get user's current location."""
    location = live_locations.get(str(user_id))
    if not location:
        return jsonify({'error': 'No live location available'}), 404
    return jsonify(location), 200


@location_bp.route('/trail/<case_id>', methods=['GET'])
@jwt_required()
def get_gps_trail(case_id):
    """Get full GPS trail for a case."""
    case = Case.query.filter_by(case_id=case_id).first()
    if not case:
        return jsonify({'error': 'Case not found'}), 404

    requester_id = int(get_jwt_identity())
    user = User.query.get(requester_id)

    # Allow: case owner, guardians, police admin
    is_guardian = any(
        str(c.get('phone')) == str(user.phone)
        for c in (User.query.get(case.user_id).emergency_contacts or [])
    ) if user else False

    if case.user_id != requester_id and not is_guardian:
        return jsonify({'error': 'Access denied'}), 403

    return jsonify({
        'case_id': case_id,
        'trail': case.gps_trail or [],
        'status': case.status,
    }), 200
