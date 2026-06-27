import os
import logging
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import db, socketio
from app.models.user import User
from app.models.case import Case, generate_case_id
from app.models.alert import Alert
from app.models.station import PoliceStation
from app.services.twilio_service import TwilioService
from app.services.pdf_service import PDFService
from app.services.cascade_service import CascadeService
from app.services.route_scorer import get_reverse_geocode
import math

logger = logging.getLogger(__name__)
sos_bp = Blueprint('sos', __name__)

twilio_svc = TwilioService()
pdf_svc = PDFService()


def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance between two GPS points in km."""
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_nearest_station(lat, lng):
    """Find nearest active police station using Haversine formula."""
    stations = PoliceStation.query.filter_by(active=True).all()
    if not stations:
        return None
    nearest = min(stations, key=lambda s: haversine(lat, lng, s.lat, s.lng))
    return nearest


@sos_bp.route('/trigger', methods=['POST'])
@jwt_required()
def trigger_sos():
    """
    F01 + F03 + F18 + F19 + F20 + F22
    Fire the complete SOS pipeline within 8 seconds.
    """
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    lat = data.get('lat', 0.0)
    lng = data.get('lng', 0.0)
    trigger_type = data.get('trigger_type', 'manual')
    ai_classification = data.get('ai_classification')
    confidence_score = data.get('confidence_score')

    # F22: Generate Case ID
    case_id_str = generate_case_id()

    # Create case record
    case = Case(
        case_id=case_id_str,
        user_id=user.id,
        trigger_type=trigger_type,
        gps_trail=[{'lat': lat, 'lng': lng, 'timestamp': datetime.utcnow().isoformat()}],
        ai_classification=ai_classification,
        confidence_score=confidence_score,
        status='active',
    )
    db.session.add(case)
    db.session.flush()  # get case.id

    # F19: Find nearest police station
    nearest_station = find_nearest_station(lat, lng) if lat and lng else None
    if nearest_station:
        case.nearest_station_id = nearest_station.id

    db.session.commit()

    # Reverse geocode for address
    address = get_reverse_geocode(lat, lng)

    # F20: Generate FIR PDF in background
    try:
        pdf_url = pdf_svc.generate_fir_pdf(case, user, address, lat, lng)
        case.fir_pdf_url = pdf_url
        db.session.commit()
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")

    # F03: Broadcast live tracking link via Socket.io
    tracking_url = f"https://safestep.app/track/{case_id_str}"
    socketio.emit('sos_received', {
        'case_id': case_id_str,
        'user_name': user.name,
        'user_phone': user.phone,
        'location': {'lat': lat, 'lng': lng},
        'trigger_type': trigger_type,
        'timestamp': datetime.utcnow().isoformat(),
        'tracking_url': tracking_url,
    }, to='police_room')

    # F18 + F19: Emergency contact cascade + police alert
    cascade = CascadeService(twilio_svc)
    emergency_contacts = user.emergency_contacts or []
    cascade.fire_cascade(
        case=case,
        user=user,
        contacts=emergency_contacts,
        lat=lat,
        lng=lng,
        address=address,
        tracking_url=tracking_url,
        nearest_station=nearest_station,
    )

    return jsonify({
        'success': True,
        'case_id': case_id_str,
        'tracking_url': tracking_url,
        'nearest_station': nearest_station.to_dict() if nearest_station else None,
        'fir_pdf_url': case.fir_pdf_url,
        'message': 'SOS pipeline activated. Help is on the way.',
    }), 200


@sos_bp.route('/audio-upload', methods=['POST'])
@jwt_required()
def audio_upload():
    """F02 + F13: Upload evidence audio with case ID."""
    user_id = int(get_jwt_identity())
    case_id_str = request.form.get('case_id')
    lat = request.form.get('lat', 0.0)
    lng = request.form.get('lng', 0.0)

    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']
    case = Case.query.filter_by(case_id=case_id_str, user_id=user_id).first()
    if not case:
        return jsonify({'error': 'Case not found'}), 404

    upload_dir = os.path.join('uploads', 'audio', case_id_str)
    os.makedirs(upload_dir, exist_ok=True)

    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    filename = f"{case_id_str}_{timestamp}.aac"
    filepath = os.path.join(upload_dir, filename)
    audio_file.save(filepath)

    # Update case with audio URL
    audio_url = f"/uploads/audio/{case_id_str}/{filename}"
    case.audio_url = audio_url

    # Append to GPS trail
    trail = case.gps_trail or []
    trail.append({
        'lat': float(lat),
        'lng': float(lng),
        'timestamp': datetime.utcnow().isoformat(),
        'type': 'audio_segment'
    })
    case.gps_trail = trail
    db.session.commit()

    return jsonify({
        'success': True,
        'audio_url': audio_url,
        'case_id': case_id_str,
        'timestamp': timestamp,
    }), 200


@sos_bp.route('/case/<case_id>', methods=['GET'])
def get_case_status(case_id):
    """F22: Public case tracking endpoint (no auth required for live URL)."""
    case = Case.query.filter_by(case_id=case_id).first()
    if not case:
        return jsonify({'error': 'Case not found'}), 404

    user = User.query.get(case.user_id)
    station = PoliceStation.query.get(case.nearest_station_id) if case.nearest_station_id else None

    return jsonify({
        'case_id': case.case_id,
        'status': case.status,
        'trigger_type': case.trigger_type,
        'start_time': case.start_time.isoformat() if case.start_time else None,
        'gps_trail': case.gps_trail or [],
        'nearest_station': station.to_dict() if station else None,
        'user_name': user.name if user else 'Unknown',
        'fir_pdf_url': case.fir_pdf_url,
    }), 200


@sos_bp.route('/cancel/<case_id>', methods=['POST'])
@jwt_required()
def cancel_sos(case_id):
    """Cancel active SOS (requires biometric confirmation on client side)."""
    user_id = int(get_jwt_identity())
    case = Case.query.filter_by(case_id=case_id, user_id=user_id).first()
    if not case:
        return jsonify({'error': 'Case not found'}), 404

    case.status = 'false_alarm'
    case.end_time = datetime.utcnow()
    db.session.commit()

    # Notify all contacts that it was a false alarm
    user = User.query.get(user_id)
    contacts = user.emergency_contacts or []
    for contact in contacts[:3]:
        try:
            twilio_svc.send_sms(
                to=contact['phone'],
                body=f"SafeStep: False alarm from {user.name}. They are safe. Case {case_id} cancelled."
            )
        except Exception as e:
            logger.error(f"Failed to send cancellation SMS: {e}")

    return jsonify({'success': True, 'message': 'SOS cancelled', 'case_id': case_id}), 200
