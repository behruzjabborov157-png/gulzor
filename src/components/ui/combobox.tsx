"use client";

import { useId, useRef, useState } from "react";
import { locationSearchKey } from "@/lib/translit";

export type ComboItem = { id: number; name: string; search?: string };

/**
 * Searchable select (ARIA combobox with a listbox popup). Typing filters by every spelling of a name:
 * Latin or Cyrillic, with or without apostrophes. Arrow keys move, Enter picks, Escape closes.
 */
export function Combobox({
  id,
  items,
  value,
  onChange,
  placeholder,
  noMatches,
  disabled,
  invalid,
  describedBy,
}: {
  id: string;
  items: ComboItem[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder: string;
  noMatches: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const selected = items.find((i) => i.id === value) ?? null;
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const q = query == null ? "" : locationSearchKey(query);
  const shown = (q ? items.filter((i) => (i.search ?? locationSearchKey(i.name)).includes(q)) : items).slice(0, 80);
  const activeIndex = Math.min(active, Math.max(0, shown.length - 1));

  const pick = (item: ComboItem) => {
    onChange(item.id);
    setQuery(null);
    setOpen(false);
  };
  const move = (to: number) => {
    setActive(to);
    listRef.current?.children[to]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="relative">
      <input
        id={id}
        className="field"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[activeIndex] ? `${listId}-${shown[activeIndex].id}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query ?? selected?.name ?? ""}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setQuery(null);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          if (!e.target.value) onChange(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            move(Math.min(activeIndex + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(Math.max(activeIndex - 1, 0));
          } else if (e.key === "Enter" && open && shown[activeIndex]) {
            e.preventDefault();
            pick(shown[activeIndex]);
          } else if (e.key === "Escape") {
            setOpen(false);
            setQuery(null);
          }
        }}
      />
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{noMatches}</li>
          ) : (
            shown.map((item, i) => (
              <li
                key={item.id}
                id={`${listId}-${item.id}`}
                role="option"
                aria-selected={item.id === value}
                className={`cursor-pointer px-3 py-2 text-sm ${i === activeIndex ? "bg-wine/10" : ""} ${item.id === value ? "font-semibold" : ""}`}
                // mousedown, not click: the input's blur would close the list first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(item);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {item.name}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
