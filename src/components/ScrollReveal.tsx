import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Global scroll-reveal: auto-tags meaningful blocks with `.gs-reveal`
 * and adds `.gs-in` when they enter the viewport. Inspired by the
 * subtle fade-up transitions used on virtualdj.com.
 *
 * - Re-scans the DOM on every route change.
 * - Watches for dynamically inserted nodes via MutationObserver.
 * - Skips small/inline elements and anything already animated.
 */
const SELECTOR = [
  "section",
  "article",
  "header",
  "footer",
  "h1",
  "h2",
  "h3",
  "[data-reveal]",
  ".card",
  ".reveal",
].join(",");

const SKIP_INSIDE = ["nav", "[data-no-reveal]", ".sticky-mini-player", ".gs-page-skip"];

export function ScrollReveal() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("gs-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );

    const tag = (root: ParentNode) => {
      const nodes = root.querySelectorAll<HTMLElement>(SELECTOR);
      nodes.forEach((el) => {
        if (el.classList.contains("gs-reveal")) return;
        if (SKIP_INSIDE.some((sel) => el.closest(sel))) return;
        // Skip if element is already visible at top of viewport on first paint
        el.classList.add("gs-reveal");
        io.observe(el);
      });
    };

    // Initial pass (after layout/paint)
    const t = window.setTimeout(() => tag(document.body), 50);

    // Watch for dynamically added nodes
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 1) tag(node as HTMLElement);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(t);
      mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
