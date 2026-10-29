"use client";

import { useEffect } from "react";

/**
 * Scroll-reveal for elements marked with data-reveal (styles in globals.css).
 * Content is only hidden after this runs, so the page never depends on JavaScript to be readable.
 * A MutationObserver picks up elements added by client-side navigation.
 */
export function RevealObserver() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-revealed", "");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const scan = () => {
      document.querySelectorAll("[data-reveal]:not([data-revealed])").forEach((el) => {
        // Anything already on screen at load is shown immediately, without waiting for a scroll.
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0 && !root.hasAttribute("data-reveal-ready")) el.setAttribute("data-revealed", "");
        else io.observe(el);
      });
    };
    scan();
    root.setAttribute("data-reveal-ready", "");
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      root.removeAttribute("data-reveal-ready");
    };
  }, []);
  return null;
}
