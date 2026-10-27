"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed store. Used only for per-browser conveniences
 * (cart contents, recently viewed, guest favorites). Orders, prices and stock
 * always live in the database and are re-validated on the server.
 */
export function createLocalStore<T>(key: string, initial: T, validate: (v: unknown) => T) {
  let state: T = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  function load() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) state = validate(JSON.parse(raw));
    } catch {
      state = initial;
    }
  }

  function set(next: T | ((prev: T) => T)) {
    load();
    state = typeof next === "function" ? (next as (p: T) => T)(state) : next;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* storage may be unavailable (private mode) — keep in memory */
    }
    listeners.forEach((l) => l());
  }

  function subscribe(l: () => void) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        loaded = false;
        load();
        listeners.forEach((x) => x());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  }

  function get() {
    load();
    return state;
  }

  function useStore(): [T, typeof set, boolean] {
    const value = useSyncExternalStore(subscribe, get, () => initial);
    const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
    return [value, set, hydrated];
  }

  return { get, set, useStore };
}
