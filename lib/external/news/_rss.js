/**
 * Tiny regex-based RSS/Atom item extractor. Sufficient for the well-formed
 * mainstream news feeds we target (AP / NPR / BBC / Reuters). Not a general
 * XML parser — if a feed deviates wildly, the source's adapter file can
 * fall back to its own scraping. Zero deps.
 *
 * Returns `[{ title, link, pubDate, description, guid }, …]`.
 */

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  hellip: "…", mdash: "—", ndash: "–",
};

export function decodeEntities(s) {
  if (typeof s !== "string") return "";
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => ENTITIES[name.toLowerCase()] ?? `&${name};`);
}

export function stripTags(s) {
  if (typeof s !== "string") return "";
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function pick(itemXml, tag) {
  // CDATA-aware: matches <tag>...</tag> or <tag><![CDATA[...]]></tag>
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`,
    "i"
  );
  const m = itemXml.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

function pickAttr(itemXml, tag, attr) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}=[\"\']([^\"\']+)[\"\']`, "i");
  const m = itemXml.match(re);
  return m ? m[1] : "";
}

/** Parse an RSS 2.0 feed into a list of items. */
export function parseRss(xml) {
  if (typeof xml !== "string" || xml.length < 50) return [];
  const items = [];
  const itemRe = /<item\b[\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const block = m[0];
    items.push({
      title: decodeEntities(stripTags(pick(block, "title"))),
      link: decodeEntities(pick(block, "link")),
      pubDate: pick(block, "pubDate") || pick(block, "dc:date") || pick(block, "published"),
      description: decodeEntities(stripTags(pick(block, "description") || pick(block, "summary"))),
      guid: pick(block, "guid"),
    });
  }
  return items;
}

/** Parse an Atom feed (some publishers use it). */
export function parseAtom(xml) {
  if (typeof xml !== "string" || xml.length < 50) return [];
  const items = [];
  const entryRe = /<entry\b[\s\S]*?<\/entry>/gi;
  let m;
  while ((m = entryRe.exec(xml))) {
    const block = m[0];
    const link = pickAttr(block, "link", "href") || pick(block, "link");
    items.push({
      title: decodeEntities(stripTags(pick(block, "title"))),
      link: decodeEntities(link),
      pubDate: pick(block, "updated") || pick(block, "published"),
      description: decodeEntities(stripTags(pick(block, "summary") || pick(block, "content"))),
      guid: pick(block, "id"),
    });
  }
  return items;
}

/** Auto-detect RSS vs Atom; return items. */
export function parseFeed(xml) {
  if (typeof xml !== "string") return [];
  if (/<feed\b/i.test(xml)) return parseAtom(xml);
  return parseRss(xml);
}

/** ISO-normalize a feed timestamp; null on parse failure. */
export function toIso(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(+d)) return null;
  return d.toISOString();
}

/** First N chars of a string, on a word boundary. */
export function clip(s, n) {
  if (!s) return "";
  if (s.length <= n) return s;
  const slice = s.slice(0, n + 1);
  const last = slice.lastIndexOf(" ");
  return (last > 0 ? slice.slice(0, last) : slice.slice(0, n)).trimEnd() + "…";
}
