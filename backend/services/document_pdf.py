"""
PDF generation helpers (pure functions, no DB access).
Used by all /reports/*/pdf endpoints in server.py.
"""
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
)
from fastapi.responses import StreamingResponse

STYLES = getSampleStyleSheet()

CELL_STYLE = ParagraphStyle(
    "cell", parent=STYLES["Normal"], fontName="Helvetica",
    fontSize=8.5, leading=11, wordWrap="CJK", spaceBefore=0, spaceAfter=0,
)
CELL_RIGHT = ParagraphStyle("cell_r", parent=CELL_STYLE, alignment=2)
CELL_BOLD = ParagraphStyle("cell_b", parent=CELL_STYLE, fontName="Helvetica-Bold")
CELL_BOLD_RIGHT = ParagraphStyle("cell_br", parent=CELL_BOLD, alignment=2)
SECTION_STYLE = ParagraphStyle(
    "section", parent=STYLES["Normal"], fontName="Helvetica-Bold",
    fontSize=9, textColor=colors.HexColor("#2E4F7C"), spaceBefore=0, spaceAfter=0,
)


def P(text, style=CELL_STYLE):
    """Wrap text in a Paragraph so it word-wraps inside a table cell."""
    if text is None:
        text = ""
    s = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Paragraph(s, style)


def pdf_response(build_fn, filename: str):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm,
        leftMargin=1.2 * cm, rightMargin=1.2 * cm,
    )
    story = build_fn()
    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def pdf_header(story, title: str, subtitle: str = ""):
    """Standard Kepmendesa 136/2022 header — center aligned."""
    story.append(Paragraph("<b>BUMDES KARYA RAHARJA</b>", STYLES["Title"]))
    story.append(Paragraph("Desa Wonoharjo, Kecamatan Pangandaran, Kabupaten Pangandaran", STYLES["Normal"]))
    story.append(Spacer(1, 0.15 * cm))
    story.append(Paragraph(f"<b>{title.upper()}</b>", STYLES["Heading2"]))
    if subtitle:
        story.append(Paragraph(subtitle, STYLES["Normal"]))
    story.append(Paragraph("<i>(Dalam Rupiah)</i>", STYLES["Normal"]))
    story.append(Spacer(1, 0.4 * cm))


def table_style():
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DCE8FE")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1A2E1E")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E8EAE6")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F6FAFE")]),
    ])


def section_row(text: str, ncols: int):
    return [P(text, SECTION_STYLE)] + [P("") for _ in range(ncols - 1)]


def signature_block(dir_name: str, ben_name: str, place_date: str):
    """Return list of flowables for signature area. Caller supplies names."""
    flow = []
    flow.append(Spacer(1, 0.8 * cm))
    flow.append(Paragraph(place_date, STYLES["Normal"]))
    flow.append(Spacer(1, 0.2 * cm))
    sig_rows = [
        [P("Mengetahui,", CELL_STYLE), P("Disusun oleh,", CELL_STYLE)],
        [P("Direktur BUMDES", CELL_STYLE), P("Bendahara BUMDES", CELL_STYLE)],
        [Spacer(1, 2 * cm), Spacer(1, 2 * cm)],
        [P(f"( {dir_name} )", CELL_BOLD), P(f"( {ben_name} )", CELL_BOLD)],
    ]
    sig_table = Table(sig_rows, colWidths=[8.5 * cm, 8.5 * cm])
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LINEABOVE", (0, 3), (-1, 3), 0.6, colors.HexColor("#2E4F7C")),
    ]))
    flow.append(sig_table)
    return flow
