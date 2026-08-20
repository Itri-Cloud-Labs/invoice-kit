from __future__ import annotations

import json
import math
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from invoice_kit import (
    DiscountInput,
    DiscountType,
    DocumentColors,
    InternationalBankInfo,
    Issuer,
    LineItemInput,
    LocalBankInfo,
    Locale,
    Party,
    PaymentTerms,
    create_delivery_note,
    create_invoice,
    create_price_request,
    create_return_note,
)

FIXTURES = Path(__file__).parents[3] / "fixtures" / "compatibility" / "documents.json"


def test_shared_financial_fixture() -> None:
    fixture = json.loads(FIXTURES.read_text())["financial"]
    source = fixture["input"]
    items = [LineItemInput(**item) for item in source["items"]]
    discounts = [
        DiscountInput(type=DiscountType(item["type"]), value=item["value"])
        for item in source["discounts"]
    ]
    result = create_invoice(
        items=items,
        discounts=discounts,
        vat_rate=source["vat_rate"],
        currency=source["currency"],
    ).to_dict()
    assert result["totals"] == fixture["expected"]


@pytest.mark.parametrize(
    "factory", [create_delivery_note, create_return_note, create_price_request]
)
def test_quantity_only_documents_normalize_financial_data(factory: object) -> None:
    document = factory(  # type: ignore[operator]
        items=[LineItemInput(name="Boxes", quantity=3, unit_price=99, discount_rate=0.5)],
        discounts=[DiscountInput(DiscountType.FIXED, 10)],
        vat_rate=0.2,
        payment_terms=PaymentTerms("Ignored"),
        bank_info=LocalBankInfo("Bank", "Holder", "RIB"),
    ).to_dict()
    item = document["items"][0]  # type: ignore[index]
    assert item["unit_price"] == item["line_total"] == 0  # type: ignore[index]
    assert "totals" not in document
    assert "vat_rate" not in document
    assert "discounts" not in document


def test_price_request_titles_are_localized_and_overridable() -> None:
    fixture = json.loads(FIXTURES.read_text())["localization"]
    assert create_price_request().to_dict()["title"] == fixture["fr-MA"]
    assert create_price_request(locale=Locale.AR_MA).to_dict()["title"] == fixture["ar-MA"]
    assert create_price_request(title="Custom").to_dict()["title"] == "Custom"


def test_sparse_document_keeps_omitted_modules_absent() -> None:
    assert create_invoice(footer="IC Labs").to_dict() == {
        "type": "invoice",
        "locale": "fr-MA",
        "footer": "IC Labs",
    }


def test_serialization_uses_snake_case_and_iso_dates() -> None:
    result = create_invoice(
        issue_date=date(2026, 8, 20),
        due_date=datetime(2026, 9, 1, 12, 30, tzinfo=timezone.utc),
        issuer=Issuer(name="Issuer", if_number="123"),
    )
    assert result.to_dict()["issue_date"] == "2026-08-20"
    assert result.to_dict()["due_date"] == "2026-09-01T12:30:00+00:00"
    assert json.loads(result.to_json())["issuer"]["if_number"] == "123"


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"number": ""}, "number must be a non-empty string."),
        ({"footer": "  "}, "footer must be a non-empty string."),
        ({"items": [LineItemInput("", 1, price=2)]}, "items[0].name"),
        ({"items": [LineItemInput("A", 0, price=2)]}, "quantity must be greater"),
        ({"items": [LineItemInput("A", 1)]}, "must define unit_price or price"),
        ({"items": [LineItemInput("A", 1, price=-1)]}, "cannot be negative"),
        ({"vat_rate": -0.1}, "vat_rate must be between 0 and 1"),
        ({"vat_rate": math.inf}, "vat_rate must be a finite number"),
        ({"colors": DocumentColors(primary="red")}, "must be a valid hex color"),
        ({"issuer": Issuer(logo="file:///logo.png")}, "valid http or https URL"),
        ({"bank_info": LocalBankInfo("Bank", "Holder", "")}, "bank_info.rib"),
        (
            {"bank_info": InternationalBankInfo("Bank", "Holder", "", "IBAN")},
            "bank_info.swift_code",
        ),
    ],
)
def test_validation_errors(kwargs: dict[str, object], message: str) -> None:
    with pytest.raises(ValueError, match=message.replace("[", r"\[").replace("]", r"\]")):
        create_invoice(**kwargs)  # type: ignore[arg-type]


def test_nested_dictionaries_are_rejected() -> None:
    with pytest.raises(TypeError, match="Issuer instance"):
        create_invoice(issuer={"name": "No coercion"})  # type: ignore[arg-type]


def test_price_alias_and_oversized_discount() -> None:
    result = create_invoice(
        items=[LineItemInput("Service", 1, price=100)],
        discounts=[DiscountInput(DiscountType.FIXED, 1000)],
        vat_rate=0,
    ).to_dict()
    assert result["items"][0]["unit_price"] == 100  # type: ignore[index]
    assert result["totals"] == {
        "subtotal": 100,
        "discount_total": 100,
        "taxable_base": 0,
        "vat_amount": 0,
        "total": 0,
    }


def test_party_address_lines_are_validated() -> None:
    with pytest.raises(ValueError, match=r"client.address_lines\[1\]"):
        create_invoice(client=Party(address_lines=["Good", " "]))
