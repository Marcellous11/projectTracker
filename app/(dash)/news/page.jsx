import { getHeadlines } from "@/lib/external/news.js";
import { config as extConfig } from "@/lib/external/config.js";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import HeadlinesPanel from "@/components/news/headlines-panel.jsx";

export const dynamic = "force-dynamic";
export const revalidate = 60;

function fmtSyncTime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

export default async function NewsPage() {
  // Fetch all four scopes in parallel. Each call hits the cached sources, so
  // overlapping reads are free.
  const [local, federal, world, context] = await Promise.all([
    getHeadlines({ scope: "local",   limit: 30 }),
    getHeadlines({ scope: "federal", limit: 30 }),
    getHeadlines({ scope: "world",   limit: 30 }),
    getHeadlines({ scope: "context", limit: 10 }),
  ]);

  const subInfo = extConfig.user.subreddit
    ? `r/${extConfig.user.subreddit}`
    : null;

  const totalAll = local.length + federal.length + world.length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline gap-3">
        <h1 className="hud-mono uppercase tracking-[0.22em] text-foreground text-base font-semibold">
          // NEWS
        </h1>
        <span className="hud-mono text-[10px] text-hud-ink-dim">
          {totalAll} headlines · synced {fmtSyncTime()}
        </span>
      </header>

      <Tabs defaultValue={federal.length ? "federal" : (world.length ? "world" : "local")}>
        <TabsList>
          <TabsTrigger value="local">LOCAL{subInfo ? ` · ${subInfo}` : ""}</TabsTrigger>
          <TabsTrigger value="federal">FEDERAL</TabsTrigger>
          <TabsTrigger value="world">WORLD</TabsTrigger>
          <TabsTrigger value="context">ON THIS DAY</TabsTrigger>
        </TabsList>

        <TabsContent value="local" className="mt-4">
          <HeadlinesPanel
            items={local}
            scope="local"
            title="// LOCAL"
            caption={subInfo || "no local source set"}
            emptyHint={
              subInfo
                ? "// no local headlines right now (Reddit returned nothing or timed out)"
                : "// Set USER_SUBREDDIT or USER_CITY in env to enable local headlines"
            }
          />
        </TabsContent>

        <TabsContent value="federal" className="mt-4">
          <HeadlinesPanel
            items={federal}
            scope="federal"
            title="// FEDERAL"
            caption="AP + NPR"
          />
        </TabsContent>

        <TabsContent value="world" className="mt-4">
          <HeadlinesPanel
            items={world}
            scope="world"
            title="// WORLD"
            caption="BBC + Reuters + GDELT"
          />
        </TabsContent>

        <TabsContent value="context" className="mt-4">
          <HeadlinesPanel
            items={context}
            scope="context"
            title="// ON THIS DAY"
            caption="Wikipedia"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
