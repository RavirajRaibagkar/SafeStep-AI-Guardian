import logging
from flask_socketio import join_room, leave_room, emit

logger = logging.getLogger(__name__)


def register_socket_events(socketio):
    """Register all Socket.IO event handlers."""

    @socketio.on('connect')
    def handle_connect():
        logger.info(f"Client connected: {__import__('flask').request.sid}")

    @socketio.on('disconnect')
    def handle_disconnect():
        logger.info(f"Client disconnected: {__import__('flask').request.sid}")

    @socketio.on('join_case')
    def handle_join_case(data):
        """Guardian/police joins a case room to receive live updates."""
        case_id = data.get('case_id')
        if case_id:
            join_room(f'case_{case_id}')
            emit('joined', {'room': f'case_{case_id}', 'case_id': case_id})
            logger.info(f"Client joined case room: {case_id}")

    @socketio.on('leave_case')
    def handle_leave_case(data):
        case_id = data.get('case_id')
        if case_id:
            leave_room(f'case_{case_id}')

    @socketio.on('join_police')
    def handle_join_police(data):
        """Police dashboard joins the police broadcast room."""
        join_room('police_room')
        emit('joined', {'room': 'police_room'})
        logger.info("Police dashboard joined police_room")

    @socketio.on('location_update')
    def handle_location_update(data):
        """Relay location updates to case room subscribers."""
        case_id = data.get('case_id')
        if case_id:
            emit('location_update', data, room=f'case_{case_id}', include_self=False)

    @socketio.on('officer_dispatch')
    def handle_officer_dispatch(data):
        """Police dispatches officer — notify user."""
        case_id = data.get('case_id')
        if case_id:
            emit('officer_eta', {
                'case_id': case_id,
                'eta_minutes': data.get('eta_minutes', 10),
                'officer_lat': data.get('officer_lat'),
                'officer_lng': data.get('officer_lng'),
                'message': 'Officer dispatched. Help is on the way!',
            }, room=f'case_{case_id}')

    @socketio.on('checkin_response')
    def handle_checkin_response(data):
        """User responds to check-in notification."""
        user_id = data.get('user_id')
        response = data.get('response', 'safe')
        emit('checkin_confirmed', {
            'user_id': user_id,
            'response': response,
            'timestamp': __import__('datetime').datetime.utcnow().isoformat(),
        }, broadcast=True)
