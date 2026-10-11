import { useEffect, useMemo, useState } from "react";
import { isQuantityOnlyDocument } from "@kit/core/document-kinds";
import type { DocumentType } from "@kit/core/types";
import { Bill } from "./components/Bill";
import { ColorsChapter } from "./components/chapters/ColorsChapter";
import { ModulesChapter } from "./components/chapters/ModulesChapter";
import { SpacingChapter } from "./components/chapters/SpacingChapter";
import { TotalsChapter } from "./components/chapters/TotalsChapter";
import { TypesChapter } from "./components/chapters/TypesChapter";
import { Details } from "./components/Details";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Refusals } from "./components/Refusals";
import { Stage } from "./components/Stage";
import { Start } from "./components/Start";
import { buildInput, createDocumentData, createInitialState, kindOf, type DemoState } from "./demo/document";
import type { Chapter, GapName } from "./demo/options";
import { useMediaQuery } from "./lib/useMediaQuery";

// The chapter whose top edge last crossed a probe line partway down the viewport.
const useChapter = (wide: boolean): Chapter => {
  const [chapter, setChapter] = useState<Chapter>("hero");

  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-chapter]")];
    let queued = false;
    const check = (): void => {
      queued = false;
      const probe = window.innerHeight * (wide ? 0.5 : 0.72);
      let current: Chapter = "hero";
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= probe) current = section.dataset.chapter as Chapter;
      }
      setChapter(current);
    };
    const request = (): void => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(check);
    };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    check();
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    };
  }, [wide]);

  return chapter;
};

export const App = () => {
  const [state, setState] = useState(createInitialState);
  const [flip, setFlip] = useState(0);
  const [activeGap, setActiveGap] = useState<GapName>("headerToParties");
  const wide = useMediaQuery("(min-width: 68.75rem)");
  const chapter = useChapter(wide);

  const input = useMemo(() => buildInput(state), [state]);
  const data = useMemo(() => createDocumentData(state.type, input), [state.type, input]);
  const kind = kindOf(state.type);

  // Structural changes carry the page's blocks across; value edits just redraw.
  const change = (patch: (current: DemoState) => DemoState, animate = false): void => {
    setState(patch);
    if (animate) setFlip((count) => count + 1);
  };
  const setType = (type: DocumentType): void => {
    if (type !== state.type) change((current) => ({ ...current, type }), true);
  };

  // The page takes the paper stock of the document on show.
  useEffect(() => {
    document.documentElement.dataset.kind = kind.slug;
  }, [kind.slug]);

  // The totals chapter needs amounts on the sheet. Only checked on arrival, so the
  // reader can still switch to a quantity-only document while they are there.
  useEffect(() => {
    if (chapter !== "totals") return;
    if (!isQuantityOnlyDocument(state.type) && state.modules.items) return;
    change(
      (current) => ({
        ...current,
        type: isQuantityOnlyDocument(current.type) ? "invoice" : current.type,
        modules: { ...current.modules, items: true }
      }),
      true
    );
  }, [chapter]);

  return (
    <>
      <a
        className="absolute top-3 left-3 z-100 -translate-y-[300%] rounded-sm bg-ink px-[0.9rem] py-[0.6rem] text-ground underline focus:translate-y-0"
        href="#types"
      >
        Skip to the live document
      </a>

      <main>
        <div
          className="mx-auto grid max-w-[96rem] grid-cols-[minmax(0,1fr)_auto] gap-x-[clamp(2rem,4.5vw,5.5rem)] px-gutter max-wide:grid-cols-[minmax(0,1fr)] max-wide:grid-rows-[auto_44svh_auto]"
          id="bench"
        >
          <Hero />
          <Stage
            data={data}
            kind={kind}
            spacing={state.spacing}
            chapter={chapter}
            activeGap={activeGap}
            wide={wide}
            flip={flip}
            onType={setType}
          />
          <div className="col-start-1 min-w-0 max-wide:row-start-3">
            <TypesChapter kind={kind} onType={setType} />
            <TotalsChapter state={state} kind={kind} totals={data.totals} onChange={change} />
            <ModulesChapter
              state={state}
              kind={kind}
              input={input}
              onToggle={(name, on) =>
                change((current) => ({ ...current, modules: { ...current.modules, [name]: on } }), true)
              }
            />
            <ColorsChapter
              colors={state.colors}
              kind={kind}
              onColors={(colors) => change((current) => ({ ...current, colors }))}
            />
            <SpacingChapter
              type={state.type}
              kind={kind}
              spacing={state.spacing}
              activeGap={activeGap}
              onActiveGap={setActiveGap}
              onSpacing={(spacing) => change((current) => ({ ...current, spacing }))}
              onReset={() => change((current) => ({ ...current, spacing: {} }), true)}
            />
          </div>
        </div>

        <Refusals />
        <Details />
        <Start />
        <Bill />
      </main>

      <Footer />
    </>
  );
};
