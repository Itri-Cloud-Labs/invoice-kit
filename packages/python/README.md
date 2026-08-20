# Invoice Kit for Python

Typed Python library for generating Moroccan invoices, quotes, purchase orders, delivery
notes, return notes, and price requests as PDFs.

## Installation

```bash
pip install ic-labs-invoice-kit
```

## Quick start

```python
from invoice_kit import Issuer, LineItemInput, Party, create_invoice

invoice = create_invoice(
    title="Facture",
    number="FAC-2026-0001",
    issuer=Issuer(name="IC Labs SARL"),
    client=Party(name="Client Demo"),
    items=[LineItemInput(name="Service de conseil", quantity=1, price=1000)],
    currency="MAD",
    vat_rate=0.2,
)

invoice.to_pdf("invoice.pdf")
```

Factories use keyword arguments and require typed dataclasses for nested values. The public
factories are `create_invoice`, `create_quote`, `create_purchase_order`,
`create_delivery_note`, `create_return_note`, and `create_price_request`.

Each factory returns a `BusinessDocument` with:

- `to_dict()` for snake-case data
- `to_json()` for UTF-8-safe JSON with ISO-8601 dates
- `to_pdf()` for PDF bytes, with an optional output path, custom fonts, and spacing overrides

French (`Locale.FR_MA`) is the default. Use `Locale.AR_MA` for Arabic labels and shaped
right-to-left text. Delivery notes, return notes, and price requests accept quantity-only
items and omit prices, discounts, VAT, totals, payment terms, and bank details from PDFs.

## Development

```bash
uv sync --frozen
uv run ruff check .
uv run mypy src
uv run pytest
uv run python smoke_test.py
uv build
```

## Releasing

Update the version in `pyproject.toml` and add its section to `CHANGELOG.md`. After merging
to `main`, push `python-v<version>`. The tag workflow verifies, builds, publishes to PyPI
through trusted publishing, and creates the matching GitHub Release.
