import type { LocaleCode } from "../core/types.js";

export const formatDate = (date: Date, locale: LocaleCode): string => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString();
  const formatted = `${day}/${month}/${year}`;

  if (locale === "ar-MA") {
    return formatted.replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)] ?? digit);
  }

  return formatted;
};

export const formatMoney = (amount: number, locale: LocaleCode, currency: string): string => {
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${formatter.format(amount)} ${currency}`;
};
