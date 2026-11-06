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
    const fresh = () => document.querySelectorAll("[data-reveal]:not([data-revealed]):not([data-reveal-watched])");
    // At load, anything already on screen is shown at once (all measured in one pass, before anything is hidden).
    const initial = [...fresh()];
    const rects = initial.map((el) => el.getBoundingClientRect());
    initial.forEach((el, i) => {
      el.setAttribute("data-reveal-watched", "");
      if (rects[i].top < window.innerHeight && rects[i].bottom > 0) el.setAttribute("data-revealed", "");
      else io.observe(el);
    });
    root.setAttribute("data-reveal-ready", "");
    // Elements added later (client navigation, streaming) are handed to the observer, at most once per frame.
    let queued = 0;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        fresh().forEach((el) => {
          el.setAttribute("data-reveal-watched", "");
          io.observe(el);
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(queued);
      root.removeAttribute("data-reveal-ready");
    };
  }, []);
  return null;
}
