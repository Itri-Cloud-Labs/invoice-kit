import { useLayoutEffect, useRef } from "react";
import { createDocumentData } from "../demo/document";
import { REPO } from "../demo/options";
import * as sample from "../demo/sample-data.js";
import { cx } from "../lib/cx";
import { Sheet } from "./Sheet";
import { applyCamera } from "./Stage";
import { BUTTON, CAMERA, FRAME, TEXTLINK, WRAP } from "./ui";

const receipt = createDocumentData("invoice", sample.receipt);

// The closing invoice: what the library costs.
export const Bill = () => {
  const frame = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const holder = frame.current;
    const target = camera.current;
    if (!holder || !target) return;
    const fit = (): void => applyCamera(target, holder);
    const observer = new ResizeObserver(fit);
    observer.observe(holder);
    fit();
    return () => observer.disconnect();
  }, []);

  return (
    <section className="overflow-clip py-section" id="bill">
      <div
        className={cx(
          WRAP,
          "grid grid-cols-[minmax(0,6fr)_minmax(0,6fr)] items-center gap-x-[clamp(2rem,6vw,6rem)] gap-y-12 max-wide:grid-cols-[minmax(0,1fr)]"
        )}
      >
        <div className="max-wide:order-2">
          <div ref={frame} className={cx(FRAME, "mx-auto w-[min(100%,31rem)] -rotate-[1.6deg] max-wide:w-full")}>
            <div ref={camera} className={CAMERA}>
              <div
                role="img"
                aria-label="An invoice from Itri Cloud Labs listing the six document factories at 0,00 MAD each, total 0,00 MAD"
              >
                <Sheet data={receipt} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <h2>Here is your invoice</h2>
          <p className="max-w-[32rem] text-[1.12rem] text-pretty">
            Six factories, the totals engine and the PDF renderer come to 0,00 MAD, TVA included. invoice-kit is open
            source under the MIT licence, built and maintained by Itri Cloud Labs.
          </p>
          <div className="flex flex-wrap items-center gap-x-[1.6rem] gap-y-4">
            <a className={BUTTON} href={REPO}>
              Open the repository
            </a>
            <a className={TEXTLINK} href={`${import.meta.env.BASE_URL}samples/facture-invoice-kit.pdf`} download>
              Download this invoice as a PDF
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
