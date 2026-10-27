"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React 19 resets uncontrolled fields after a `<form action>` completes, which would wipe
 * what the user typed whenever the server returns a validation error. Submitting through
 * onSubmit keeps the values while still running the same server action.
 */
export function submitWithoutReset(action: (form: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(form));
  };
}
