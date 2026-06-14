/**
 * Best-effort cost estimates for Claude API usage in $.
 * Rates are $ per 1M tokens. Source: https://www.anthropic.com/pricing
 * These are estimates — refresh from the pricing page as needed.
 */

const RATES = {
  "claude-opus-4-7":   { input: 15, output: 75, cacheRead: 1.5,  cacheWrite: 18.75 },
  "claude-sonnet-4-6": { input:  3, output: 15, cacheRead: 0.3,  cacheWrite:  3.75 },
  "claude-haiku-4-5":  { input:  1, output:  5, cacheRead: 0.1,  cacheWrite:  1.25 },
};

function rateFor(model) {
  if (!model) return RATES["claude-sonnet-4-6"];
  if (RATES[model]) return RATES[model];
  if (model.includes("opus"))   return RATES["claude-opus-4-7"];
  if (model.includes("haiku"))  return RATES["claude-haiku-4-5"];
  return RATES["claude-sonnet-4-6"];
}

export function estimateCostUSD(model, tokens) {
  if (!tokens) return 0;
  const r = rateFor(model);
  const { input = 0, output = 0, cacheCreation = 0, cacheRead = 0 } = tokens;
  return (
    (input         * r.input      +
     output        * r.output     +
     cacheCreation * r.cacheWrite +
     cacheRead     * r.cacheRead) / 1_000_000
  );
}
