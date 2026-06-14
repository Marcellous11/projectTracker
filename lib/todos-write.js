import { promises as fs } from "node:fs";
import path from "node:path";

const STATUS_FILE = "STATUS.md";
const TODO_HEADING = /^##\s+to do\s*$/i;
const ANY_HEADING = /^##\s/;
const CHECKBOX_LINE = /^\s*[-*]\s+\[[ xX/~]\]\s+\S/;

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function insertTodoLine(raw, text) {
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);
  const headingIdx = lines.findIndex((l) => TODO_HEADING.test(l));
  const todoLine = `- [ ] ${text}`;

  if (headingIdx === -1) {
    // No ## To do section — append one at the end of the body.
    const trimmed = raw.replace(/\s+$/, "");
    const block = `${newline}${newline}## To do${newline}<!-- states: [ ] = to do · [/] = in progress · [x] = done -->${newline}${todoLine}${newline}`;
    return trimmed + block;
  }

  // Find the end of the section (next ## heading or EOF).
  let sectionEnd = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (ANY_HEADING.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  // Insert after the last checkbox line in the section. If there are no
  // checkbox lines yet, insert right after the heading (skipping any
  // comment/blank lines that immediately follow it).
  let insertAt = -1;
  for (let i = sectionEnd - 1; i > headingIdx; i--) {
    if (CHECKBOX_LINE.test(lines[i])) {
      insertAt = i + 1;
      break;
    }
  }
  if (insertAt === -1) {
    insertAt = headingIdx + 1;
    while (
      insertAt < sectionEnd &&
      (lines[insertAt].trim() === "" || lines[insertAt].trim().startsWith("<!--"))
    ) {
      insertAt++;
    }
  }

  lines.splice(insertAt, 0, todoLine);
  return lines.join(newline);
}

/**
 * Append a new `- [ ] text` to the project's STATUS.md `## To do` section,
 * creating both the file and the section if absent. Also refreshes the
 * `last_worked` frontmatter date to today so staleness reflects the edit.
 */
export async function appendTodo(dir, text) {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("empty to-do");
  if (clean.length > 500) throw new Error("to-do too long");

  const file = path.join(dir, STATUS_FILE);
  let raw;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    // Bootstrap a minimal STATUS.md if the project doesn't have one yet.
    const today = todayIso();
    raw = `---\nproject: ${path.basename(dir)}\nstatus: active\nlast_worked: ${today}\npriority: medium\n---\n`;
  }

  let next = insertTodoLine(raw, clean);
  next = updateFrontmatterDate(next);
  await fs.writeFile(file, next, "utf8");
}
