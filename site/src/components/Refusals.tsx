import type { DocumentType } from "@kit/core/types";
import { validateDocumentInput } from "@kit/core/validation";
import { fn, literal } from "../demo/code";
import { kindOf } from "../demo/document";
import { cx } from "../lib/cx";
import { LABEL, WRAP } from "./ui";

const priced = { name: "Papier A4", quantity: 40, price: 38 };

const CASES: ReadonlyArray<{ type: DocumentType; input: Record<string, unknown>; pass?: string }> = [
  { type: "invoice", input: { items: [{ ...priced, quantity: 0 }] } },
  { type: "invoice", input: { items: [{ name: "Papier A4", quantity: 40 }] } },
  {
    type: "deliveryNote",
    input: { items: [{ name: "Papier A4", quantity: 40 }] },
    pass: "No error. A delivery note prints quantities, so it never asks for a price."
  },
  { type: "quote", input: { items: [priced], vatRate: 20 } },
  { type: "invoice", input: { colors: { primary: "navy" } } },
  { type: "invoice", input: { issuer: { name: "Atlas Papeterie", logo: "./logo.png" } } },
  { type: "invoice", input: { bankInfo: { type: "local", bankName: "Attijariwafa Bank", holderName: "Atlas Papeterie SARL" } } }
];

// Each case runs through the package's own validator; the message shown is what it throws.
const RESULTS = CASES.map((entry) => {
  let message: string | null = null;
  try {
    validateDocumentInput({ ...entry.input, type: entry.type } as Parameters<typeof validateDocumentInput>[0]);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  return { ...entry, message };
});

const TH = cx(LABEL, "border-b-[1.5px] border-ink pb-[0.6rem] text-left");
const TD = "border-b border-line py-4 align-top max-sm:block max-sm:w-auto max-sm:border-0 max-sm:py-0";

export const Refusals = () => (
  <section className="border-t-[1.5px] border-ink py-section" id="validation">
    <div
      className={cx(
        WRAP,
        "grid grid-cols-[minmax(0,5fr)_minmax(0,8fr)] items-start gap-x-[clamp(2rem,5vw,5rem)] gap-y-10 max-wide:grid-cols-[minmax(0,1fr)]"
      )}
    >
      <div className="sticky top-10 flex flex-col gap-5 max-wide:static">
        <h2>It refuses bad input by name</h2>
        <p className="max-w-[30rem] text-pretty">
          Input is validated before any document is built. A mistake comes back as an error that names the field, before
          a single page is drawn. The messages in this table are produced right now, in your browser, by the package's
          own validator.
        </p>
      </div>
      <table className="w-full border-collapse text-left max-sm:block">
        <thead className="max-sm:hidden">
          <tr>
            <th className={TH} scope="col">
              You pass
            </th>
            <th className={TH} scope="col">
              You get
            </th>
          </tr>
        </thead>
        <tbody className="max-sm:block">
          {RESULTS.map((entry, index) => (
            <tr
              key={index}
              className="max-sm:block max-sm:border-b max-sm:border-line max-sm:py-4 max-sm:first:border-t-[1.5px] max-sm:first:border-t-ink"
            >
              <td className={cx(TD, "w-[58%] pr-6")}>
                <pre className="text-[0.8rem] leading-[1.55] [overflow-wrap:anywhere] whitespace-pre-wrap **:data-tok:text-inherit **:data-[tok=fn]:underline **:data-[tok=fn]:decoration-line **:data-[tok=fn]:underline-offset-[0.25em]">
                  <code>
                    {fn(kindOf(entry.type).factory)}({literal(entry.input, 0, 52)})
                  </code>
                </pre>
              </td>
              <td
                className={cx(
                  TD,
                  "max-sm:pt-[0.6rem]",
                  entry.message ? "font-mono text-[0.84rem] leading-normal text-signal-ink" : "text-[0.95rem]"
                )}
              >
                {entry.message && (
                  <span className="mr-[0.6rem] inline-block rounded-[3px] border-[1.5px] border-current px-[0.4rem] py-[0.05rem] font-sans text-[0.7rem] font-bold font-stretch-[86%] tracking-[0.07em] uppercase">
                    Error
                  </span>
                )}
                {entry.message ?? entry.pass ?? "No error."}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
