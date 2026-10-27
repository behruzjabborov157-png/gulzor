"use client";

import { useFormStatus } from "react-dom";

/** Submit button that disables itself while its form's server action runs (prevents double submits). */
export function SubmitButton({ children, className = "btn-primary btn-sm", pendingLabel, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} type="submit" className={className} disabled={pending || rest.disabled} aria-busy={pending}>
      {pending ? (pendingLabel ?? "…") : children}
    </button>
  );
}
