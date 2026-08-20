from __future__ import annotations

import math

from .models import DiscountInput, DiscountType, DocumentTotals, LineItem, LineItemInput

MOROCCO_DEFAULT_VAT_RATE = 0.2


def round_currency(value: float) -> float:
    """Round like JavaScript's Math.round for non-negative monetary values."""
    return math.floor((value + math.ulp(1.0)) * 100 + 0.5) / 100


def clamp_percentage(value: float) -> float:
    if not math.isfinite(value):
        return 0.0
    return min(1.0, max(0.0, value))


def compute_line_item(item: LineItemInput) -> LineItem:
    quantity = item.quantity if math.isfinite(item.quantity) else 0.0
    resolved_price = item.unit_price if item.unit_price is not None else item.price
    unit_price = (
        resolved_price if resolved_price is not None and math.isfinite(resolved_price) else 0.0
    )
    subtotal = round_currency(quantity * unit_price)
    discount_rate = clamp_percentage(item.discount_rate or 0.0)
    discount_amount = round_currency(subtotal * discount_rate)
    return LineItem(
        name=item.name,
        quantity=quantity,
        unit_price=unit_price,
        line_subtotal=subtotal,
        line_discount_amount=discount_amount,
        line_total=round_currency(subtotal - discount_amount),
        description=item.description,
        unit=item.unit,
        discount_rate=discount_rate,
    )


def compute_totals(
    items: list[LineItem], discounts: list[DiscountInput], vat_rate: float
) -> DocumentTotals:
    subtotal = round_currency(sum(item.line_subtotal for item in items))
    line_discount_total = round_currency(sum(item.line_discount_amount for item in items))
    after_line_discounts = round_currency(subtotal - line_discount_total)
    extra_discount_total = round_currency(
        sum(
            after_line_discounts * clamp_percentage(discount.value)
            if discount.type is DiscountType.PERCENTAGE
            else max(0.0, discount.value)
            for discount in discounts
        )
    )
    discount_total = round_currency(
        min(after_line_discounts, line_discount_total + extra_discount_total)
    )
    taxable_base = round_currency(max(0.0, subtotal - discount_total))
    vat_amount = round_currency(taxable_base * clamp_percentage(vat_rate))
    return DocumentTotals(
        subtotal=subtotal,
        discount_total=discount_total,
        taxable_base=taxable_base,
        vat_amount=vat_amount,
        total=round_currency(taxable_base + vat_amount),
    )
