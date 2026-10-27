"use client";

import { useState, type InputHTMLAttributes } from "react";

/**
 * Formats an Uzbek mobile number while typing: "901234567" → "+998 90 123 45 67".
 * Purely cosmetic — the server normalises and validates with normalizePhone().
 */
export function formatPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  // Let people type the "+998" prefix themselves without it vanishing mid-way.
  if (d.length <= 3 && "998".startsWith(d) && raw.trim().startsWith("+")) return raw.trim();
  if (d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.length ? `+998 ${parts.join(" ")}` : "";
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "defaultValue"> & {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
};

/** Phone field for both uncontrolled forms (FormData) and controlled state (value + onValueChange). */
export function PhoneInput({ defaultValue = "", value, onValueChange, className = "field", ...rest }: Props) {
  const [inner, setInner] = useState(() => formatPhoneInput(defaultValue));
  const current = value ?? inner;
  return (
    <input
      {...rest}
      type="tel"
      inputMode="tel"
      autoComplete={rest.autoComplete ?? "tel"}
      placeholder={rest.placeholder ?? "+998 90 123 45 67"}
      className={className}
      value={current}
      onChange={(e) => {
        const next = formatPhoneInput(e.target.value);
        if (value === undefined) setInner(next);
        onValueChange?.(next);
      }}
    />
  );
}
