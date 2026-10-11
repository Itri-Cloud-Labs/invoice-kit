// Small tagged builders for the code samples. Each returns highlighted HTML.

const escape = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const span = (className: string, value: string): string => `<span class="${className}">${escape(value)}</span>`;

export const kw = (value: string): string => span("c-kw", value);
export const fn = (value: string): string => span("c-fn", value);
export const str = (value: string): string => span("c-str", JSON.stringify(value));
export const num = (value: number): string => span("c-num", String(value));
export const note = (value: string): string => span("c-note", value);
export const key = (value: string): string => span("c-key", value);
export const plain = escape;

const isIdentifier = (value: string): boolean => /^[A-Za-z_$][\w$]*$/.test(value);

const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Serialises a value as a TypeScript literal. Objects and arrays stay on one line
// while they fit in `width` columns and break one entry per line otherwise.
export const literal = (value: unknown, indent = 0, width = 58): string => {
  const flat = flatLiteral(value);
  if (flat.length + indent <= width || typeof value !== "object" || value === null || value instanceof Date) {
    return markup(value);
  }

  const pad = "  ".repeat(indent / 2 + 1);
  const close = "  ".repeat(indent / 2);
  if (Array.isArray(value)) {
    return `[\n${value.map((entry) => `${pad}${literal(entry, indent + 2, width)}`).join(",\n")}\n${close}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined);
  return `{\n${entries
    .map(([name, entry]) => `${pad}${key(isIdentifier(name) ? name : JSON.stringify(name))}: ${literal(entry, indent + 2, width)}`)
    .join(",\n")}\n${close}}`;
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

const markup = (value: unknown): string => {
  if (value instanceof Date) return `${kw("new")} ${fn("Date")}(${str(isoDay(value))})`;
  if (Array.isArray(value)) return `[${value.map(markup).join(", ")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
    if (entries.length === 0) return "{}";
    return `{ ${entries
      .map(([name, entry]) => `${key(isIdentifier(name) ? name : JSON.stringify(name))}: ${markup(entry)}`)
      .join(", ")} }`;
  }
  if (typeof value === "string") return str(value);
  if (typeof value === "number") return num(value);
  return escape(String(value));
};
