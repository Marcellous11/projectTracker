import { getReviews } from "@/lib/reviews.js";
import { relativeAge } from "@/lib/time.js";
import ReviewClient from "@/components/review/review-client.jsx";
import { CalendarRange } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const r = getReviews();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="soft-title flex items-center gap-2 text-[20px]">
          <CalendarRange size={20} strokeWidth={1.75} className="text-green" aria-hidden />
          Review &amp; Planning
        </h1>
        <span className="text-[12px] text-hud-ink-dim">
          {r.ok && r.generatedAt ? `synced ${relativeAge(r.generatedAt)}` : "no sync yet"}
          {r.ok && r.stale ? " · stale" : ""}
        </span>
      </header>

      {!r.ok && (
        <p className="rounded-xl border border-dashed border-hud-border px-4 py-8 text-center text-sm text-muted-foreground">
          No review snapshot yet. It runs on a timer — give it a few minutes, or run
          <code className="mx-1 rounded bg-card px-1">node scripts/reviews-sync.js</code>.
        </p>
      )}

      <ReviewClient day={r.day} week={r.week} month={r.month} />
    </div>
  );
}
