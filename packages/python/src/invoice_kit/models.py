from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from pathlib import Path
from typing import TypeAlias


class DocumentType(str, Enum):
    INVOICE = "invoice"
    QUOTE = "quote"
    PURCHASE_ORDER = "purchase_order"
    DELIVERY_NOTE = "delivery_note"
    RETURN_NOTE = "return_note"
    PRICE_REQUEST = "price_request"


class Locale(str, Enum):
    FR_MA = "fr-MA"
    AR_MA = "ar-MA"


class DiscountType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"


DateValue: TypeAlias = date | datetime
FontSource: TypeAlias = str | Path | bytes


@dataclass(slots=True)
class Party:
    name: str | None = None
    address_lines: list[str] | None = None
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    country: str | None = None
    tax_id: str | None = None
    ice: str | None = None
    if_number: str | None = None
    rc: str | None = None


@dataclass(slots=True)
class Issuer(Party):
    logo: str | None = None


@dataclass(slots=True)
class LineItemInput:
    name: str
    quantity: float
    description: str | None = None
    unit_price: float | None = None
    price: float | None = None
    unit: str | None = None
    discount_rate: float | None = None


@dataclass(slots=True)
class LineItem:
    name: str
    quantity: float
    unit_price: float
    line_subtotal: float
    line_discount_amount: float
    line_total: float
    description: str | None = None
    unit: str | None = None
    discount_rate: float = 0.0


@dataclass(slots=True)
class DiscountInput:
    type: DiscountType
    value: float
    label: str | None = None


@dataclass(slots=True)
class PaymentTerms:
    label: str
    due_date: DateValue | None = None
    notes: str | None = None


@dataclass(slots=True)
class LocalBankInfo:
    bank_name: str
    holder_name: str
    rib: str
    type: str = field(default="local", init=False)


@dataclass(slots=True)
class InternationalBankInfo:
    bank_name: str
    holder_name: str
    swift_code: str
    iban: str
    type: str = field(default="international", init=False)


BankInfo: TypeAlias = LocalBankInfo | InternationalBankInfo


@dataclass(slots=True)
class DocumentColors:
    primary: str | None = None
    on_primary: str | None = None
    text: str | None = None
    meta_text: str | None = None
    muted_text: str | None = None
    border: str | None = None
    footer_text: str | None = None


@dataclass(slots=True)
class DocumentTotals:
    subtotal: float
    discount_total: float
    taxable_base: float
    vat_amount: float
    total: float


@dataclass(slots=True)
class PdfFonts:
    regular: FontSource | None = None
    bold: FontSource | None = None


@dataclass(slots=True)
class PdfSpacing:
    issuer_name_to_details: float | None = None
    title_to_metadata: float | None = None
    metadata_row_gap: float | None = None
    header_to_parties: float | None = None
    party_label_to_details: float | None = None
    parties_to_table: float | None = None
    header_to_table: float | None = None
    table_to_summary: float | None = None
    bank_label_to_details: float | None = None
    bank_to_notes: float | None = None
    notes_label_to_details: float | None = None
    detail_line_gap: float | None = None
    table_header_height: float | None = None
    table_row_min_height: float | None = None
    table_row_vertical_padding: float | None = None
    table_text_top_padding: float | None = None
    summary_row_height: float | None = None
    summary_bottom_gap: float | None = None


@dataclass(slots=True)
class BusinessDocumentData:
    type: DocumentType
    locale: Locale
    title: str | None = None
    number: str | None = None
    issue_date: DateValue | None = None
    due_date: DateValue | None = None
    issuer: Issuer | None = None
    seller: Party | None = None
    client: Party | None = None
    items: list[LineItem] | None = None
    currency: str | None = None
    vat_rate: float | None = None
    discounts: list[DiscountInput] | None = None
    payment_terms: PaymentTerms | None = None
    bank_info: BankInfo | None = None
    notes: str | None = None
    footer: str | None = None
    colors: DocumentColors | None = None
    totals: DocumentTotals | None = None
