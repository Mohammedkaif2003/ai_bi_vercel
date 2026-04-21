"""
Narrative-first PDF report generator.

Every analysis is rendered as a readable, prose-style section — the AI's reply
is the primary content, charts and small tables are supporting detail. The
document reads like an executive briefing, not a dashboard printout.
"""
from __future__ import annotations

import copy
import os
import re
from datetime import datetime
from io import BytesIO
from typing import Optional

import pandas as pd

try:
    import plotly.express as px  # noqa: F401
    _PLOTLY_OK = True
except ImportError:
    _PLOTLY_OK = False

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from modules.app_logging import get_logger

logger = get_logger("report_generator")

# ─────────────────────────────────────────────────────────────────────────────
# Brand palette
# ─────────────────────────────────────────────────────────────────────────────
C_INK      = colors.HexColor("#0F172A")
C_BODY     = colors.HexColor("#1F2937")
C_MUTED    = colors.HexColor("#64748B")
C_ACCENT   = colors.HexColor("#2563EB")
C_ACCENT2  = colors.HexColor("#4F46E5")
C_GOLD     = colors.HexColor("#B45309")
C_HAIRLINE = colors.HexColor("#E2E8F0")
C_QUOTE_BG = colors.HexColor("#F8FAFC")
C_TH_BG    = colors.HexColor("#1E3A5F")
C_ROW_ALT  = colors.HexColor("#F1F5F9")

HX_ACCENT = "#2563EB"
HX_MUTED  = "#64748B"
HX_GOLD   = "#B45309"
HX_INK    = "#0F172A"

PAGE_W, PAGE_H = A4
LEFT_MARGIN   = 0.95 * inch
RIGHT_MARGIN  = 0.95 * inch
TOP_MARGIN    = 0.95 * inch
BOTTOM_MARGIN = 0.85 * inch
BODY_W        = PAGE_W - (LEFT_MARGIN + RIGHT_MARGIN)


# ─────────────────────────────────────────────────────────────────────────────
# Styles
# ─────────────────────────────────────────────────────────────────────────────
def _build_styles():
    base = getSampleStyleSheet()

    def add(**kw):
        base.add(ParagraphStyle(**kw))

    add(name="CoverEyebrow", fontName="Helvetica-Bold", fontSize=9,  textColor=C_ACCENT,
        leading=12, spaceAfter=6, alignment=TA_CENTER)
    add(name="CoverTitle",   fontName="Helvetica-Bold", fontSize=34, textColor=C_INK,
        leading=40, spaceAfter=8, alignment=TA_CENTER)
    add(name="CoverSub",     fontName="Helvetica",      fontSize=12, textColor=C_MUTED,
        leading=16, spaceAfter=24, alignment=TA_CENTER)
    add(name="CoverLabel",   fontName="Helvetica-Bold", fontSize=8,  textColor=C_MUTED,
        leading=11, alignment=TA_LEFT)
    add(name="CoverValue",   fontName="Helvetica",      fontSize=11, textColor=C_INK,
        leading=14, alignment=TA_LEFT, spaceAfter=6)

    add(name="H1",   fontName="Helvetica-Bold", fontSize=18, textColor=C_INK,
        spaceBefore=0, spaceAfter=4, leading=22)
    add(name="H2",   fontName="Helvetica-Bold", fontSize=13, textColor=C_ACCENT,
        spaceBefore=10, spaceAfter=5, leading=17)
    add(name="Eyebrow", fontName="Helvetica-Bold", fontSize=8, textColor=C_MUTED,
        spaceBefore=12, spaceAfter=3, leading=11)

    add(name="Body", fontName="Helvetica", fontSize=10.5, textColor=C_BODY,
        spaceAfter=8, leading=16, alignment=TA_JUSTIFY)
    add(name="BodyTight", fontName="Helvetica", fontSize=10.5, textColor=C_BODY,
        spaceAfter=4, leading=16, alignment=TA_JUSTIFY)
    add(name="Quote", fontName="Helvetica-Oblique", fontSize=12, textColor=C_INK,
        leading=18, spaceBefore=4, spaceAfter=12,
        leftIndent=14, rightIndent=10,
        borderColor=C_ACCENT, borderWidth=0, borderPadding=0)
    add(name="BulletItem", fontName="Helvetica", fontSize=10.5, textColor=C_BODY,
        spaceAfter=4, leading=15, leftIndent=16, bulletIndent=4)
    add(name="Caption", fontName="Helvetica-Oblique", fontSize=9, textColor=C_MUTED,
        spaceBefore=2, spaceAfter=10, leading=12, alignment=TA_CENTER)
    add(name="Small", fontName="Helvetica", fontSize=9, textColor=C_MUTED,
        spaceAfter=4, leading=12)
    add(name="TOCItem", fontName="Helvetica", fontSize=11, textColor=C_INK,
        spaceBefore=3, spaceAfter=3, leading=16)

    return base


# ─────────────────────────────────────────────────────────────────────────────
# Page decorators
# ─────────────────────────────────────────────────────────────────────────────
def _decorate_cover(canvas, doc):
    canvas.saveState()
    # Thin top accent
    canvas.setFillColor(C_ACCENT)
    canvas.rect(0, PAGE_H - 6, PAGE_W, 6, fill=True, stroke=False)
    # Footer line + label
    canvas.setFillColor(C_MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(PAGE_W / 2, 32, "APEX ANALYTICS  ·  EXECUTIVE REPORT  ·  CONFIDENTIAL")
    canvas.restoreState()


def _decorate_page(canvas, doc):
    canvas.saveState()
    # Header rule
    canvas.setStrokeColor(C_HAIRLINE)
    canvas.setLineWidth(0.5)
    canvas.line(LEFT_MARGIN, PAGE_H - 0.55 * inch, PAGE_W - RIGHT_MARGIN, PAGE_H - 0.55 * inch)
    # Header label
    canvas.setFillColor(C_MUTED)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(LEFT_MARGIN, PAGE_H - 0.40 * inch, "APEX ANALYTICS")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(PAGE_W - RIGHT_MARGIN, PAGE_H - 0.40 * inch, "Executive Report")

    # Footer
    canvas.setStrokeColor(C_HAIRLINE)
    canvas.line(LEFT_MARGIN, 0.55 * inch, PAGE_W - RIGHT_MARGIN, 0.55 * inch)
    canvas.setFillColor(C_MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(LEFT_MARGIN, 0.38 * inch, "Confidential · AI-generated analysis")
    canvas.drawRightString(PAGE_W - RIGHT_MARGIN, 0.38 * inch, f"Page {doc.page}")
    canvas.restoreState()


# ─────────────────────────────────────────────────────────────────────────────
# Text helpers
# ─────────────────────────────────────────────────────────────────────────────
_STRUCTURED_HEADERS = re.compile(
    r"^\s*(executive\s+insight|key\s+findings?|business\s+impact|"
    r"recommendations?|limitations?|conclusion|summary)\s*:?\s*$",
    re.IGNORECASE,
)


def _strip_html_like(text: str) -> str:
    t = re.sub(r"<[^>]+>", "", str(text))
    t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return t


_BOLD_OPEN  = "\x01B"
_BOLD_CLOSE = "\x02B"


def _safe_xml(text: str, max_len: int = 6000) -> str:
    """Escape text for ReportLab XML, preserving **bold** markers."""
    t = _strip_html_like(str(text))[:max_len]
    # Keep bold spans via placeholders while escaping
    t = re.sub(r"\*\*(.+?)\*\*",
               lambda m: _BOLD_OPEN + m.group(1) + _BOLD_CLOSE,
               t, flags=re.DOTALL)
    # Strip markdown headers / list markers used inline
    t = re.sub(r"^#{1,6}\s*", "", t, flags=re.MULTILINE)
    # Escape XML special chars
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Restore bold
    t = t.replace(_BOLD_OPEN, "<b>").replace(_BOLD_CLOSE, "</b>")
    return t.strip()


def _split_ai_response(text: str) -> list[tuple[str, str, list[str]]]:
    """
    Parse the AI reply into sections.

    Returns a list of tuples: (section_title, paragraph_text, bullets[]).
    Bullets are extracted when lines start with '-', '•', or '*'.
    If no headers are found, we return a single ("", body, bullets) block.
    """
    raw = _strip_html_like(str(text or "")).strip()
    if not raw:
        return []

    lines = [ln.rstrip() for ln in raw.splitlines()]
    sections: list[tuple[str, list[str], list[str]]] = []   # (title, paragraphs, bullets)
    cur_title = ""
    cur_paras: list[str] = []
    cur_bullets: list[str] = []

    def flush():
        if cur_title or cur_paras or cur_bullets:
            sections.append((cur_title, cur_paras.copy(), cur_bullets.copy()))

    for line in lines:
        stripped = line.strip()
        if not stripped:
            # paragraph break
            if cur_paras and cur_paras[-1] != "":
                cur_paras.append("")
            continue

        # Section header like "KEY FINDINGS:" or "## Key Findings"
        header_match = _STRUCTURED_HEADERS.match(stripped.strip("#").strip())
        if header_match and stripped.endswith(":") or (header_match and stripped.isupper()):
            # new section
            flush()
            cur_title = header_match.group(0).strip().rstrip(":").title()
            cur_paras = []
            cur_bullets = []
            continue

        # Bullet line
        if re.match(r"^[-•*]\s+", stripped):
            cur_bullets.append(re.sub(r"^[-•*]\s+", "", stripped))
            continue

        # Numbered bullet (e.g., "1. something")
        if re.match(r"^\d+\.\s+", stripped):
            cur_bullets.append(re.sub(r"^\d+\.\s+", "", stripped))
            continue

        cur_paras.append(stripped)

    flush()

    # Merge consecutive paragraph lines into paragraphs separated by blanks
    cleaned: list[tuple[str, str, list[str]]] = []
    for title, paras, bullets in sections:
        joined = []
        buf = []
        for p in paras:
            if p == "":
                if buf:
                    joined.append(" ".join(buf))
                    buf = []
            else:
                buf.append(p)
        if buf:
            joined.append(" ".join(buf))
        body_text = "\n\n".join(joined).strip()
        if body_text or bullets:
            cleaned.append((title, body_text, bullets))

    return cleaned


def _extract_prose_summary(text: str, max_chars: int = 420) -> str:
    """Pull the first meaningful paragraph of AI reply for the cover/summary."""
    sections = _split_ai_response(text)
    for _, body, bullets in sections:
        if body:
            first = body.split("\n\n")[0].strip()
            if len(first) > 30:
                return first[:max_chars]
        if bullets:
            return bullets[0][:max_chars]
    raw = _strip_html_like(str(text or "")).strip()
    return raw[:max_chars]


# ─────────────────────────────────────────────────────────────────────────────
# Flowable helpers
# ─────────────────────────────────────────────────────────────────────────────
def _gap(pts: float = 10) -> Spacer:
    return Spacer(1, pts)


def _hr(color=C_HAIRLINE, thickness=0.5, space=6) -> HRFlowable:
    return HRFlowable(width="100%", thickness=thickness, color=color,
                      spaceBefore=space, spaceAfter=space)


def _accent_rule() -> HRFlowable:
    return HRFlowable(width=50, thickness=2, color=C_ACCENT,
                      spaceBefore=0, spaceAfter=14, hAlign="LEFT")


def _quote_box(text: str, styles) -> Table:
    """Blue-bar quote block for the user's question."""
    p = Paragraph(f"&#8220;{_safe_xml(text, max_len=500)}&#8221;", styles["Quote"])
    tbl = Table([[p]], colWidths=[BODY_W])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_QUOTE_BG),
        ("LINEBEFORE",    (0, 0), (0, -1), 3, C_ACCENT),
        ("LEFTPADDING",   (0, 0), (-1, -1), 16),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 14),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    return tbl


# ─────────────────────────────────────────────────────────────────────────────
# Chart export
# ─────────────────────────────────────────────────────────────────────────────
# Bright, print-safe palette for PDF export — each trace gets a distinct color
_EXPORT_PALETTE = ["#2563EB", "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#8B5CF6"]


def _reset_trace_colors_for_light_bg(export_fig):
    """
    Many figures are mutated in-place by the Streamlit renderer to carry the
    dark-theme font/marker colors. When those same figures are exported to PNG
    for the PDF (which is on a white background), the residue can make bars
    look almost black. This function re-applies a bright, distinct color to
    every trace so the export reads clearly on paper.
    """
    for i, trace in enumerate(export_fig.data):
        color = _EXPORT_PALETTE[i % len(_EXPORT_PALETTE)]
        trace_type = (getattr(trace, "type", "") or "").lower()

        if trace_type in ("bar", "histogram"):
            # Replace marker color entirely — ignore any dark-theme leftovers
            trace.update(marker=dict(color=color, line=dict(color="#FFFFFF", width=1)))
            # Ensure any continuous colorscale legacy does not override
            if hasattr(trace, "marker") and trace.marker is not None:
                try:
                    trace.marker.coloraxis = None
                except Exception:
                    pass
            # Outside data labels in a readable color
            if trace_type == "bar":
                try:
                    trace.update(textfont=dict(color="#1F2937", family="Helvetica", size=11))
                except Exception:
                    pass

        elif trace_type in ("scatter", "scattergl"):
            mode = getattr(trace, "mode", "") or ""
            marker_update = dict(color=color, line=dict(color="#FFFFFF", width=1))
            if "markers" in mode:
                # Keep existing marker size if present
                try:
                    existing_size = trace.marker.size if trace.marker is not None else None
                except Exception:
                    existing_size = None
                if existing_size is not None:
                    marker_update["size"] = existing_size
            trace.update(marker=marker_update)
            if "lines" in mode:
                try:
                    width = trace.line.width if trace.line is not None and trace.line.width else 3
                except Exception:
                    width = 3
                trace.update(line=dict(color=color, width=width))

        elif trace_type == "pie":
            # Give each slice its own color from the palette
            trace.update(
                marker=dict(
                    colors=_EXPORT_PALETTE,
                    line=dict(color="#FFFFFF", width=2),
                ),
                textfont=dict(color="#1F2937", family="Helvetica", size=11),
            )

        else:
            # Generic fallback — box, violin, funnel, etc.
            try:
                trace.update(marker=dict(color=color))
            except Exception:
                pass


def _plotly_to_bytes(fig, width: int = 780, height: int = 360) -> Optional[bytes]:
    try:
        # Deep-copy so we never mutate the figure the user is viewing in Streamlit
        export_fig = copy.deepcopy(fig)

        # Flatten to export-friendly light theme and strip dark-mode residue
        export_fig.update_layout(
            template="plotly_white",
            paper_bgcolor="#FFFFFF",
            plot_bgcolor="#FFFFFF",
            font=dict(color="#1F2937", family="Helvetica", size=11),
            title=dict(font=dict(color="#0F172A", family="Helvetica", size=14)),
            legend=dict(
                bgcolor="rgba(255,255,255,0)",
                bordercolor="#E2E8F0",
                borderwidth=1,
                font=dict(color="#1F2937", family="Helvetica", size=10),
            ),
            margin=dict(l=60, r=30, t=50, b=60),
            coloraxis=dict(showscale=False),
        )
        export_fig.update_xaxes(
            gridcolor="#E5E7EB",
            zerolinecolor="#CBD5E1",
            linecolor="#94A3B8",
            tickfont=dict(color="#475569", family="Helvetica", size=10),
            title_font=dict(color="#475569", family="Helvetica", size=11),
        )
        export_fig.update_yaxes(
            gridcolor="#E5E7EB",
            zerolinecolor="#CBD5E1",
            linecolor="#94A3B8",
            tickfont=dict(color="#475569", family="Helvetica", size=10),
            title_font=dict(color="#475569", family="Helvetica", size=11),
        )

        _reset_trace_colors_for_light_bg(export_fig)

        return export_fig.to_image(format="png", width=width, height=height, scale=2)
    except Exception as exc:
        logger.warning("Plotly PNG export failed: %s", exc)
        return None


def _chart_from_dataframe(df, title: str = "") -> Optional[bytes]:
    if not _PLOTLY_OK:
        return None
    try:
        if isinstance(df, pd.Series):
            df = df.reset_index()
            if df.shape[1] == 2:
                df.columns = ["Category", "Value"]

        if not isinstance(df, pd.DataFrame) or df.empty:
            return None

        df = df.copy()
        for bad in ("index", "level_0"):
            if bad in df.columns:
                df = df.drop(columns=[bad])
        if isinstance(df.index, pd.MultiIndex):
            df = df.reset_index()

        import plotly.express as px

        num_cols = df.select_dtypes(include="number").columns.tolist()
        dt_cols  = df.select_dtypes(include=["datetime64"]).columns.tolist()
        cat_cols = [c for c in df.select_dtypes(exclude="number").columns if c not in dt_cols]
        if not num_cols:
            return None

        short_title = (title or "")[:70]

        if dt_cols:
            x, y = dt_cols[0], num_cols[0]
            fig = px.line(df.sort_values(x), x=x, y=y, markers=True,
                          title=short_title,
                          color_discrete_sequence=["#2563EB"])
        elif cat_cols:
            x, y = cat_cols[0], num_cols[0]
            plot_df = df[[x, y]].dropna().copy()
            if len(plot_df) > 14:
                plot_df = plot_df.nlargest(14, y)
            plot_df = plot_df.sort_values(y, ascending=True)
            fig = px.bar(plot_df, x=y, y=x, orientation="h",
                         title=short_title,
                         color_discrete_sequence=["#2563EB"])
            fig.update_traces(texttemplate="%{x:,.0f}", textposition="outside", cliponaxis=False)
        elif len(num_cols) >= 2:
            fig = px.scatter(df, x=num_cols[0], y=num_cols[1],
                             title=short_title,
                             color_discrete_sequence=["#2563EB"])
        else:
            fig = px.histogram(df, x=num_cols[0], title=short_title,
                               color_discrete_sequence=["#2563EB"])

        fig.update_layout(showlegend=False)
        return _plotly_to_bytes(fig)
    except Exception as exc:
        logger.warning("Auto-chart generation failed: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Compact supporting table (only when small & useful)
# ─────────────────────────────────────────────────────────────────────────────
def _compact_table(df, max_rows: int = 6) -> Optional[Table]:
    try:
        if isinstance(df, pd.Series):
            df = df.reset_index()
            if df.shape[1] == 2:
                df.columns = ["Category", "Value"]
        if not isinstance(df, pd.DataFrame) or df.empty:
            return None

        # Only show a table when there are few rows & few columns
        if df.shape[1] > 6:
            return None
        df = df.reset_index(drop=True).head(max_rows)

        headers = [str(c)[:22] for c in df.columns]
        rows: list[list[str]] = []
        for _, r in df.iterrows():
            cells = []
            for v in r.values:
                if isinstance(v, float) and pd.notna(v):
                    cells.append(f"{v:,.2f}")
                elif isinstance(v, int):
                    cells.append(f"{v:,}")
                else:
                    cells.append(str(v)[:30])
            rows.append(cells)

        data = [headers] + rows
        n = len(headers)
        cw = BODY_W / n

        tbl = Table(data, colWidths=[cw] * n, repeatRows=1)
        cmds = [
            ("BACKGROUND",    (0, 0), (-1, 0),  C_TH_BG),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, 0),  8.5),
            ("BOTTOMPADDING", (0, 0), (-1, 0),  7),
            ("TOPPADDING",    (0, 0), (-1, 0),  7),
            ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE",      (0, 1), (-1, -1), 9),
            ("TEXTCOLOR",     (0, 1), (-1, -1), C_BODY),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
            ("TOPPADDING",    (0, 1), (-1, -1), 5),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("LINEBELOW",     (0, 0), (-1, 0),  1, C_ACCENT),
            ("LINEBELOW",     (0, -1), (-1, -1), 0.25, C_HAIRLINE),
        ]
        for i in range(1, len(data)):
            if i % 2 == 0:
                cmds.append(("BACKGROUND", (0, i), (-1, i), C_ROW_ALT))
        for j, col in enumerate(df.columns):
            align = "RIGHT" if pd.api.types.is_numeric_dtype(df[col]) else "LEFT"
            cmds.append(("ALIGN", (j, 0), (j, -1), align))
        tbl.setStyle(TableStyle(cmds))
        return tbl
    except Exception as exc:
        logger.warning("Compact table build failed: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Cover page
# ─────────────────────────────────────────────────────────────────────────────
def _build_cover(elements, styles, timestamp: str, n_analyses: int,
                 dataset_name: str, user_name: str, overview_text: str,
                 toc_entries: list[str]):
    elements.append(_gap(1.0 * inch))
    elements.append(Paragraph("APEX ANALYTICS", styles["CoverEyebrow"]))
    elements.append(Paragraph("AI-Assisted Executive Report", styles["CoverTitle"]))
    elements.append(Paragraph(
        "A narrative briefing compiled from this session's AI analyses.",
        styles["CoverSub"],
    ))
    elements.append(HRFlowable(width="30%", thickness=2, color=C_ACCENT,
                               spaceBefore=0, spaceAfter=22, hAlign="CENTER"))

    # Metadata card
    meta_rows = [
        ["Prepared for",  user_name or "—"],
        ["Dataset",       dataset_name or "—"],
        ["Generated",     timestamp],
        ["Analyses",      str(n_analyses)],
        ["Classification","Confidential"],
    ]
    labels = [Paragraph(r[0], styles["CoverLabel"]) for r in meta_rows]
    values = [Paragraph(_safe_xml(r[1], max_len=100), styles["CoverValue"]) for r in meta_rows]
    meta_tbl = Table(
        [[labels[i], values[i]] for i in range(len(meta_rows))],
        colWidths=[1.6 * inch, BODY_W - 1.6 * inch],
    )
    meta_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, C_HAIRLINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(meta_tbl)
    elements.append(_gap(28))

    # Overview paragraph (short)
    if overview_text:
        elements.append(Paragraph("AT A GLANCE", styles["Eyebrow"]))
        elements.append(_accent_rule())
        elements.append(Paragraph(_safe_xml(overview_text, max_len=600), styles["Body"]))
        elements.append(_gap(20))

    # TOC
    if toc_entries:
        elements.append(Paragraph("CONTENTS", styles["Eyebrow"]))
        elements.append(_accent_rule())
        for entry in toc_entries:
            elements.append(Paragraph(entry, styles["TOCItem"]))


# ─────────────────────────────────────────────────────────────────────────────
# Executive summary (prose from AI responses)
# ─────────────────────────────────────────────────────────────────────────────
def _build_executive_summary(elements, history: list, styles):
    elements.append(PageBreak())
    elements.append(Paragraph("Executive Summary", styles["H1"]))
    elements.append(_accent_rule())

    n = len(history)
    label = "analyses" if n != 1 else "analysis"
    intro = (
        f"This report consolidates <b>{n}</b> AI-assisted {label} performed against the "
        "active dataset. Each section below presents the original question, the AI "
        "analyst's written response, and — where relevant — a supporting visualization "
        "and a compact summary table. Findings are summarised in prose rather than as "
        "raw data dumps, so the document can be read end-to-end without switching context."
    )
    elements.append(Paragraph(intro, styles["Body"]))
    elements.append(_gap(8))

    # Key takeaways, pulled from the first paragraph of each AI response
    takeaways: list[str] = []
    seen: set[str] = set()
    for entry in history:
        candidate = _extract_prose_summary(entry.get("ai_response") or entry.get("insight") or "")
        if not candidate:
            continue
        key = candidate.lower()[:100]
        if key in seen:
            continue
        seen.add(key)
        takeaways.append(candidate)

    if takeaways:
        elements.append(Paragraph("Key Takeaways", styles["H2"]))
        for t in takeaways[:5]:
            elements.append(Paragraph(
                f'<font color="{HX_ACCENT}">&#9679;</font>&#160;&#160;{_safe_xml(t, max_len=500)}',
                styles["BulletItem"],
            ))
        elements.append(_gap(6))


# ─────────────────────────────────────────────────────────────────────────────
# Analysis section (narrative)
# ─────────────────────────────────────────────────────────────────────────────
def _render_ai_sections(sections: list[tuple[str, str, list[str]]], styles) -> list:
    """Turn parsed AI response into a list of flowables."""
    out: list = []
    for title, body, bullets in sections:
        if title:
            out.append(Paragraph(title, styles["H2"]))
        if body:
            for para in body.split("\n\n"):
                para = para.strip()
                if not para:
                    continue
                out.append(Paragraph(_safe_xml(para, max_len=2400), styles["Body"]))
        for b in bullets:
            out.append(Paragraph(
                f'<font color="{HX_ACCENT}">&#9679;</font>&#160;&#160;{_safe_xml(b, max_len=600)}',
                styles["BulletItem"],
            ))
        if not body and not bullets and not title:
            continue
        out.append(_gap(4))
    return out


def _build_analysis_section(elements, entry: dict, num: int, styles):
    query     = str(entry.get("query") or "N/A")
    ai_resp   = str(entry.get("ai_response") or "").strip()
    insight   = str(entry.get("insight") or "").strip()
    charts    = entry.get("charts") or []
    dataframe = entry.get("result")

    # Section title + rule
    elements.append(Paragraph(f"Analysis {num:02d}", styles["Eyebrow"]))
    short_q = re.sub(r"\s+", " ", query).strip()[:90]
    elements.append(Paragraph(_safe_xml(short_q, max_len=160), styles["H1"]))
    elements.append(_accent_rule())

    # Question quote
    elements.append(_quote_box(query, styles))

    # AI response as prose
    sections = _split_ai_response(ai_resp)
    if not sections and insight:
        sections = [("Key Finding", insight, [])]

    if sections:
        elements.append(Paragraph("AI ANALYST RESPONSE", styles["Eyebrow"]))
        for fl in _render_ai_sections(sections, styles):
            elements.append(fl)
        elements.append(_gap(4))
    else:
        elements.append(Paragraph(
            "No AI narrative was captured for this question. Only the raw result is available.",
            styles["Small"],
        ))

    # Supporting chart (small, centered with caption)
    img_bytes: Optional[bytes] = None
    for item in charts:
        fig = item.get("figure") if isinstance(item, dict) else item
        if fig is None:
            continue
        img_bytes = _plotly_to_bytes(fig)
        if img_bytes:
            break
    if not img_bytes and isinstance(dataframe, (pd.DataFrame, pd.Series)):
        img_bytes = _chart_from_dataframe(dataframe, title=query[:60])

    if img_bytes:
        elements.append(Paragraph("SUPPORTING VISUAL", styles["Eyebrow"]))
        img_w = BODY_W * 0.82
        img_h = img_w * (360 / 780)
        img = Image(BytesIO(img_bytes), width=img_w, height=img_h)
        img.hAlign = "CENTER"
        elements.append(img)
        elements.append(Paragraph(
            f"Figure {num}. Visual summary of results for this question.",
            styles["Caption"],
        ))

    # Compact supporting table (only if small)
    if isinstance(dataframe, (pd.DataFrame, pd.Series)):
        tbl = _compact_table(dataframe, max_rows=6)
        if tbl is not None:
            elements.append(Paragraph("REFERENCE DATA", styles["Eyebrow"]))
            elements.append(tbl)
            n_rows = len(dataframe) if hasattr(dataframe, "__len__") else 0
            if isinstance(n_rows, int) and n_rows > 6:
                elements.append(Paragraph(
                    f"Showing top 6 of {n_rows:,} rows.",
                    styles["Small"],
                ))
            elements.append(_gap(4))


# ─────────────────────────────────────────────────────────────────────────────
# Disclaimer
# ─────────────────────────────────────────────────────────────────────────────
def _build_disclaimer(elements, styles, timestamp: str):
    elements.append(PageBreak())
    elements.append(_gap(0.5 * inch))
    elements.append(Paragraph("Disclaimer", styles["H1"]))
    elements.append(_accent_rule())
    elements.append(Paragraph(
        "This document was produced by the Apex Analytics AI assistant. All narrative "
        "content, findings, and supporting visualizations were generated from automated "
        "analysis of the dataset the user supplied during the session. While the system "
        "performs validation and sanity checks, AI-generated insights should always be "
        "reviewed and corroborated by a qualified domain expert before being used to "
        "drive strategic decisions. Past patterns in the data do not guarantee future "
        "outcomes.",
        styles["Body"],
    ))
    elements.append(_gap(16))
    elements.append(Paragraph(
        f"Generated {timestamp} &nbsp;·&nbsp; Apex Analytics",
        styles["Small"],
    ))


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────
def generate_pdf(
    query=None,
    summary_text=None,
    dataframe=None,
    charts=None,
    analysis_history=None,
    dataset_name: str | None = None,
    user_name: str | None = None,
) -> str:
    """
    Generate a narrative-first PDF report.

    - Pass `analysis_history` (list of dicts) for a multi-analysis document.
    - Or pass `query` + `summary_text` + `dataframe` for a single-query report.
    Returns the path of the written PDF.
    """
    file_path = "AI_Executive_Report.pdf"
    timestamp = datetime.now().strftime("%B %d, %Y · %H:%M")

    # Resolve defaults from session state if available
    if dataset_name is None or user_name is None:
        try:
            import streamlit as st
            if dataset_name is None:
                dataset_name = st.session_state.get("dataset_name", "Active Dataset")
            if user_name is None:
                user_name = st.session_state.get("auth_display_name", "Apex Analytics User")
        except Exception:
            dataset_name = dataset_name or "Active Dataset"
            user_name = user_name or "Apex Analytics User"

    logger.info(
        "Generating narrative PDF: history_len=%s single=%s",
        len(analysis_history or []),
        query is not None,
    )

    doc = SimpleDocTemplate(
        file_path,
        pagesize=A4,
        topMargin=TOP_MARGIN,
        bottomMargin=BOTTOM_MARGIN,
        leftMargin=LEFT_MARGIN,
        rightMargin=RIGHT_MARGIN,
        title="Apex Analytics – Executive Report",
        author="Apex Analytics",
    )

    styles   = _build_styles()
    elements: list = []

    # Normalise history
    history: list[dict] = list(analysis_history or [])
    if not history and query is not None:
        history = [{
            "query": query,
            "ai_response": summary_text or "",
            "insight": summary_text or "",
            "result": dataframe,
            "charts": charts or [],
            "summary": [],
        }]

    n = len(history)

    # Build overview text from first AI response
    overview = ""
    for e in history:
        overview = _extract_prose_summary(e.get("ai_response") or e.get("insight") or "")
        if overview:
            break

    # TOC entries
    toc_entries = []
    for i, e in enumerate(history, 1):
        q = _safe_xml(str(e.get("query", ""))[:80], max_len=100)
        toc_entries.append(
            f'<font color="{HX_ACCENT}"><b>{i:02d}.</b></font>&#160;&#160;{q}'
        )

    # ── Cover ─────────────────────────────────────────────────────────────────
    _build_cover(elements, styles, timestamp, n, dataset_name, user_name,
                 overview, toc_entries)

    if n == 0:
        elements.append(PageBreak())
        elements.append(Paragraph("No Analyses Recorded", styles["H1"]))
        elements.append(_accent_rule())
        elements.append(Paragraph(
            "No AI analyses were captured in this session. Ask a question in the "
            "AI Analyst workspace to start building your report.",
            styles["Body"],
        ))
    else:
        _build_executive_summary(elements, history, styles)

        for i, entry in enumerate(history, 1):
            elements.append(PageBreak())
            try:
                _build_analysis_section(elements, entry, i, styles)
            except Exception as exc:
                logger.error("Failed to build analysis section %s: %s", i, exc)
                elements.append(Paragraph(
                    f"Analysis {i} could not be rendered: {_safe_xml(str(exc)[:200])}",
                    styles["Body"],
                ))

    _build_disclaimer(elements, styles, timestamp)

    doc.build(elements, onFirstPage=_decorate_cover, onLaterPages=_decorate_page)
    logger.info("PDF saved: %s", os.path.abspath(file_path))
    return file_path
