import os
import logging
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT

logger = logging.getLogger(__name__)


def generate_monthly_report(month_str: str = None) -> str:
    """F26: Generate monthly safety PDF report."""
    from app.models.case import Case
    from app.models.alert import Hotspot
    from app.models.user import User

    if not month_str:
        month_str = datetime.utcnow().strftime('%Y-%m')

    try:
        year, month = int(month_str.split('-')[0]), int(month_str.split('-')[1])
    except Exception:
        year = datetime.utcnow().year
        month = datetime.utcnow().month

    start = datetime(year, month, 1)
    if month == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, month + 1, 1)

    # Gather stats
    total = Case.query.filter(Case.created_at >= start, Case.created_at < end).count()
    active = Case.query.filter(Case.created_at >= start, Case.created_at < end, Case.status == 'active').count()
    resolved = Case.query.filter(Case.created_at >= start, Case.created_at < end, Case.status == 'resolved').count()
    false_alarms = Case.query.filter(Case.created_at >= start, Case.created_at < end, Case.status == 'false_alarm').count()
    users = User.query.filter_by(is_active=True).count()
    hotspots = Hotspot.query.count()

    top_hotspots = Hotspot.query.order_by(Hotspot.risk_score.desc()).limit(5).all()

    output_dir = os.path.join('reports', 'monthly')
    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, f'safestep_report_{month_str}.pdf')

    doc = SimpleDocTemplate(filepath, pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm,
                             topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=18, alignment=TA_CENTER,
                                  textColor=colors.HexColor('#1a237e'), spaceAfter=6)
    sub_style = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER,
                                textColor=colors.HexColor('#616161'), spaceAfter=12)
    h2_style = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=12,
                               textColor=colors.HexColor('#1a237e'), spaceBefore=12, spaceAfter=4)
    body_style = styles['Normal']

    story.append(Paragraph("SafeStep — Monthly Safety Report", title_style))
    story.append(Paragraph(f"Report Period: {start.strftime('%B %Y')} | Andhra Pradesh Police Department", sub_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1a237e')))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Executive Summary", h2_style))
    summary_data = [
        ['Metric', 'Value'],
        ['Total SOS Incidents', str(total)],
        ['Active Cases', str(active)],
        ['Resolved Cases', str(resolved)],
        ['False Alarms', str(false_alarms)],
        ['False Alarm Rate', f"{(false_alarms/total*100) if total else 0:.1f}%"],
        ['Registered Users', str(users)],
        ['Active Hotspot Zones', str(hotspots)],
    ]
    t = Table(summary_data, colWidths=[80 * mm, 90 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#9fa8da')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Top 5 Danger Zones", h2_style))
    if top_hotspots:
        hotspot_data = [['#', 'District', 'Location', 'Risk Score', 'Incidents']]
        for i, h in enumerate(top_hotspots):
            hotspot_data.append([
                str(i + 1), h.district or 'N/A',
                f"{h.lat:.4f}, {h.lng:.4f}",
                f"{h.risk_score:.2f}",
                str(h.incident_count),
            ])
        ht = Table(hotspot_data, colWidths=[10 * mm, 40 * mm, 55 * mm, 30 * mm, 30 * mm])
        ht.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#c62828')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e57373')),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(ht)

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a237e')))
    story.append(Paragraph(
        f"Generated by SafeStep v1.0 | {datetime.utcnow().strftime('%d/%m/%Y %H:%M UTC')}",
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#757575'), alignment=TA_CENTER)
    ))

    doc.build(story)
    logger.info(f"Monthly report generated: {filepath}")
    return filepath


def generate_monthly_report_sync(month_str: str) -> str:
    """Synchronous wrapper for on-demand generation."""
    return generate_monthly_report(month_str)
