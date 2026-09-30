import { Button } from "../ui/Button.tsx";

interface BulkBarProps {
  count: number;
  inTrash: boolean;
  onFavorite: () => void;
  onTags: () => void;
  onCollections: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}

/** Actions on the selected saves, pinned to the bottom of the screen. */
export function BulkBar({ count, inTrash, onFavorite, onTags, onCollections, onTrash, onRestore, onDeleteForever, onSelectAll, onClear }: BulkBarProps) {
  return (
    <div role="region" aria-label="Selected saves" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-night/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-2 text-sm font-semibold">{count === 1 ? "1 selected" : `${count} selected`}</span>
        <Button variant="secondary" size="sm" onClick={onSelectAll}>
          Select all
        </Button>
        {inTrash ? (
          <>
            <Button variant="secondary" size="sm" onClick={onRestore} disabled={count === 0}>
              Restore
            </Button>
            <Button variant="secondary" size="sm" onClick={onDeleteForever} disabled={count === 0} className="text-red-700 dark:text-red-300">
              Delete forever
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={onFavorite} disabled={count === 0}>
              Favorite
            </Button>
            <Button variant="secondary" size="sm" onClick={onTags} disabled={count === 0}>
              Add tags
            </Button>
            <Button variant="secondary" size="sm" onClick={onCollections} disabled={count === 0}>
              Add to collection
            </Button>
            <Button variant="secondary" size="sm" onClick={onTrash} disabled={count === 0} className="text-red-700 dark:text-red-300">
              Move to Trash
            </Button>
          </>
        )}
        <Button variant="link" size="sm" onClick={onClear} className="ml-auto text-sm">
          Cancel
        </Button>
      </div>
    </div>
  );
}
