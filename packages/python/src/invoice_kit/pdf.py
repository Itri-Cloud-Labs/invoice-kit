from __future__ import annotations

import io
import tempfile
from contextlib import ExitStack
from dataclasses import asdict
from datetime import date, datetime
from importlib.resources import as_file, files
from pathlib import Path
from typing import Any, cast

import httpx
from fpdf import FPDF
from fpdf.enums import MethodReturnValue, XPos, YPos
from PIL import Image, UnidentifiedImageError

from .locales import LABELS
from .models import (
    BusinessDocumentData,
    InternationalBankInfo,
    Locale,
    PdfFonts,
    PdfSpacing,
)
from .validation import QUANTITY_ONLY_TYPES, validate_spacing

PAGE_WIDTH = 595.28
PAGE_HEIGHT = 841.89
MARGIN = 48.0
CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN - 8
DEFAULT_COLORS = {
    "primary": "#173d73",
    "on_primary": "#ffffff",
    "text": "#111827",
    "meta_text": "#4b5563",
    "muted_text": "#6b7280",
    "border": "#d1d5db",
    "footer_text": "#9ca3af",
}
DEFAULT_SPACING = {
    "issuer_name_to_details": 10.0,
    "title_to_metadata": 10.0,
    "metadata_row_gap": 7.0,
    "header_to_parties": 30.0,
    "party_label_to_details": 22.0,
    "parties_to_table": 24.0,
    "header_to_table": 20.0,
    "table_to_summary": 20.0,
    "bank_label_to_details": 18.0,
    "bank_to_notes": 16.0,
    "notes_label_to_details": 18.0,
    "detail_line_gap": 2.0,
    "table_header_height": 28.0,
    "table_row_min_height": 30.0,
    "table_row_vertical_padding": 16.0,
    "table_text_top_padding": 9.0,
    "summary_row_height": 26.0,
    "summary_bottom_gap": 16.0,
}


def _rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    if len(value) == 3:
        value = "".join(char * 2 for char in value)
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))  # type: ignore[return-value]


def _format_date(value: date | datetime) -> str:
    return value.strftime("%d/%m/%Y")


def _format_number(value: float) -> str:
    return f"{value:,.2f}".replace(",", " ")


def _format_money(value: float, currency: str) -> str:
    return f"{_format_number(value)} {currency}"


def _party_lines(party: Any, labels: dict[str, str], include_name: bool = True) -> list[str]:
    if party is None:
        return []
    lines = [party.name or ""] if include_name else []
    lines.extend(party.address_lines or [])
    lines.extend(
        value
        for value in (
            ", ".join(filter(None, (party.city, party.country))),
            f"Tel: {party.phone}" if party.phone else "",
            f"Email: {party.email}" if party.email else "",
            f"{labels['if']}: {party.tax_id}" if party.tax_id else "",
            f"{labels['ice']}: {party.ice}" if party.ice else "",
            f"{labels['if']}: {party.if_number}" if party.if_number else "",
            f"{labels['rc']}: {party.rc}" if party.rc else "",
        )
        if value
    )
    return [line for line in lines if line]


def _font_file(source: str | Path | bytes, stack: ExitStack) -> str:
    if isinstance(source, bytes):
        with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as handle:
            handle.write(source)
            path = handle.name
        stack.callback(Path(path).unlink, missing_ok=True)
        return path
    return str(source)


def _load_logo(url: str) -> io.BytesIO:
    try:
        response = httpx.get(url, follow_redirects=True, timeout=15.0)
        response.raise_for_status()
    except httpx.HTTPError as error:
        status = (
            error.response.status_code
            if isinstance(error, httpx.HTTPStatusError)
            else "network error"
        )
        raise ValueError(f"Unable to fetch logo from {url}: {status}") from error
    data = response.content
    content_type = response.headers.get("content-type", "").lower()
    if content_type.startswith("image/svg") or data.lstrip().startswith(b"<svg"):
        return io.BytesIO(data)
    try:
        image = Image.open(io.BytesIO(data))
        if image.format not in {"PNG", "JPEG", "WEBP"}:
            raise UnidentifiedImageError
        output = io.BytesIO()
        image.convert("RGBA" if image.mode in {"RGBA", "LA"} else "RGB").save(output, "PNG")
        output.seek(0)
        return output
    except (UnidentifiedImageError, OSError) as error:
        raise ValueError(
            f"Unsupported logo format at {url}. Remote logos support PNG, JPEG, SVG, and WEBP."
        ) from error


def _text_height(pdf: FPDF, text: str, width: float, line_height: float = 12) -> float:
    lines = cast(
        list[str],
        pdf.multi_cell(
            width,
            line_height,
            text,
            dry_run=True,
            output=MethodReturnValue.LINES,
        ),
    )
    return max(line_height, len(lines) * line_height)


def _draw_text(
    pdf: FPDF,
    text: str,
    x: float,
    y: float,
    width: float,
    *,
    align: str = "L",
    line_height: float = 12,
) -> float:
    pdf.set_xy(x, y)
    pdf.multi_cell(
        width,
        line_height,
        text,
        align=align,
        new_x=XPos.LEFT,
        new_y=YPos.NEXT,
    )
    return y + _text_height(pdf, text, width, line_height)


def render_document_pdf(
    document: BusinessDocumentData,
    *,
    fonts: PdfFonts | None = None,
    spacing: PdfSpacing | None = None,
) -> bytes:
    spacing_values = asdict(spacing) if spacing else {}
    validate_spacing(spacing_values)
    resolved_spacing: dict[str, float] = {
        **DEFAULT_SPACING,
        **{k: v for k, v in spacing_values.items() if v is not None},
    }
    if document.type in QUANTITY_ONLY_TYPES:
        if not spacing or spacing.header_to_parties is None:
            resolved_spacing["header_to_parties"] = 34.0
        if not spacing or spacing.header_to_table is None:
            resolved_spacing["header_to_table"] = 24.0
    colors = {**DEFAULT_COLORS}
    if document.colors:
        colors.update({key: value for key, value in asdict(document.colors).items() if value})
    labels = LABELS[document.locale]
    rtl = document.locale is Locale.AR_MA
    align = "R" if rtl else "L"
    quantity_only = document.type in QUANTITY_ONLY_TYPES
    table_width = PAGE_WIDTH - MARGIN * 2

    pdf = FPDF(unit="pt", format="A4")
    pdf.set_margins(MARGIN, MARGIN, MARGIN)
    pdf.set_auto_page_break(False)
    pdf.set_title(" ".join(filter(None, (document.title, document.number))))
    pdf.set_author(document.issuer.name if document.issuer and document.issuer.name else "")

    with ExitStack() as stack:
        regular_source = fonts.regular if fonts and fonts.regular else None
        bold_source = fonts.bold if fonts and fonts.bold else None
        if regular_source is None or bold_source is None:
            regular_resource = files("invoice_kit.fonts").joinpath("DejaVuSans.ttf")
            bold_resource = files("invoice_kit.fonts").joinpath("DejaVuSans-Bold.ttf")
            regular_path = str(stack.enter_context(as_file(regular_resource)))
            bold_path = str(stack.enter_context(as_file(bold_resource)))
        else:
            regular_path = _font_file(regular_source, stack)
            bold_path = _font_file(bold_source, stack)
        if regular_source is not None and bold_source is None:
            regular_path = _font_file(regular_source, stack)
            bold_path = regular_path
        elif bold_source is not None and regular_source is None:
            bold_path = _font_file(bold_source, stack)
            regular_path = bold_path
        pdf.add_font("InvoiceKit", "", regular_path)
        pdf.add_font("InvoiceKit", "B", bold_path)
        pdf.set_text_shaping(True, direction="rtl" if rtl else "ltr")
        pdf.add_page()

        def font(size: float, bold: bool = False, color: str = "text") -> None:
            pdf.set_font("InvoiceKit", "B" if bold else "", size)
            pdf.set_text_color(*_rgb(colors[color]))

        def add_page() -> None:
            pdf.add_page()

        logo = (
            _load_logo(document.issuer.logo) if document.issuer and document.issuer.logo else None
        )
        if logo:
            fit = 80 if quantity_only else 72
            pdf.image(logo, MARGIN, 42, w=fit, h=fit, keep_aspect_ratio=True)
        issuer_x = MARGIN + (92 if logo else 0)
        issuer_width = 148 if logo else 240
        issuer_bottom = 42.0
        if document.issuer and document.issuer.name:
            font(17, True, "primary")
            issuer_bottom = _draw_text(
                pdf,
                document.issuer.name,
                issuer_x,
                43 if not quantity_only else 45,
                issuer_width,
                align=align,
                line_height=19,
            )
        issuer_lines = _party_lines(document.issuer, labels, include_name=False)
        if issuer_lines:
            font(9)
            issuer_bottom = _draw_text(
                pdf,
                "\n".join(issuer_lines),
                issuer_x,
                issuer_bottom + resolved_spacing["issuer_name_to_details"],
                issuer_width,
                align=align,
                line_height=11 + resolved_spacing["detail_line_gap"],
            )

        right_x, column_width = MARGIN + 275, 224.0
        title_bottom = 42.0
        if document.title:
            font(20, True)
            title_bottom = _draw_text(
                pdf, document.title, right_x, 42, column_width, align=align, line_height=23
            )
        meta_y = title_bottom + (resolved_spacing["title_to_metadata"] if document.title else 0)
        font(9, color="meta_text")
        metadata: list[str] = []
        if document.number:
            metadata.append(f"{labels['number']}: {document.number}")
        if document.issue_date:
            metadata.append(f"{labels['issue_date']}: {_format_date(document.issue_date)}")
        if document.due_date:
            metadata.append(f"{labels['due_date']}: {_format_date(document.due_date)}")
        if document.currency and not quantity_only:
            metadata.append(f"{labels['currency']}: {document.currency}")
        meta_bottom = meta_y
        for text in metadata:
            meta_bottom = _draw_text(pdf, text, right_x, meta_bottom, column_width, align=align)
            meta_bottom += resolved_spacing["metadata_row_gap"]

        header_bottom = max(issuer_bottom, meta_bottom, 114 if quantity_only else 90)
        seller_lines = _party_lines(document.seller, labels)
        client_lines = _party_lines(document.client, labels)
        y = header_bottom + resolved_spacing["header_to_table"]
        if seller_lines or client_lines:
            y = header_bottom + resolved_spacing["header_to_parties"]
            bottoms = [y]
            for x, heading, lines in (
                (MARGIN, labels["seller"], seller_lines),
                (right_x, labels["client"], client_lines),
            ):
                if lines:
                    font(10, True, "muted_text")
                    _draw_text(pdf, heading, x, y, column_width, align=align)
                    font(9)
                    bottoms.append(
                        _draw_text(
                            pdf,
                            "\n".join(lines),
                            x,
                            y + resolved_spacing["party_label_to_details"],
                            column_width,
                            align=align,
                            line_height=11 + resolved_spacing["detail_line_gap"],
                        )
                    )
            y = max(bottoms) + resolved_spacing["parties_to_table"]

        header_height = resolved_spacing["table_header_height"]
        row_min = resolved_spacing["table_row_min_height"]
        row_padding = resolved_spacing["table_row_vertical_padding"]
        row_text_top = resolved_spacing["table_text_top_padding"]
        if quantity_only:
            columns = [(12, 350, "item", align), (400, 87, "quantity", "R")]
        else:
            columns = [
                (12, 220, "item", align),
                (240, 45, "quantity", "R"),
                (300, 78, "unit_price", "R"),
                (392, 95, "amount", "R"),
            ]

        def table_header(top: float) -> float:
            pdf.set_fill_color(*_rgb(colors["primary"]))
            pdf.rect(MARGIN, top, table_width, header_height, style="F")
            font(10, True, "on_primary")
            for offset, width, label, cell_align in columns:
                _draw_text(pdf, labels[label], MARGIN + offset, top + 8, width, align=cell_align)
            return top + header_height

        if document.items:
            if y + header_height > CONTENT_BOTTOM:
                add_page()
                y = MARGIN
            y = table_header(y)
            for item in document.items:
                item_label = item.name + (f" - {item.description}" if item.description else "")
                quantity = f"{item.quantity:g}" + (f" {item.unit}" if item.unit else "")
                font(10)
                row_height = max(
                    row_min,
                    _text_height(pdf, item_label, columns[0][1], 12) + row_padding,
                    _text_height(pdf, quantity, columns[1][1], 12) + row_padding,
                )
                if y + row_height > CONTENT_BOTTOM:
                    add_page()
                    y = table_header(MARGIN)
                pdf.set_draw_color(*_rgb(colors["border"]))
                pdf.rect(MARGIN, y, table_width, row_height)
                values = [item_label, quantity]
                if not quantity_only:
                    currency = document.currency or "MAD"
                    values.extend(
                        (
                            _format_money(item.unit_price, currency),
                            _format_money(item.line_total, currency),
                        )
                    )
                for (offset, width, _, cell_align), value in zip(columns, values, strict=True):
                    _draw_text(
                        pdf, value, MARGIN + offset, y + row_text_top, width, align=cell_align
                    )
                y += row_height

        notes: list[str] = []
        if not quantity_only and document.payment_terms:
            notes.append(f"{labels['payment_terms']}: {document.payment_terms.label}")
            if document.payment_terms.notes:
                notes.append(document.payment_terms.notes)
        if document.notes:
            notes.append(f"{labels['notes']}: {document.notes}")
        bank_lines: list[str] = []
        if not quantity_only and document.bank_info:
            bank = document.bank_info
            bank_lines = [
                f"{labels['bank_name']}: {bank.bank_name}",
                f"{labels['holder_name']}: {bank.holder_name}",
            ]
            if isinstance(bank, InternationalBankInfo):
                bank_lines.extend(
                    (f"{labels['swift_code']}: {bank.swift_code}", f"{labels['iban']}: {bank.iban}")
                )
            else:
                bank_lines.append(f"{labels['rib']}: {bank.rib}")

        trailing_y = y + resolved_spacing["table_to_summary"]
        detail_height = (len(bank_lines) + len(notes) + 3) * 13 if bank_lines or notes else 0
        totals_height = resolved_spacing["summary_row_height"] * 5 if document.totals else 0
        if trailing_y + max(detail_height, totals_height) > CONTENT_BOTTOM:
            add_page()
            trailing_y = MARGIN
        left_width = table_width - 236
        left_y = trailing_y
        if bank_lines:
            font(9, True, "muted_text")
            _draw_text(pdf, labels["bank_details"], MARGIN, left_y, left_width, align=align)
            left_y += resolved_spacing["bank_label_to_details"]
            font(9)
            left_y = _draw_text(
                pdf, "\n".join(bank_lines), MARGIN, left_y, left_width, align=align, line_height=13
            )
        if notes:
            if bank_lines:
                left_y += resolved_spacing["bank_to_notes"]
            font(10, True, "muted_text")
            _draw_text(pdf, labels["notes"], MARGIN, left_y, left_width, align=align)
            left_y += resolved_spacing["notes_label_to_details"]
            font(9)
            _draw_text(
                pdf, "\n".join(notes), MARGIN, left_y, left_width, align=align, line_height=12
            )

        if document.totals:
            currency = document.currency or "MAD"
            totals: tuple[tuple[str, float], ...] = (
                (labels["subtotal"], document.totals.subtotal),
                (labels["discount"], document.totals.discount_total),
                (labels["taxable_base"], document.totals.taxable_base),
                (
                    f"{labels['vat']} ({(document.vat_rate or 0) * 100:.0f}%)",
                    document.totals.vat_amount,
                ),
                (labels["total"], document.totals.total),
            )
            total_x, total_y = PAGE_WIDTH - MARGIN - 220, trailing_y
            row_height = resolved_spacing["summary_row_height"]
            for index, (total_label, amount) in enumerate(totals):
                final = index == len(totals) - 1
                pdf.set_fill_color(*_rgb(colors["primary"] if final else "#ffffff"))
                pdf.set_draw_color(*_rgb(colors["border"]))
                pdf.rect(total_x, total_y, 220, row_height, style="DF")
                font(10, final, "on_primary" if final else "text")
                _draw_text(pdf, total_label, total_x + 10, total_y + 8, 105)
                _draw_text(
                    pdf, _format_money(amount, currency), total_x + 120, total_y + 8, 90, align="R"
                )
                total_y += row_height

        footer = "\n".join(line.strip() for line in (document.footer or "").splitlines())
        if not footer:
            footer = " ".join(filter(None, (document.title, document.number)))
        if footer:
            font(8, color="footer_text")
            footer_height = _text_height(pdf, footer, table_width, 10)
            _draw_text(
                pdf,
                footer,
                MARGIN,
                PAGE_HEIGHT - footer_height,
                table_width,
                align="C",
                line_height=10,
            )
        return bytes(pdf.output())
