import type { CategoryInfo } from "@postsaver/core";
import { cx } from "../ui/cx.ts";

/** A category as a card shows it: its symbol and its name. */
export function CategoryBadge({ category, className }: { category: CategoryInfo; className?: string }) {
  return (
    <span data-category={category.id} className={cx("inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold", className)}>
      <span aria-hidden="true">{category.symbol}</span>
      <span className="truncate">{category.name}</span>
    </span>
  );
}
