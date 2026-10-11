import type { ReactNode } from "react";
import { Chip, WRAP } from "./ui";

const FACTS: ReadonlyArray<{ title: string; body: ReactNode }> = [
  {
    title: "Long tables",
    body: "When the item table runs out of page it continues on the next one and prints its header row again. Multi-line footers reserve their own space first."
  },
  {
    title: "Logos by URL",
    body: (
      <>
        Put an <Chip>http</Chip> or <Chip>https</Chip> address in <Chip>issuer.logo</Chip> and the renderer fetches it.
        PNG and JPEG go in as they are. SVG and WEBP are converted to PNG on the way.
      </>
    )
  },
  {
    title: "Bank details",
    body: "Two shapes, checked by type: a local transfer with bank, holder and RIB, or an international one with SWIFT and IBAN."
  },
  {
    title: "Arabic labels",
    body: (
      <>
        <Chip>locale: "ar-MA"</Chip> switches titles and labels to Arabic. A DejaVu Sans fallback is embedded in the
        package; your own fonts can be passed as a path, a <Chip>Uint8Array</Chip> or an <Chip>ArrayBuffer</Chip>.
      </>
    )
  },
  {
    title: "Nothing to copy at deploy",
    body: "PDFKit is vendored with its font metrics inside the bundle, so an ESM server build needs no asset files next to it. Node.js 18 or newer."
  },
  {
    title: "Tested behaviour",
    body: (
      <>
        A <Chip>node:test</Chip> suite covers totals, TVA edge cases, validation, sparse documents, quantity-only
        normalisation, remote logo formats and pagination.
      </>
    )
  }
];

export const Details = () => (
  <section className="pb-section" id="details">
    <div className={WRAP}>
      <h2 className="max-w-[34rem] pb-[clamp(2rem,4vw,3.25rem)]">The parts you would rather not write</h2>
      <dl className="border-t-[1.5px] border-ink">
        {FACTS.map((fact) => (
          <div
            key={fact.title}
            className="grid grid-cols-[minmax(0,5fr)_minmax(0,8fr)] gap-x-[clamp(2rem,5vw,5rem)] gap-y-2 border-b border-line py-[1.35rem] max-sm:grid-cols-[minmax(0,1fr)]"
          >
            <dt className="font-display text-[length:clamp(1.2rem,1.05rem+0.6vw,1.5rem)] leading-[1.2] font-[640]">
              {fact.title}
            </dt>
            <dd className="max-w-[40rem] text-pretty">{fact.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  </section>
);
