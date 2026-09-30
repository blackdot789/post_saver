import { useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefCallback } from "react";
import { columnsFor, placeItems } from "./grid.ts";

// The grid: columns of cards, each card as tall as its content. The cards stay in one list in
// reading order (newest first for keyboards and screen readers) and are only positioned, so a
// card changing height, or moving to another column, never reloads its preview.

interface MasonryProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  /** The narrowest a column may be; the grid has as many columns as fit. */
  minColumnWidth: number;
  gap: number;
  /** A rough height for an item in a column this wide, used until it has been measured. */
  estimate: (item: T, columnWidth: number) => number;
  children: (item: T) => ReactNode;
  label: string;
}

export function Masonry<T>({ items, getKey, minColumnWidth, gap, estimate, children, label }: MasonryProps<T>) {
  const list = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState(0);
  const heights = useRef(new Map<string, number>());
  const [measured, setMeasured] = useState(0);
  const elements = useRef(new Map<Element, string>());

  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (!("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One observer for every card: a changed height moves the cards below it.
  const observer = useRef<ResizeObserver | null>(null);
  if (!observer.current && typeof ResizeObserver !== "undefined") {
    observer.current = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const key = elements.current.get(entry.target);
        const height = (entry.target as HTMLElement).offsetHeight;
        if (key !== undefined && height > 0 && heights.current.get(key) !== height) {
          heights.current.set(key, height);
          changed = true;
        }
      }
      if (changed) setMeasured((n) => n + 1);
    });
  }
  useLayoutEffect(() => () => observer.current?.disconnect(), []);

  // One ref callback per card, kept between renders so a card is observed once.
  const watchers = useRef(new Map<string, RefCallback<HTMLLIElement>>());
  const watch = (key: string): RefCallback<HTMLLIElement> => {
    let ref = watchers.current.get(key);
    if (!ref) {
      ref = (el) => {
        if (!el) return;
        elements.current.set(el, key);
        observer.current?.observe(el);
        return () => {
          elements.current.delete(el);
          observer.current?.unobserve(el);
          watchers.current.delete(key);
          heights.current.delete(key);
        };
      };
      watchers.current.set(key, ref);
    }
    return ref;
  };

  const { columns, columnWidth } = columnsFor(width, minColumnWidth, gap);
  const keys = useMemo(() => items.map(getKey), [items, getKey]);
  const order = keys.join("\n");

  // Which column each card is in. Decided when the list or the number of columns changes (from
  // the heights known then), and kept while previews load, so cards don't hop between columns.
  const assigned = useMemo(
    () => placeItems(items.map((item, i) => heights.current.get(keys[i]!) ?? estimate(item, columnWidth)), columns, gap).map((p) => p.column),
    // Deliberately not recomputed when a height changes.
    [order, columns],
  );

  const layout = useMemo(
    () => placeItems(items.map((item, i) => heights.current.get(keys[i]!) ?? estimate(item, columnWidth)), columns, gap, assigned),
    // `measured` counts the height changes the observer has seen.
    [order, columns, columnWidth, measured, assigned],
  );
  const height = layout.reduce((tallest, p) => Math.max(tallest, p.bottom), 0);

  return (
    <ul ref={list} aria-label={label} className="relative" style={{ height: width > 0 ? height : undefined }}>
      {width > 0 &&
        items.map((item, i) => {
          const key = keys[i]!;
          const place = layout[i];
          return (
            <li key={key} ref={watch(key)} className="absolute" style={{ width: columnWidth, left: (place?.column ?? 0) * (columnWidth + gap), top: place?.top ?? 0 }}>
              {children(item)}
            </li>
          );
        })}
    </ul>
  );
}
