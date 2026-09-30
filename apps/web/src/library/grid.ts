// The arithmetic of the library's grid (Masonry.tsx), kept pure so it can be tested.

/** How many columns fit, and how wide each is. Always at least one column. */
export function columnsFor(width: number, minColumnWidth: number, gap: number): { columns: number; columnWidth: number } {
  if (!(width > 0)) return { columns: 1, columnWidth: minColumnWidth };
  const columns = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)));
  return { columns, columnWidth: Math.floor((width - gap * (columns - 1)) / columns) };
}

export interface Placement {
  column: number;
  top: number;
  bottom: number;
}

/**
 * Places items of the given heights into columns. Each item goes into the shortest column so
 * far (the leftmost on a tie), which keeps reading order close to left-to-right, top-to-bottom.
 * With `columnOf`, the items keep those columns and only the vertical positions are worked out.
 */
export function placeItems(heights: readonly number[], columns: number, gap: number, columnOf?: readonly number[]): Placement[] {
  const bottoms = new Array<number>(columns).fill(0);
  return heights.map((height, i) => {
    let column = columnOf?.[i];
    if (column === undefined || column >= columns) {
      column = 0;
      for (let c = 1; c < columns; c++) if (bottoms[c]! < bottoms[column]!) column = c;
    }
    const top = bottoms[column]!;
    bottoms[column] = top + height + gap;
    return { column, top, bottom: top + height };
  });
}
