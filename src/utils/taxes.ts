import type { DiscountInput, DocumentTotals, LineItem, LineItemInput } from "../core/types.js";
import { clampPercentage, roundCurrency } from "./math.js";

export const MOROCCO_DEFAULT_VAT_RATE = 0.2;

export const computeLineItem = (item: LineItemInput): LineItem => {
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
  const resolvedUnitPrice = item.unitPrice ?? item.price;
  const unitPrice = typeof resolvedUnitPrice === "number" && Number.isFinite(resolvedUnitPrice) ? resolvedUnitPrice : 0;
  const subtotal = roundCurrency(quantity * unitPrice);
  const discountRate = clampPercentage(item.discountRate ?? 0);
  const discountAmount = roundCurrency(subtotal * discountRate);

  return {
    name: item.name,
    quantity,
    unitPrice,
    discountRate,
    lineSubtotal: subtotal,
    lineDiscountAmount: discountAmount,
    lineTotal: roundCurrency(subtotal - discountAmount),
    ...(item.description ? { description: item.description } : {}),
    ...(item.unit ? { unit: item.unit } : {})
  };
};

export const computeTotals = (
  items: LineItem[],
  discounts: DiscountInput[],
  vatRate: number
): DocumentTotals => {
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.lineSubtotal, 0));
  const lineDiscountTotal = roundCurrency(items.reduce((sum, item) => sum + item.lineDiscountAmount, 0));
  const afterLineDiscounts = roundCurrency(subtotal - lineDiscountTotal);

  const extraDiscountTotal = roundCurrency(
    discounts.reduce((sum, discount) => {
      if (discount.type === "percentage") {
        return sum + afterLineDiscounts * clampPercentage(discount.value);
      }

      return sum + Math.max(0, discount.value);
    }, 0)
  );

  const discountTotal = roundCurrency(Math.min(afterLineDiscounts, lineDiscountTotal + extraDiscountTotal));
  const taxableBase = roundCurrency(Math.max(0, subtotal - discountTotal));
  const normalizedVatRate = clampPercentage(vatRate);
  const vatAmount = roundCurrency(taxableBase * normalizedVatRate);

  return {
    subtotal,
    discountTotal,
    taxableBase,
    vatAmount,
    total: roundCurrency(taxableBase + vatAmount)
  };
};
