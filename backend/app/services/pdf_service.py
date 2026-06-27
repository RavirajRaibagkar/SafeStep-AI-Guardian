import os
import logging
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.platypus import Image as RLImage
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

logger = logging.getLogger(__name__)


class PDFService:
    def __init__(self):
        self.output_dir = os.path.join('uploads', 'fir')
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_fir_pdf(self, case, user, address: str, lat: float, lng: float) -> str:
        """F20: Generate professional FIR draft PDF."""
        filename = f"FIR_{case.case_id}.pdf"
        filepath = os.path.join(self.output_dir, filename)

        doc = SimpleDocTemplate(
            filepath,
            pagesize=A4,
            rightMargin=20 * mm,
            leftMargin=20 * mm,
            topMargin=20 * mm,
            bottomMargin=20 * mm,
        )

        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            'FIRTitle',
            parent=styles['Title'],
            fontSize=16,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=4,
            alignment=TA_CENTER,
        )
        subtitle_style = ParagraphStyle(
            'FIRSubtitle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#424242'),
            alignment=TA_CENTER,
            spaceAfter=10,
        )
        heading_style = ParagraphStyle(
            'FIRHeading',
            parent=styles['Heading2'],
            fontSize=11,
            textColor=colors.HexColor('#1a237e'),
            spaceBefore=10,
            spaceAfter=4,
            borderPad=2,
        )
        body_style = ParagraphStyle(
            'FIRBody',
            parent=styles['Normal'],
            fontSize=10,
            leading=16,
            spaceAfter=4,
        )
        small_style = ParagraphStyle(
            'FIRSmall',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#757575'),
        )

        story = []

        # Header
        story.append(Paragraph("ANDHRA PRADESH POLICE DEPARTMENT", title_style))
        story.append(Paragraph("First Information Report (Auto-Generated via SafeStep)", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1a237e')))
        story.append(Spacer(1, 8))

        # Case metadata table
        now = datetime.utcnow()
        meta_data = [
            ['Case ID', case.case_id, 'Report Date', now.strftime('%d/%m/%Y')],
            ['Report Time', now.strftime('%H:%M UTC'), 'Classification', case.ai_classification or 'Emergency'],
            ['Status', case.status.upper(), 'Trigger Method', (case.trigger_type or 'manual').replace('_', ' ').title()],
        ]
        meta_table = Table(meta_data, colWidths=[40 * mm, 65 * mm, 40 * mm, 40 * mm])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e8eaf6')),
            ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#e8eaf6')),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#9fa8da')),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 10))

        # Section 1: Complainant Details
        story.append(Paragraph("1. COMPLAINANT / VICTIM DETAILS", heading_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#9fa8da')))

        complainant_data = [
            ['Full Name', user.name],
            ['Phone Number', user.phone],
            ['Email Address', user.email],
            ['Emergency Contacts', ', '.join([
                f"{c.get('name', '')} ({c.get('phone', '')})"
                for c in (user.emergency_contacts or [])[:3]
            ]) or 'Not specified'],
        ]
        comp_table = Table(complainant_data, colWidths=[50 * mm, 135 * mm])
        comp_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
        ]))
        story.append(comp_table)
        story.append(Spacer(1, 8))

        # Section 2: Incident Details
        story.append(Paragraph("2. INCIDENT DETAILS", heading_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#9fa8da')))

        incident_data = [
            ['Date of Incident', (case.start_time or now).strftime('%d/%m/%Y')],
            ['Time of Incident', (case.start_time or now).strftime('%H:%M:%S UTC')],
            ['Location (GPS)', f"Latitude: {lat:.6f}, Longitude: {lng:.6f}"],
            ['Address', address or 'Location data captured via GPS'],
            ['Nature of Emergency', case.ai_classification or 'General Emergency - SOS Triggered'],
            ['Google Maps Link', f"https://maps.google.com/?q={lat},{lng}"],
            ['Live Tracking URL', f"https://safestep.app/track/{case.case_id}"],
        ]
        inc_table = Table(incident_data, colWidths=[50 * mm, 135 * mm])
        inc_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
        ]))
        story.append(inc_table)
        story.append(Spacer(1, 8))

        # Section 3: AI Analysis
        story.append(Paragraph("3. AI ANALYSIS & EVIDENCE", heading_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#9fa8da')))

        ai_data = [
            ['AI Classification', case.ai_classification or 'EMERGENCY'],
            ['Confidence Score', f"{(case.confidence_score or 0) * 100:.1f}%" if case.confidence_score else 'N/A'],
            ['Audio Evidence URL', case.audio_url or 'Pending upload'],
            ['GPS Trail Points', str(len(case.gps_trail or []))],
        ]
        ai_table = Table(ai_data, colWidths=[50 * mm, 135 * mm])
        ai_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
        ]))
        story.append(ai_table)
        story.append(Spacer(1, 10))

        # Section 4: Declaration
        story.append(Paragraph("4. DECLARATION", heading_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#9fa8da')))
        story.append(Paragraph(
            "This report has been automatically generated by the SafeStep AI Safety System based on "
            "distress signals detected from the complainant's registered mobile device. The information "
            "contained herein is based on GPS telemetry, AI audio classification, and user-profile data "
            "stored in the SafeStep system. This document is admissible as a preliminary FIR draft and "
            "should be verified by the attending officer.",
            body_style
        ))
        story.append(Spacer(1, 20))

        # Signature area
        sig_data = [
            ['Reporting Officer Signature:', '___________________', 'Station Seal:'],
            ['Date:', '___________________', ''],
            ['FIR Number:', '___________________', ''],
        ]
        sig_table = Table(sig_data, colWidths=[60 * mm, 75 * mm, 50 * mm])
        sig_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(sig_table)
        story.append(Spacer(1, 10))

        # Footer
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a237e')))
        story.append(Paragraph(
            f"Generated by SafeStep v1.0 | Y4 Prakasam Police Hackathon 2026 | "
            f"Case Reference: {case.case_id} | {now.strftime('%d/%m/%Y %H:%M UTC')}",
            small_style
        ))

        doc.build(story)

        logger.info(f"FIR PDF generated: {filepath}")
        return f"/uploads/fir/{filename}"

    def generate_evidence_package(self, case_id: str) -> str:
        """F13: Generate ZIP evidence package with audio + GPS trail + FIR."""
        import zipfile
        import json

        case_dir = os.path.join('uploads', 'audio', case_id)
        zip_path = os.path.join('uploads', 'evidence', f"{case_id}_evidence.zip")
        os.makedirs(os.path.dirname(zip_path), exist_ok=True)

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Add audio files
            if os.path.exists(case_dir):
                for f in os.listdir(case_dir):
                    zf.write(os.path.join(case_dir, f), f"audio/{f}")

            # Add FIR PDF
            fir_path = os.path.join('uploads', 'fir', f"FIR_{case_id}.pdf")
            if os.path.exists(fir_path):
                zf.write(fir_path, f"FIR_{case_id}.pdf")

        return zip_path
