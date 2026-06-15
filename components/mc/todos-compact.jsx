import Link from "next/link";
import Module from "@/components/hud/module.jsx";
import AddTodo from "@/components/add-todo.jsx";
import TodoKanban from "@/components/todo-kanban.jsx";

const CAP_PER_COL = 10;

/**
 * Home-page module: wraps the shared TodoKanban in HUD chrome, an add-form,
 * a column cap with overflow links to the full /todos board.
 */
export default function TodosCompact({ projects }) {
  const items = [];
  for (const p of projects) {
    for (const t of p.todos || []) {
      items.push({
        text: t.text,
        state: t.state,
        projectName: p.name,
        projectRel: p.rel,
        projectPriority: p.priority,
      });
    }
  }

  const pickable = projects
    .filter((p) => p.hasLocal !== false && p.tracked !== false && p.status !== "untracked")
    .map((p) => ({ rel: p.rel, name: p.name, status: p.status }))
    .sort((a, b) => {
      if ((a.status === "done") !== (b.status === "done")) {
        return a.status === "done" ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <Module
      title="ALL TO-DOS"
      voice="ops"
      caption={`${items.filter((i) => i.state !== "done").length} open · ${items.length} total`}
      right={
        <Link
          href="/todos"
          className="hud-mono uppercase tracking-[0.18em] text-[10px] text-hud-ink-dim hover:text-foreground transition-colors"
        >
          full board →
        </Link>
      }
    >
      {pickable.length > 0 && (
        <div className="mb-4">
          <AddTodo projects={pickable} placeholder="Add a to-do to a project…" />
        </div>
      )}
      <TodoKanban items={items} showProject cap={CAP_PER_COL} overflowHref="/todos" />
    </Module>
  );
}
