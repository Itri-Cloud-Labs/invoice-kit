from __future__ import annotations

from typing_extensions import TypedDict, Unpack

from .calculations import MOROCCO_DEFAULT_VAT_RATE, compute_line_item, compute_totals
from .document import BusinessDocument
from .models import (
    BankInfo,
    BusinessDocumentData,
    DateValue,
    DiscountInput,
    DocumentColors,
    DocumentType,
    Issuer,
    LineItemInput,
    Locale,
    Party,
    PaymentTerms,
)
from .validation import QUANTITY_ONLY_TYPES, validate_document_input


class DocumentInput(TypedDict, total=False):
    number: str
    issuer: Issuer
    seller: Party
    client: Party
    items: list[LineItemInput]
    issue_date: DateValue
    due_date: DateValue
    currency: str
    vat_rate: float
    discounts: list[DiscountInput]
    notes: str
    footer: str
    payment_terms: PaymentTerms
    bank_info: BankInfo
    colors: DocumentColors
    locale: Locale
    title: str


PRICE_REQUEST_TITLES = {Locale.FR_MA: "Demande de prix", Locale.AR_MA: "طلب عرض أسعار"}


def _create(document_type: DocumentType, values: DocumentInput) -> BusinessDocument:
    validate_document_input(document_type, dict(values))
    locale = values.get("locale", Locale.FR_MA)
    if not isinstance(locale, Locale):
        raise TypeError("locale must be a Locale instance.")
    quantity_only = document_type in QUANTITY_ONLY_TYPES
    source_items = values.get("items", [])
    normalized_inputs = [
        LineItemInput(
            name=item.name,
            quantity=item.quantity,
            description=item.description,
            unit_price=0.0,
            price=0.0,
            unit=item.unit,
            discount_rate=0.0,
        )
        if quantity_only
        else item
        for item in source_items
    ]
    items = [compute_line_item(item) for item in normalized_inputs]
    discounts = [] if quantity_only else values.get("discounts", [])
    vat_rate = 0.0 if quantity_only else values.get("vat_rate", MOROCCO_DEFAULT_VAT_RATE)
    totals = compute_totals(items, discounts, vat_rate) if items and not quantity_only else None
    title = values.get("title")
    if document_type is DocumentType.PRICE_REQUEST and title is None:
        title = PRICE_REQUEST_TITLES[locale]
    data = BusinessDocumentData(
        type=document_type,
        locale=locale,
        title=title,
        number=values.get("number"),
        issue_date=values.get("issue_date"),
        due_date=values.get("due_date"),
        issuer=values.get("issuer"),
        seller=values.get("seller"),
        client=values.get("client"),
        items=items or None,
        currency=values.get("currency"),
        vat_rate=vat_rate if items and not quantity_only else None,
        discounts=discounts or None,
        payment_terms=values.get("payment_terms"),
        bank_info=values.get("bank_info"),
        notes=values.get("notes"),
        footer=values.get("footer"),
        colors=values.get("colors"),
        totals=totals,
    )
    return BusinessDocument(data)


def create_invoice(**kwargs: Unpack[DocumentInput]) -> BusinessDocument:
    return _create(DocumentType.INVOICE, kwargs)


def create_quote(**kwargs: Unpack[DocumentInput]) -> BusinessDocument:
    return _create(DocumentType.QUOTE, kwargs)


def create_purchase_order(**kwargs: Unpack[DocumentInput]) -> BusinessDocument:
    return _create(DocumentType.PURCHASE_ORDER, kwargs)


def create_delivery_note(**kwargs: Unpack[DocumentInput]) -> BusinessDocument:
    return _create(DocumentType.DELIVERY_NOTE, kwargs)


def create_return_note(**kwargs: Unpack[DocumentInput]) -> BusinessDocument:
    return _create(DocumentType.RETURN_NOTE, kwargs)


def create_price_request(**kwargs: Unpack[DocumentInput]) -> BusinessDocument:
    return _create(DocumentType.PRICE_REQUEST, kwargs)
