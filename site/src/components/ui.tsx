import { useEffect, useRef, useState, type ReactNode } from "react";
import { PACKAGE } from "../demo/options";
import { cx } from "../lib/cx";

export const TEXTLINK =
  "font-[560] underline decoration-[1.5px] underline-offset-[0.22em] [transition:text-decoration-thickness_0.15s,text-underline-offset_0.15s] hover:decoration-[3px] hover:underline-offset-[0.26em]";

export const LABEL = "text-[0.74rem] font-[640] font-stretch-[86%] tracking-[0.06em] uppercase";

export const WRAP = "mx-auto w-full max-w-[82rem] px-gutter";

const PRESS = "[transition:background-color_0.2s,transform_0.12s] active:translate-y-px";

export const BUTTON = cx(
  "inline-block rounded-md bg-ink px-[1.15rem] py-[0.8rem] font-semibold text-lift hover:bg-ink-raised",
  PRESS
);

// The A4 sheet's outline with two more leaves showing underneath.
export const FRAME = "relative flex-none bg-white aspect-[595.28/841.89] shadow-sheet";

export const CAMERA = "absolute top-0 left-0 h-[841.89px] w-[595.28px] origin-top-left";

// Inline code set on a tinted well, for running text on the coloured ground.
export const Chip = ({ children }: { children: ReactNode }) => (
  <code className="rounded-[3px] bg-well px-[0.3em] py-[0.05em]">{children}</code>
);

interface CodeProps {
  label: string;
  plain?: boolean;
  children: ReactNode;
}

export const Code = ({ label, plain, children }: CodeProps) => (
  <pre
    tabIndex={0}
    aria-label={label}
    className={cx(
      "max-w-full overflow-x-auto rounded-md leading-[1.62] text-on-ink [tab-size:2] focus-visible:outline-offset-2",
      plain
        ? "bg-ink-raised p-[clamp(1.2rem,2.5vw,2rem)] text-[0.86rem]"
        : "bg-ink px-[1.2rem] py-[1.05rem] text-[0.82rem]"
    )}
  >
    <code>{children}</code>
  </pre>
);

const INSTALL = `npm install ${PACKAGE}`;

export const InstallButton = ({ inverse }: { inverse?: boolean }) => {
  const [label, setLabel] = useState("Copy");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(INSTALL);
      setLabel("Copied");
    } catch {
      setLabel("Select and copy");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLabel("Copy"), 1800);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cx(
        "inline-flex max-w-full cursor-pointer items-center gap-[0.7rem] rounded-md py-[0.85rem] pr-[0.95rem] pl-[1.05rem] text-left font-mono text-[0.92rem] leading-[1.3]",
        "max-sm:gap-2 max-sm:pr-[0.7rem] max-sm:pl-[0.8rem] max-sm:text-[length:clamp(0.72rem,3.5vw,0.92rem)]",
        PRESS,
        inverse ? "bg-ground text-ink hover:bg-lift" : "bg-ink text-lift hover:bg-ink-raised"
      )}
    >
      <span className={cx("select-none", inverse ? "text-ink" : "text-ground")} aria-hidden="true">
        $
      </span>
      <code className="whitespace-nowrap">{INSTALL}</code>
      <span
        className={cx(
          "ml-[0.2rem] min-w-[4.4em] border-l pl-[0.8rem] font-sans text-[0.82rem] font-semibold max-sm:ml-0 max-sm:min-w-0 max-sm:pl-[0.6rem]",
          inverse ? "border-line text-ink" : "border-install-line text-ground"
        )}
      >
        {label}
      </span>
    </button>
  );
};
