import type { BankInfo, CreateDocumentOptions, DiscountInput, Issuer, LineItemInput, Party } from "./types.js";

const assertNonEmptyString = (value: string, field: string): void => {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
};

const assertFiniteNumber = (value: number, field: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number.`);
  }
};

const validateParty = (party: Party, field: string): void => {
  if (party.name !== undefined) {
    assertNonEmptyString(party.name, `${field}.name`);
  }

  if (!party.addressLines) {
    return;
  }

  for (const [index, line] of party.addressLines.entries()) {
    assertNonEmptyString(line, `${field}.addressLines[${index}]`);
  }
};

const validateIssuer = (issuer: Issuer): void => {
  validateParty(issuer, "issuer");

  if (issuer.logo !== undefined) {
    assertNonEmptyString(issuer.logo, "issuer.logo");

    try {
      const url = new URL(issuer.logo);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("invalid protocol");
      }
    } catch {
      throw new Error("issuer.logo must be a valid http or https URL.");
    }
  }
};

const validateItem = (item: LineItemInput, index: number, requiresPricing: boolean): void => {
  assertNonEmptyString(item.name, `items[${index}].name`);
  assertFiniteNumber(item.quantity, `items[${index}].quantity`);

  if (item.quantity <= 0) {
    throw new Error(`items[${index}].quantity must be greater than zero.`);
  }

  const resolvedPrice = item.unitPrice ?? item.price;
  if (requiresPricing && resolvedPrice === undefined) {
    throw new Error(`items[${index}] must define unitPrice or price.`);
  }

  if (resolvedPrice !== undefined) {
    assertFiniteNumber(resolvedPrice, `items[${index}].unitPrice`);

    if (resolvedPrice < 0) {
      throw new Error(`items[${index}].unitPrice cannot be negative.`);
    }
  }

  if (item.discountRate !== undefined) {
    assertFiniteNumber(item.discountRate, `items[${index}].discountRate`);
  }
};

const validateDiscount = (discount: DiscountInput, index: number): void => {
  assertFiniteNumber(discount.value, `discounts[${index}].value`);

  if (discount.value < 0) {
    throw new Error(`discounts[${index}].value cannot be negative.`);
  }
};

const validateBankInfo = (bankInfo: BankInfo): void => {
  assertNonEmptyString(bankInfo.bankName, "bankInfo.bankName");
  assertNonEmptyString(bankInfo.holderName, "bankInfo.holderName");

  if (bankInfo.type === "local") {
    assertNonEmptyString(bankInfo.rib, "bankInfo.rib");
    return;
  }

  assertNonEmptyString(bankInfo.swiftCode, "bankInfo.swiftCode");
  assertNonEmptyString(bankInfo.iban, "bankInfo.iban");
};

export const validateDocumentInput = (input: CreateDocumentOptions): void => {
  const requiresPricing = input.type !== "deliveryNote";

  if (input.number !== undefined) {
    assertNonEmptyString(input.number, "number");
  }

  if (input.title !== undefined) {
    assertNonEmptyString(input.title, "title");
  }

  if (input.issuer) {
    validateIssuer(input.issuer);
  }

  if (input.seller) {
    validateParty(input.seller, "seller");
  }

  if (input.client) {
    validateParty(input.client, "client");
  }

  input.items?.forEach((item, index) => {
    validateItem(item, index, requiresPricing);
  });

  if (requiresPricing) {
    input.discounts?.forEach(validateDiscount);
  }

  if (requiresPricing && input.vatRate !== undefined) {
    assertFiniteNumber(input.vatRate, "vatRate");
    if (input.vatRate < 0 || input.vatRate > 1) {
      throw new Error("vatRate must be between 0 and 1.");
    }
  }

  if (input.currency !== undefined) {
    assertNonEmptyString(input.currency, "currency");
  }

  if (input.footer !== undefined) {
    assertNonEmptyString(input.footer, "footer");
  }

  if (input.bankInfo) {
    validateBankInfo(input.bankInfo);
  }
};
