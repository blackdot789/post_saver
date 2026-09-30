import { Button } from "../ui/Button.tsx";

/** First run: whether previews may load from the platforms (they can set their cookies). */
export function ConsentBanner({ onChoose }: { onChoose: (previews: "always" | "click") => void }) {
  return (
    <div role="region" aria-label="Previews" className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-100">
      <p className="font-semibold">Show previews of your saved posts?</p>
      <p className="mt-1">
        Previews load from Instagram, YouTube, X and the other platforms, which may set their cookies. You can change this any time in
        Settings.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onChoose("always")}>
          Always show previews
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onChoose("click")}>
          Only when I tap
        </Button>
      </div>
    </div>
  );
}
