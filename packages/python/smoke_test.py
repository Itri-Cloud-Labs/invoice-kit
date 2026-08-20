from __future__ import annotations

from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

from invoice_kit import (
    Issuer,
    LineItemInput,
    Locale,
    Party,
    create_delivery_note,
    create_invoice,
    create_price_request,
    create_purchase_order,
    create_quote,
    create_return_note,
)


def main() -> None:
    factories = {
        "invoice": create_invoice,
        "quote": create_quote,
        "purchase-order": create_purchase_order,
        "delivery-note": create_delivery_note,
        "return-note": create_return_note,
        "price-request": create_price_request,
    }
    quantity_only = {"delivery-note", "return-note", "price-request"}
    with TemporaryDirectory() as directory:
        for name, factory in factories.items():
            item = LineItemInput(
                name="خدمة استشارية" if name == "price-request" else "Service de conseil",
                quantity=2,
                price=None if name in quantity_only else 1000,
            )
            document = factory(
                number=f"SMOKE-{name}",
                issuer=Issuer(name="IC Labs SARL"),
                client=Party(name="Client Demo"),
                items=[item],
                issue_date=date(2026, 8, 20),
                currency="MAD",
                locale=Locale.AR_MA if name == "price-request" else Locale.FR_MA,
            )
            output = Path(directory, f"{name}.pdf")
            pdf = document.to_pdf(output)
            if not pdf.startswith(b"%PDF-") or output.read_bytes() != pdf:
                raise RuntimeError(f"{name} did not produce a valid PDF")
    print("Generated all six Python document types.")


if __name__ == "__main__":
    main()
