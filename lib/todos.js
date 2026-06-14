import { section } from "./scan.js";

// Matches a markdown checkbox line: "- [ ] text", "- [/] text", "- [x] text".
// Group 1 = the state char, group 2 = the task text.
const TODO_LINE = /^\s*[-*]\s+\[([ xX/~])\]\s+(.*\S)\s*$/;

function stateFor(ch) {
  if (ch === "x" || ch === "X") return "done";
  if (ch === "/" || ch === "~") return "doing";
  return "todo";
}

/**
 * Parse the `## To do` checklist out of a STATUS.md body.
 * Non-checkbox lines (prose, blanks) are skipped. Absent/empty → [].
 *
 * @returns {Array<{ text: string, state: "todo"|"doing"|"done" }>}
 */
export function parseTodos(body) {
  if (!body) return [];
  const block = section(body, "To do");
  if (!block) return [];
  const out = [];
  for (const line of block.split(/\r?\n/)) {
    const m = TODO_LINE.exec(line);
    if (m) out.push({ text: m[2].trim(), state: stateFor(m[1]) });
  }
  return out;
}

/** Tally to-do states. `open` = todo + doing (the actionable backlog). */
export function todoCounts(todos = []) {
  const counts = { todo: 0, doing: 0, done: 0, open: 0 };
  for (const t of todos) counts[t.state]++;
  counts.open = counts.todo + counts.doing;
  return counts;
}
