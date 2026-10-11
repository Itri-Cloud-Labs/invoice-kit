import type { ReactNode } from "react";
import kitPackage from "../../../packages/typescript/package.json";
import { fn, kw, lines, literal, note, seq, str } from "../demo/code";
import { DOCS, PACKAGE, REPO } from "../demo/options";
import * as sample from "../demo/sample-data.js";
import { cx } from "../lib/cx";
import { Code, InstallButton, TEXTLINK, WRAP } from "./ui";

const input = {
  title: "Facture",
  number: sample.numbers.invoice,
  issuer: { name: sample.issuer.name, ice: sample.issuer.ice },
  client: { name: sample.client.name },
  items: [
    { name: "Papier A4 80 g", quantity: 40, unitPrice: 38 },
    { name: "Tampon encreur bleu", quantity: 6, unitPrice: 145 }
  ],
  bankInfo: sample.bankInfo
};

const PARAGRAPH = "max-w-[32rem] leading-[1.62] text-pretty";

const White = ({ children }: { children: ReactNode }) => <code className="text-white">{children}</code>;

// The one ink-coloured band on the page.
export const Start = () => (
  <section
    className="bg-ink-band py-section text-on-band selection:bg-ground selection:text-ink **:focus-visible:outline-ground"
    id="start"
  >
    <div
      className={cx(
        WRAP,
        "grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-x-[clamp(2rem,5vw,5rem)] gap-y-12 max-wide:grid-cols-[minmax(0,1fr)]"
      )}
    >
      <div className="flex flex-col items-start gap-6">
        <h2 className="text-ground">Start with one file</h2>
        <p className={PARAGRAPH}>
          Install the package, call a factory, write the PDF. <White>toPDF()</White> also returns the bytes as a{" "}
          <White>Uint8Array</White>, so you can send them from a route handler without touching the disk, and{" "}
          <White>toJSON()</White> hands back the computed document.
        </p>
        <InstallButton inverse />
        <ul className="flex flex-col gap-[0.6rem]">
          <li>
            <a className={TEXTLINK} href={DOCS}>
              Read the full input reference
            </a>
          </li>
          <li>
            <a className={TEXTLINK} href={`${REPO}/blob/main/packages/typescript/CHANGELOG.md`}>
              See what changed in {kitPackage.version}
            </a>
          </li>
        </ul>
        <p className={cx(PARAGRAPH, "border-t border-band-line pt-5 text-[0.95rem]")}>
          Working in Python? A port is planned as <White>ic-labs-invoice-kit</White>. It is not released yet.
        </p>
      </div>
      <Code label="Quick start example" plain>
        {lines(
          seq(kw("import"), " { ", fn("createInvoice"), " } ", kw("from"), " ", str(PACKAGE), ";"),
          "",
          seq(kw("const"), " facture = ", fn("createInvoice"), "(", literal(input, 0, 56), ");"),
          "",
          seq(kw("await"), " facture.", fn("toPDF"), "(", str("./facture.pdf"), ");"),
          "",
          note("// or keep the bytes and skip the file"),
          seq(kw("const"), " bytes = ", kw("await"), " facture.", fn("toPDF"), "();")
        )}
      </Code>
    </div>
  </section>
);
