import { describe, expect, it } from "vitest";
import { columnsFor, placeItems } from "./grid.ts";

describe("the library grid", () => {
  it("has as many columns as fit, never less than one", () => {
    expect(columnsFor(976, 300, 16)).toEqual({ columns: 3, columnWidth: 314 });
    expect(columnsFor(1312, 300, 16)).toEqual({ columns: 4, columnWidth: 316 });
    expect(columnsFor(358, 300, 16)).toEqual({ columns: 1, columnWidth: 358 });
    // A phone narrower than one column still gets one, as wide as the screen allows.
    expect(columnsFor(280, 300, 16)).toEqual({ columns: 1, columnWidth: 280 });
    expect(columnsFor(0, 300, 16)).toEqual({ columns: 1, columnWidth: 300 });
  });

  it("puts each card in the shortest column, the leftmost on a tie", () => {
    const placed = placeItems([100, 300, 200, 50, 50], 3, 10);
    expect(placed.map((p) => p.column)).toEqual([0, 1, 2, 0, 0]);
    expect(placed.map((p) => p.top)).toEqual([0, 0, 0, 110, 170]);
    expect(placed[4]).toEqual({ column: 0, top: 170, bottom: 220 });
  });

  it("keeps cards in their columns when only the heights change", () => {
    const columns = placeItems([100, 300, 200, 50], 3, 10).map((p) => p.column);
    // The first card grew: the fourth stays under it instead of hopping to another column.
    const placed = placeItems([500, 300, 200, 50], 3, 10, columns);
    expect(placed.map((p) => p.column)).toEqual(columns);
    expect(placed[3]).toEqual({ column: 0, top: 510, bottom: 560 });
  });

  it("falls back to the shortest column when a remembered column no longer exists", () => {
    expect(placeItems([100, 100, 100], 2, 10, [0, 1, 2]).map((p) => p.column)).toEqual([0, 1, 0]);
  });
});
