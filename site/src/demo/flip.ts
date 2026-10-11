// Carries the keyed blocks of the page across a re-render: blocks that stay
// glide to their new place, new ones fade in, dropped ones fade out.

const LEAVES = "[data-key]:not([data-key='header']):not([data-key='parties']):not([data-key='table']):not([data-key='trailing'])";
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export interface Box {
  left: number;
  top: number;
  width: number;
  node: HTMLElement;
}

export const measure = (page: HTMLElement): Map<string, Box> => {
  const origin = page.getBoundingClientRect();
  const scale = origin.width / page.offsetWidth || 1;
  const boxes = new Map<string, Box>();
  for (const node of page.querySelectorAll<HTMLElement>(LEAVES)) {
    const rect = node.getBoundingClientRect();
    boxes.set(node.dataset.key ?? "", {
      left: (rect.left - origin.left) / scale,
      top: (rect.top - origin.top) / scale,
      width: rect.width / scale,
      node
    });
  }
  return boxes;
};

// `before` holds the boxes of the previous render. React has already detached the
// blocks that left, so they are cloned into `ghosts` to fade out where they stood.
export const animateSwap = (ghosts: HTMLElement, before: Map<string, Box>, after: Map<string, Box>): void => {
  for (const [name, box] of after) {
    const old = before.get(name);
    if (!old) {
      box.node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 140, easing: "ease-out", fill: "backwards" });
      continue;
    }
    const dx = old.left - box.left;
    const dy = old.top - box.top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      box.node.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: 560, easing: EASE }
      );
    }
  }

  for (const [name, box] of before) {
    if (after.has(name)) continue;
    const ghost = box.node.cloneNode(true) as HTMLElement;
    ghost.removeAttribute("data-key");
    ghost.querySelectorAll("[data-key]").forEach((node) => node.removeAttribute("data-key"));
    ghost.classList.add("pg-ghost");
    ghost.style.left = `${box.left}px`;
    ghost.style.top = `${box.top}px`;
    ghost.style.width = `${box.width}px`;
    ghosts.append(ghost);
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-in", fill: "forwards" }).finished
      .then(() => ghost.remove())
      .catch(() => ghost.remove());
  }
};
