// Small tagged builders for the code samples. Each returns highlighted nodes.
import { Fragment, createElement, type ReactNode } from "react";

const token = (name: string, className: string) => (value: string): ReactNode => (
  <span data-tok={name} className={className}>
    {value}
  </span>
);

export const kw = token("kw", "text-tok-kw");
export const fn = token("fn", "text-white");
export const note = token("note", "text-tok-note");
export const key = token("key", "text-tok-key");
const literalToken = token("lit", "text-ground");
export const str = (value: string): ReactNode => literalToken(JSON.stringify(value));
export const num = (value: number): ReactNode => literalToken(String(value));

// Children are spread so React does not ask for keys on generated code.
export const seq = (...parts: ReactNode[]): ReactNode => createElement(Fragment, null, ...parts);
export const join = (parts: ReactNode[], separator: string): ReactNode =>
  seq(...parts.flatMap((part, index) => (index === 0 ? [part] : [separator, part])));
export const lines = (...rows: ReactNode[]): ReactNode => join(rows, "\n");

const isIdentifier = (value: string): boolean => /^[A-Za-z_$][\w$]*$/.test(value);
const keyName = (name: string): ReactNode => key(isIdentifier(name) ? name : JSON.stringify(name));

const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Serialises a value as a TypeScript literal. Objects and arrays stay on one line
// while they fit in `width` columns and break one entry per line otherwise.
export const literal = (value: unknown, indent = 0, width = 58): ReactNode => {
  const flat = flatLiteral(value);
  if (flat.length + indent <= width || typeof value !== "object" || value === null || value instanceof Date) {
    return markup(value);
  }

  const pad = "  ".repeat(indent / 2 + 1);
  const close = "  ".repeat(indent / 2);
  if (Array.isArray(value)) {
    return seq("[\n", join(value.map((entry) => seq(pad, literal(entry, indent + 2, width))), ",\n"), `\n${close}]`);
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined);
  return seq(
    "{\n",
    join(entries.map(([name, entry]) => seq(pad, keyName(name), ": ", literal(entry, indent + 2, width))), ",\n"),
    `\n${close}}`
  );
};

const flatLiteral = (value: unknown): string => {
  if (value instanceof Date) return `new Date("${isoDay(value)}")`;
  if (Array.isArray(value)) return `[${value.map(flatLiteral).join(", ")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
    return `{ ${entries.map(([name, entry]) => `${name}: ${flatLiteral(entry)}`).join(", ")} }`;
  }
  return JSON.stringify(value) ?? "undefined";
};

const markup = (value: unknown): ReactNode => {
  if (value instanceof Date) return seq(kw("new"), " ", fn("Date"), "(", str(isoDay(value)), ")");
  if (Array.isArray(value)) return seq("[", join(value.map(markup), ", "), "]");
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
    if (entries.length === 0) return "{}";
    return seq("{ ", join(entries.map(([name, entry]) => seq(keyName(name), ": ", markup(entry))), ", "), " }");
  }
  if (typeof value === "string") return str(value);
  if (typeof value === "number") return num(value);
  return String(value);
};
