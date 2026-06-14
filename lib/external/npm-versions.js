import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * npm registry — fetch latest dist-tag for a single package.
 *
 * `countOutdated(packageJsonContents)` takes a parsed package.json object
 * and returns `{deps, outdated}`, comparing each (non-workspace, non-file)
 * dep's range against the registry's `latest` dist-tag.
 *
 * Version comparison is intentionally crude — we treat `^1.2.3` / `~1.2.3` /
 * `>=1.2.3` etc. as "you're pinned to 1.2.3" and compare semver triplets.
 * Tagged releases (e.g. `next`, `beta`) and git/file/workspace specifiers
 * are skipped (not counted toward either total).
 */

const REGISTRY = "https://registry.npmjs.org";

async function fetchLatestVersion(pkg) {
  if (!pkg || /[\s"`<>|]/.test(pkg)) return null;
  // The /-/package/<name>/dist-tags endpoint is tiny and cacheable.
  const data = await safeFetch(`${REGISTRY}/-/package/${encodeURIComponent(pkg).replace(/%40/g, "@")}/dist-tags`, { timeoutMs: 2000 });
  if (!data?.latest || typeof data.latest !== "string") return null;
  return String(data.latest);
}

const getLatest = makeCached("npm-latest", fetchLatestVersion, 3600); // 1 h

function parseRange(range) {
  if (typeof range !== "string") return null;
  const m = range.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmpSemver(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function isSkippable(range) {
  if (typeof range !== "string") return true;
  if (range.startsWith("workspace:") || range.startsWith("file:")) return true;
  if (range.startsWith("git+") || range.startsWith("git:") || range.startsWith("github:")) return true;
  if (range.startsWith("http://") || range.startsWith("https://")) return true;
  if (range.startsWith("npm:")) return true; // aliases
  if (range === "*" || range === "latest" || range === "") return true;
  return false;
}

export async function countOutdated(pkgJson) {
  if (!config.signals.npm) return null;
  if (!pkgJson || typeof pkgJson !== "object") return null;
  const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };
  const entries = Object.entries(deps).filter(([, r]) => !isSkippable(r));
  if (!entries.length) return { deps: 0, outdated: 0 };

  // Concurrency cap to be polite to the registry.
  const CONCURRENCY = 8;
  let i = 0;
  let outdated = 0;
  async function worker() {
    while (i < entries.length) {
      const [name, range] = entries[i++];
      const cur = parseRange(range);
      if (!cur) continue;
      const latest = await getLatest(name);
      if (!latest) continue;
      const lat = parseRange(latest);
      if (!lat) continue;
      if (cmpSemver(lat, cur) > 0) outdated++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker));
  return { deps: entries.length, outdated };
}
