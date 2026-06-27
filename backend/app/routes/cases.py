from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import db
from app.models.case import Case
from app.models.user import User
from app.models.alert import Alert

cases_bp = Blueprint('cases', __name__)


@cases_bp.route('/list', methods=['GET'])
@jwt_required()
def list_cases():
    """F24: Paginated case history for user."""
    user_id = int(get_jwt_identity())
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    status_filter = request.args.get('status')

    query = Case.query.filter_by(user_id=user_id)
    if status_filter:
        query = query.filter_by(status=status_filter)

    query = query.order_by(Case.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'cases': [c.to_dict() for c in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page,
        'has_next': paginated.has_next,
        'has_prev': paginated.has_prev,
    }), 200


@cases_bp.route('/<case_id>', methods=['GET'])
@jwt_required()
def get_case_detail(case_id):
    """Full case detail with alerts timeline."""
    user_id = int(get_jwt_identity())
    case = Case.query.filter_by(case_id=case_id, user_id=user_id).first()
    if not case:
        return jsonify({'error': 'Case not found'}), 404

    alerts = Alert.query.filter_by(case_id=case.id).order_by(Alert.sent_at.asc()).all()

    return jsonify({
        'case': case.to_dict(),
        'alerts': [a.to_dict() for a in alerts],
    }), 200


@cases_bp.route('/<case_id>/resolve', methods=['POST'])
@jwt_required()
def resolve_case(case_id):
    """Mark case as resolved."""
    user_id = int(get_jwt_identity())
    case = Case.query.filter_by(case_id=case_id, user_id=user_id).first()
    if not case:
        return jsonify({'error': 'Case not found'}), 404

    data = request.get_json() or {}
    case.status = data.get('status', 'resolved')
    case.end_time = datetime.utcnow()
    case.notes = data.get('notes', '')
    db.session.commit()

    return jsonify({'success': True, 'case': case.to_dict()}), 200


@cases_bp.route('/export', methods=['GET'])
@jwt_required()
def export_cases():
    """Export user's cases as CSV."""
    import csv
    import io
    user_id = int(get_jwt_identity())
    cases = Case.query.filter_by(user_id=user_id).order_by(Case.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Case ID', 'Status', 'Trigger', 'Start Time', 'End Time', 'AI Classification'])

    for c in cases:
        writer.writerow([
            c.case_id, c.status, c.trigger_type,
            c.start_time.isoformat() if c.start_time else '',
            c.end_time.isoformat() if c.end_time else '',
            c.ai_classification or '',
        ])

    output.seek(0)
    from flask import Response
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment;filename=safestep_cases.csv'}
    )
