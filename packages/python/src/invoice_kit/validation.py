from __future__ import annotations

import math
import re
from typing import cast
from urllib.parse import urlparse

from .models import (
    BankInfo,
    DiscountInput,
    DiscountType,
    DocumentColors,
    DocumentType,
    InternationalBankInfo,
    Issuer,
    LineItemInput,
    LocalBankInfo,
    Party,
    PaymentTerms,
)

HEX_COLOR_PATTERN = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
QUANTITY_ONLY_TYPES = {
    DocumentType.DELIVERY_NOTE,
    DocumentType.RETURN_NOTE,
    DocumentType.PRICE_REQUEST,
}


def _non_empty(value: object, field: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty string.")


def _finite(value: object, field: str) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{field} must be a finite number.")


def _party(party: Party, field: str) -> None:
    if not isinstance(party, Party):
        raise TypeError(f"{field} must be a Party instance.")
    if party.name is not None:
        _non_empty(party.name, f"{field}.name")
    for index, line in enumerate(party.address_lines or []):
        _non_empty(line, f"{field}.address_lines[{index}]")


def _issuer(issuer: Issuer) -> None:
    if not isinstance(issuer, Issuer):
        raise TypeError("issuer must be an Issuer instance.")
    _party(issuer, "issuer")
    if issuer.logo is not None:
        _non_empty(issuer.logo, "issuer.logo")
        parsed = urlparse(issuer.logo)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("issuer.logo must be a valid http or https URL.")


def _item(item: LineItemInput, index: int, requires_pricing: bool) -> None:
    if not isinstance(item, LineItemInput):
        raise TypeError(f"items[{index}] must be a LineItemInput instance.")
    _non_empty(item.name, f"items[{index}].name")
    _finite(item.quantity, f"items[{index}].quantity")
    if item.quantity <= 0:
        raise ValueError(f"items[{index}].quantity must be greater than zero.")
    price = item.unit_price if item.unit_price is not None else item.price
    if requires_pricing and price is None:
        raise ValueError(f"items[{index}] must define unit_price or price.")
    if price is not None:
        _finite(price, f"items[{index}].unit_price")
        if price < 0:
            raise ValueError(f"items[{index}].unit_price cannot be negative.")
    if item.discount_rate is not None:
        _finite(item.discount_rate, f"items[{index}].discount_rate")


def _discount(discount: DiscountInput, index: int) -> None:
    if not isinstance(discount, DiscountInput):
        raise TypeError(f"discounts[{index}] must be a DiscountInput instance.")
    if not isinstance(discount.type, DiscountType):
        raise TypeError(f"discounts[{index}].type must be a DiscountType instance.")
    _finite(discount.value, f"discounts[{index}].value")
    if discount.value < 0:
        raise ValueError(f"discounts[{index}].value cannot be negative.")


def _bank(bank: BankInfo) -> None:
    if not isinstance(bank, (LocalBankInfo, InternationalBankInfo)):
        raise TypeError("bank_info must be a LocalBankInfo or InternationalBankInfo instance.")
    _non_empty(bank.bank_name, "bank_info.bank_name")
    _non_empty(bank.holder_name, "bank_info.holder_name")
    if isinstance(bank, LocalBankInfo):
        _non_empty(bank.rib, "bank_info.rib")
    else:
        _non_empty(bank.swift_code, "bank_info.swift_code")
        _non_empty(bank.iban, "bank_info.iban")


def _colors(colors: DocumentColors) -> None:
    if not isinstance(colors, DocumentColors):
        raise TypeError("colors must be a DocumentColors instance.")
    for field in (
        "primary",
        "on_primary",
        "text",
        "meta_text",
        "muted_text",
        "border",
        "footer_text",
    ):
        value = getattr(colors, field)
        if value is not None:
            _non_empty(value, f"colors.{field}")
            if not HEX_COLOR_PATTERN.fullmatch(value):
                raise ValueError(f"colors.{field} must be a valid hex color like #173d73.")


def validate_document_input(document_type: DocumentType, values: dict[str, object]) -> None:
    requires_pricing = document_type not in QUANTITY_ONLY_TYPES
    for field in ("number", "title", "currency", "footer"):
        value = values.get(field)
        if value is not None:
            _non_empty(value, field)
    if values.get("issuer") is not None:
        _issuer(values["issuer"])  # type: ignore[arg-type]
    for field in ("seller", "client"):
        if values.get(field) is not None:
            _party(values[field], field)  # type: ignore[arg-type]
    items = cast(list[LineItemInput], values.get("items") or [])
    for index, item in enumerate(items):
        _item(item, index, requires_pricing)
    if requires_pricing:
        discounts = cast(list[DiscountInput], values.get("discounts") or [])
        for index, discount in enumerate(discounts):
            _discount(discount, index)
        vat_rate = values.get("vat_rate")
        if vat_rate is not None:
            _finite(vat_rate, "vat_rate")
            if not 0 <= vat_rate <= 1:  # type: ignore[operator]
                raise ValueError("vat_rate must be between 0 and 1.")
    if values.get("bank_info") is not None:
        _bank(values["bank_info"])  # type: ignore[arg-type]
    payment_terms = values.get("payment_terms")
    if payment_terms is not None and not isinstance(payment_terms, PaymentTerms):
        raise TypeError("payment_terms must be a PaymentTerms instance.")
    if values.get("colors") is not None:
        _colors(values["colors"])  # type: ignore[arg-type]


def validate_spacing(values: dict[str, float | None]) -> None:
    for name, value in values.items():
        if value is not None and (not math.isfinite(value) or value < 0):
            raise ValueError(f"spacing.{name} must be a non-negative finite number.")
