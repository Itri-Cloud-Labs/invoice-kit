import type { LocaleCode } from "../core/types.js";

export const formatDate = (date: Date, _locale: LocaleCode): string => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString();

  // Morocco writes dates with Western digits in Arabic as well, matching Intl's ar-MA amounts.
  return `${day}/${month}/${year}`;
};

export const formatMoney = (amount: number, locale: LocaleCode, currency: string): string => {
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${formatter.format(amount)} ${currency}`;
};
