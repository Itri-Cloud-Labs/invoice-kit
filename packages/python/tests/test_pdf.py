from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from threading import Thread

import pytest
from PIL import Image
from pypdf import PdfReader

from invoice_kit import (
    DocumentColors,
    Issuer,
    LineItemInput,
    Locale,
    Party,
    PdfFonts,
    PdfSpacing,
    create_delivery_note,
    create_invoice,
    create_price_request,
)


def text_from(pdf: bytes) -> str:
    reader = PdfReader(__import__("io").BytesIO(pdf))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


@contextmanager
def logo_server(payload: bytes, content_type: str) -> Iterator[str]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, format: str, *args: object) -> None:
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/logo"
    finally:
        server.shutdown()
        thread.join()


def test_invoice_pdf_contains_expected_sections() -> None:
    document = create_invoice(
        title="Facture Test",
        number="FAC-1",
        issuer=Issuer(name="IC Labs"),
        client=Party(name="Client Demo"),
        items=[LineItemInput("Consulting", 2, price=1000)],
        currency="MAD",
        colors=DocumentColors(primary="#7c3aed"),
    )
    output = document.to_pdf()
    assert output.startswith(b"%PDF-")
    text = text_from(output)
    assert "Facture Test" in text
    assert "Consulting" in text
    assert "Total TTC" in text


def test_quantity_only_pdf_omits_financial_sections() -> None:
    output = create_delivery_note(
        title="Bon de livraison",
        items=[LineItemInput("Boxes", 3, price=99)],
        currency="MAD",
    ).to_pdf()
    text = text_from(output)
    assert "Boxes" in text
    assert "Prix unitaire" not in text
    assert "Total TTC" not in text
    assert "MAD" not in text


def test_arabic_pdf_uses_bundled_shaped_font() -> None:
    output = create_price_request(
        locale=Locale.AR_MA,
        items=[LineItemInput("خدمة استشارية", 1)],
    ).to_pdf()
    assert output.startswith(b"%PDF-")
    assert len(output) > 10_000


@pytest.mark.parametrize("image_format", ["PNG", "JPEG", "WEBP"])
def test_remote_raster_logo_formats(image_format: str) -> None:
    image = Image.new("RGB", (24, 24), "blue")
    payload = BytesIO()
    image.save(payload, image_format)
    with logo_server(payload.getvalue(), f"image/{image_format.lower()}") as url:
        assert create_invoice(issuer=Issuer(name="Logo", logo=url)).to_pdf().startswith(b"%PDF-")


def test_remote_svg_logo() -> None:
    svg = (
        b'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">'
        b'<rect width="24" height="24" fill="blue"/></svg>'
    )
    with logo_server(svg, "image/svg+xml") as url:
        assert create_invoice(issuer=Issuer(name="Logo", logo=url)).to_pdf().startswith(b"%PDF-")


def test_unsupported_remote_logo_fails_clearly() -> None:
    with (
        logo_server(b"not-an-image", "application/octet-stream") as url,
        pytest.raises(ValueError, match="Unsupported logo format"),
    ):
        create_invoice(issuer=Issuer(logo=url)).to_pdf()


def test_long_tables_paginate_and_repeat_headers() -> None:
    items = [
        LineItemInput(f"Long consulting service item {index} " * 4, 1, price=10)
        for index in range(50)
    ]
    output = create_invoice(items=items).to_pdf()
    reader = PdfReader(__import__("io").BytesIO(output))
    assert len(reader.pages) > 1
    for page in reader.pages:
        assert "Article" in (page.extract_text() or "")


def test_output_path_spacing_and_custom_font(tmp_path: Path) -> None:
    bundled = Path(__file__).parents[1] / "src/invoice_kit/fonts/DejaVuSans.ttf"
    output_path = tmp_path / "invoice.pdf"
    output = create_invoice(title="Custom", footer="Line one\nLine two").to_pdf(
        output_path,
        fonts=PdfFonts(regular=bundled),
        spacing=PdfSpacing(header_to_table=40),
    )
    assert output_path.read_bytes() == output
    assert "Line two" in text_from(output)


@pytest.mark.parametrize("value", [-1, float("inf")])
def test_spacing_rejects_invalid_values(value: float) -> None:
    with pytest.raises(ValueError, match=r"spacing\.header_to_table"):
        create_invoice().to_pdf(spacing=PdfSpacing(header_to_table=value))
