from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import db
from app.models.case import Case
from app.models.alert import Hotspot
from app.models.station import PoliceStation
from app.models.user import User

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard():
    """F23: Police admin dashboard data."""
    # In production: validate admin role via JWT claims
    total_cases = Case.query.count()
    active_cases = Case.query.filter_by(status='active').count()
    resolved_cases = Case.query.filter_by(status='resolved').count()
    false_alarms = Case.query.filter_by(status='false_alarm').count()
    total_users = User.query.filter_by(is_active=True).count()
    total_stations = PoliceStation.query.filter_by(active=True).count()
    total_hotspots = Hotspot.query.count()

    # Recent SOS events (last 20)
    recent_cases = Case.query.order_by(Case.created_at.desc()).limit(20).all()

    # Hotspot data for map
    hotspots = Hotspot.query.order_by(Hotspot.risk_score.desc()).limit(50).all()

    return jsonify({
        'stats': {
            'total_cases': total_cases,
            'active_cases': active_cases,
            'resolved_cases': resolved_cases,
            'false_alarms': false_alarms,
            'total_users': total_users,
            'total_stations': total_stations,
            'total_hotspots': total_hotspots,
            'false_alarm_rate': round((false_alarms / total_cases * 100) if total_cases else 0, 1),
        },
        'recent_cases': [c.to_dict() for c in recent_cases],
        'hotspots': [h.to_dict() for h in hotspots],
        'generated_at': datetime.utcnow().isoformat(),
    }), 200


@admin_bp.route('/cases', methods=['GET'])
@jwt_required()
def admin_list_cases():
    """F24: Admin paginated case list with filters."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status_filter = request.args.get('status')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    query = Case.query

    if status_filter:
        query = query.filter_by(status=status_filter)
    if date_from:
        try:
            query = query.filter(Case.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            query = query.filter(Case.created_at <= datetime.fromisoformat(date_to))
        except ValueError:
            pass

    query = query.order_by(Case.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'cases': [c.to_dict() for c in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page,
    }), 200


@admin_bp.route('/report/<month>', methods=['GET'])
@jwt_required()
def get_monthly_report(month):
    """F26: Download monthly PDF report."""
    import os
    report_dir = os.path.join('reports', 'monthly')
    report_path = os.path.join(report_dir, f'safestep_report_{month}.pdf')

    if not os.path.exists(report_path):
        # Generate on-demand if not cached
        from app.tasks.report_generator import generate_monthly_report_sync
        try:
            report_path = generate_monthly_report_sync(month)
        except Exception as e:
            return jsonify({'error': f'Report generation failed: {str(e)}'}), 500

    from flask import send_file
    return send_file(report_path, as_attachment=True, download_name=f'safestep_report_{month}.pdf')


@admin_bp.route('/hotspots/recommendations', methods=['GET'])
@jwt_required()
def get_patrol_recommendations():
    """F25: AI-generated patrol recommendations."""
    hotspots = Hotspot.query.filter(Hotspot.risk_score >= 0.6).order_by(
        Hotspot.risk_score.desc()
    ).limit(10).all()

    recommendations = []
    for h in hotspots:
        time_matrix = h.time_risk_matrix or [0.5] * 24
        # Find peak hours
        peak_hours = sorted(range(24), key=lambda i: time_matrix[i], reverse=True)[:3]
        peak_str = ', '.join([f"{hr:02d}:00" for hr in sorted(peak_hours)])

        recommendations.append({
            'hotspot_id': h.id,
            'district': h.district,
            'location': {'lat': h.lat, 'lng': h.lng},
            'risk_score': h.risk_score,
            'crime_types': h.crime_types or [],
            'recommendation': f"Increase patrol in district {h.district or 'Unknown'} during {peak_str}",
            'priority': 'HIGH' if h.risk_score > 0.8 else 'MEDIUM',
        })

    return jsonify({'recommendations': recommendations, 'count': len(recommendations)}), 200
