"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

export type AddressCandidate = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
};

// Shared by event-manager.tsx's Address field and discovery-map.tsx's
// Location field — 2 concrete usages, not CLAUDE.md's literal "three
// times" duplication threshold, but the logic here (debounce, fetch,
// keyboard nav, click-outside-close) is stateful and a11y-sensitive
// enough that duplicating it risks real behavioral drift between the
// two forms. See DECISIONS.md/plan notes for the full reasoning.
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onEnterWithoutSelection,
  placeholder,
  className,
  inputId,
  required,
}: {
  value: string;
  onChange: (text: string) => void;
  onSelect: (candidate: AddressCandidate) => void;
  onEnterWithoutSelection?: (text: string) => void;
  placeholder?: string;
  className?: string;
  inputId?: string;
  required?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<AddressCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // Debounced fetch, triggered from the input's own onChange handler
  // (handleInputChange below) rather than a useEffect watching `value`.
  // Two reasons: (1) React's set-state-in-effect lint rule flags
  // synchronous setState calls inside an effect body — this keeps
  // setState calls inside genuine event-handler/async-callback flows;
  // (2) more importantly, `value` is a controlled prop the parent also
  // updates on selection (selectCandidate below calls onChange with the
  // picked address) — a value-watching effect would re-fire the
  // debounce right after a selection and pop the dropdown back open
  // 300ms later, which is wrong. Tying the debounce to the actual
  // keystroke event avoids that entirely.
  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (newValue.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const thisRequestId = ++requestIdRef.current;
      const res = await fetch("/api/geocode/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: newValue }),
      });
      if (thisRequestId !== requestIdRef.current) return;
      if (!res.ok) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      const { results } = await res.json();
      const candidates: AddressCandidate[] = results ?? [];
      setSuggestions(candidates);
      setOpen(candidates.length > 0);
      setHighlightedIndex(-1);
    }, 300);
  }

  // Clear any in-flight debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectCandidate(candidate: AddressCandidate) {
    onChange(candidate.formattedAddress);
    onSelect(candidate);
    setSuggestions([]);
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter" && onEnterWithoutSelection) {
        onEnterWithoutSelection(value);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0) {
        selectCandidate(suggestions[highlightedIndex]);
      } else {
        setOpen(false);
        onEnterWithoutSelection?.(value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const listboxId = inputId ? `${inputId}-listbox` : undefined;

  return (
    <div ref={containerRef} className="relative">
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
        autoComplete="off"
        className={className}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded border border-twine bg-paper text-sm shadow-md"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.latitude},${s.longitude}`}
              role="option"
              aria-selected={i === highlightedIndex}
              onMouseDown={(e) => {
                // Prevent the input's blur from firing before this click
                // registers, which would close the dropdown first.
                e.preventDefault();
                selectCandidate(s);
              }}
              onMouseEnter={() => setHighlightedIndex(i)}
              className={`cursor-pointer px-2 py-1.5 ${
                i === highlightedIndex ? "bg-stamp text-paper" : "text-ink hover:bg-stamp/10"
              }`}
            >
              {s.formattedAddress}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
