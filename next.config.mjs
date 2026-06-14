/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dashboard reads files off disk at request time, so nothing here
  // should be statically optimized. The page itself opts into dynamic
  // rendering via `export const dynamic = "force-dynamic"`.

  // Produce a self-contained server bundle (.next/standalone) so the Docker
  // image can run with just `node server.js` and a minimal node_modules.
  output: "standalone",

  // Hide the dev floating indicator (the "N" circle in the bottom-left)
  // — it overlaps the sidebar footer (// SHOWING N · live · idle counters).
  devIndicators: false,
};

export default nextConfig;
