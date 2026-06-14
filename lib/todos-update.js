import { promises as fs } from "node:fs";
import path from "node:path";

const STATUS_FILE = "STATUS.md";
// Parts: [-/*] + [<mark>] + space + text + optional trailing whitespace.
const TODO_LINE = /^(\s*[-*]\s+\[)([ xX/~])(\]\s+)(.*\S)(\s*)$/;

const STATE_TO_MARK = { todo: " ", doing: "/", done: "x" };

function stateForMark(ch) {
  if (ch === "x" || ch === "X") return "done";
  if (ch === "/" || ch === "~") return "doing";
  return "todo";
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function updateFrontmatterDate(raw) {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  const fmBlock = raw.slice(0, end);
  const rest = raw.slice(end);
  const today = todayIso();
  if (/^last_worked:\s*.*$/m.test(fmBlock)) {
    return fmBlock.replace(/^last_worked:\s*.*$/m, `last_worked: ${today}`) + rest;
  }
  return raw;
}

/**
 * Flip the checkbox state of the first todo line whose text matches `text` and
 * whose current state matches `fromState`. Throws if no matching line is found.
 */
export async function updateTodoState(dir, text, fromState, toState) {
  if (!(fromState in STATE_TO_MARK)) throw new Error(`invalid fromState: ${fromState}`);
  if (!(toState in STATE_TO_MARK)) throw new Error(`invalid toState: ${toState}`);
  if (fromState === toState) return;

  const target = String(text || "").trim();
  if (!target) throw new Error("empty text");

  const file = path.join(dir, STATUS_FILE);
  const raw = await fs.readFile(file, "utf8");
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);

  let foundIdx = -1;
  let matched;
  for (let i = 0; i < lines.length; i++) {
    const m = TODO_LINE.exec(lines[i]);
    if (!m) continue;
    if (m[4].trim() === target && stateForMark(m[2]) === fromState) {
      foundIdx = i;
      matched = m;
      break;
    }
  }
  if (foundIdx === -1) {
    throw new Error(`todo not found (state=${fromState}, text="${target.slice(0, 60)}")`);
  }

  const newMark = STATE_TO_MARK[toState];
  lines[foundIdx] = `${matched[1]}${newMark}${matched[3]}${matched[4]}${matched[5] || ""}`;

  let next = lines.join(newline);
  next = updateFrontmatterDate(next);
  await fs.writeFile(file, next, "utf8");
}
