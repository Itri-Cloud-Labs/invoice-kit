import kitPackage from "../../../packages/typescript/package.json";
import { NPM, REPO } from "../demo/options";
import { cx } from "../lib/cx";
import { WRAP } from "./ui";

const ROW = "flex flex-wrap justify-between gap-x-7 gap-y-[0.6rem]";
const LINK = "underline decoration-1 underline-offset-[0.22em] hover:decoration-2";

export const Footer = () => (
  <footer className="border-t-[1.5px] border-ink pt-[1.6rem] pb-[2.2rem] text-[0.92rem]">
    <div className={cx(WRAP, ROW)}>
      <p>
        <strong className="font-display font-[760]">invoice-kit</strong> v{kitPackage.version}, by Itri Cloud Labs. MIT
        licence.
      </p>
      <ul className={ROW}>
        <li>
          <a className={LINK} href={REPO}>
            GitHub
          </a>
        </li>
        <li>
          <a className={LINK} href={NPM}>
            npm
          </a>
        </li>
        <li>
          <a className={LINK} href={`${REPO}/issues`}>
            Report an issue
          </a>
        </li>
      </ul>
    </div>
  </footer>
);
