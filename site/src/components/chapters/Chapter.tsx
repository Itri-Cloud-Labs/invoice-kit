import type { ReactNode } from "react";
import type { Chapter as ChapterName } from "../../demo/options";

interface ChapterProps {
  name: ChapterName;
  title: string;
  children: ReactNode;
}

export const Chapter = ({ name, title, children }: ChapterProps) => (
  <section
    id={name}
    data-chapter={name}
    className="flex min-h-svh max-w-[40rem] flex-col justify-center gap-6 py-20 max-wide:min-h-0 max-wide:max-w-[44rem] max-wide:py-14"
  >
    <h2>{title}</h2>
    {children}
  </section>
);

export const Lead = ({ children }: { children: ReactNode }) => <p className="max-w-[36rem] text-pretty">{children}</p>;
