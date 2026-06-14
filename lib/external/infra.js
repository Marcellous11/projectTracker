import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * Statuspage-format summaries for infra services that matter to this
 * project's stack. Anonymous /api/v2/summary.json on each statuspage.
 *
 * Returns `{name, indicator, description, incidents: [{id, name, ts, impact, url}]}`.
 * `indicator` follows statuspage convention: none|minor|major|critical.
 */

const SERVICES = [
  { name: "vercel",     base: "https://www.vercel-status.com" },
  { name: "github",     base: "https://www.githubstatus.com" },
  { name: "npm",        base: "https://status.npmjs.org" },
  { name: "cloudflare", base: "https://www.cloudflarestatus.com" },
];

async function fetchOne(svc) {
  const data = await safeFetch(`${svc.base}/api/v2/summary.json`, { timeoutMs: 1500 });
  if (!data?.status) return null;
  const incidents = Array.isArray(data.incidents) ? data.incidents : [];
  return {
    name: svc.name,
    indicator: String(data.status.indicator || "none"),
    description: String(data.status.description || "All systems normal"),
    incidents: incidents
      .filter((i) => i?.status !== "resolved")
      .slice(0, 3)
      .map((i) => ({
        id: String(i.id),
        name: String(i.name || ""),
        ts: String(i.updated_at || i.created_at || new Date().toISOString()),
        impact: String(i.impact || "none"),
        url: String(i.shortlink || ""),
      })),
  };
}

async function fetchInfra() {
  if (!config.signals.infra) return [];
  const results = await Promise.allSettled(SERVICES.map(fetchOne));
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter(Boolean);
}

export const getInfraStatus = makeCached("infra", fetchInfra, 60); // 1 min
