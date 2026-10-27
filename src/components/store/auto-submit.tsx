"use client";

import { useEffect, useRef } from "react";

/** Submits the parent GET form when a select/checkbox changes (the form still works without JS). */
export function AutoSubmit({ collapseOnMobile = false }: { collapseOnMobile?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const details = form.closest("details");
    if (collapseOnMobile && details && window.matchMedia("(max-width: 1023px)").matches) details.open = false;
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.tagName === "SELECT" || t.type === "checkbox") form.requestSubmit();
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, [collapseOnMobile]);
  return <span ref={ref} hidden />;
}
