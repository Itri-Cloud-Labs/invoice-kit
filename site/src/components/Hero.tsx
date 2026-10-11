import { DOCS, NPM, REPO } from "../demo/options";
import { cx } from "../lib/cx";
import { InstallButton, TEXTLINK } from "./ui";

const NAV_LINK =
  "bg-[linear-gradient(currentColor,currentColor)] bg-[position:0_100%] bg-[length:0_1.5px] bg-no-repeat py-[0.4rem] transition-[background-size] duration-300 ease-out hover:bg-[length:100%_1.5px]";

const RISE = "motion-safe:animate-rise";

export const Hero = () => (
  <header className="@container col-start-1 flex min-h-svh flex-col max-wide:min-h-0" data-chapter="hero">
    <nav className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-[1.6rem]" aria-label="Site">
      <a
        className="inline-flex items-center gap-[0.6rem] font-display text-[1.2rem] font-[760] tracking-[-0.01em]"
        href="#bench"
        aria-label="invoice-kit, top of page"
      >
        <svg className="size-[1.4rem]" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 3.750h20M2 8.750h20M2 13.750h20" fill="none" stroke="currentColor" strokeWidth="1.500" />
          <rect x="2" y="17" width="20" height="5" fill="currentColor" />
        </svg>
        <span>invoice-kit</span>
      </a>
      <ul className="flex gap-[clamp(1rem,2.5vw,1.75rem)] text-[0.95rem] font-[560]">
        <li className="max-sm:hidden">
          <a className={NAV_LINK} href="#start">
            Quick start
          </a>
        </li>
        <li>
          <a className={NAV_LINK} href={REPO}>
            GitHub
          </a>
        </li>
        <li>
          <a className={NAV_LINK} href={NPM}>
            npm
          </a>
        </li>
      </ul>
    </nav>

    <div className="flex max-w-[44rem] flex-1 flex-col justify-center gap-[1.6rem] pt-8 pb-20 max-wide:pt-[clamp(2rem,8vw,4rem)] max-wide:pb-10">
      <h1 className={cx("text-[length:clamp(2.6rem,9.6cqi,4.9rem)] leading-[1.04] font-extrabold tracking-[-0.022em]", RISE)}>
        Moroccan paperwork, from a typed object to a PDF.
      </h1>
      <p
        className={cx(
          "max-w-[34rem] text-[length:clamp(1.08rem,0.98rem+0.4vw,1.25rem)] leading-normal text-pretty [animation-delay:0.08s]",
          RISE
        )}
      >
        invoice-kit is a TypeScript library for Node.js. Describe a sale once and get a Facture, a Devis, a Bon de
        commande, a Bon de livraison, a Bon de retour or a Demande de prix, with the TVA worked out and the ICE, IF and
        RC printed where an accountant expects them.
      </p>
      <div className={cx("mt-[0.4rem] flex flex-wrap items-center gap-x-[1.6rem] gap-y-4 [animation-delay:0.16s]", RISE)}>
        <InstallButton />
        <a className={TEXTLINK} href={DOCS}>
          Read the documentation
        </a>
      </div>
      <p className={cx("mt-[1.2rem] flex items-center gap-[0.55rem] text-[0.95rem] text-ink-soft [animation-delay:0.3s]", RISE)}>
        <svg className="size-4 flex-none -rotate-90 max-wide:rotate-none" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2v11M3.500 8.500 8 13l4.500-4.500" fill="none" stroke="currentColor" strokeWidth="1.500" />
        </svg>
        <span>
          The document <span className="max-wide:hidden">beside this text</span>
          <span className="hidden max-wide:inline">below</span> is live. Scroll, and change it.
        </span>
      </p>
    </div>
  </header>
);
