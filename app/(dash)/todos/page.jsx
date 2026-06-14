import { getScannedProjects } from "@/lib/scan.js";
import TodoKanban from "@/components/todo-kanban.jsx";
import AddTodo from "@/components/add-todo.jsx";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const projects = await getScannedProjects();

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
  const open = items.filter((i) => i.state !== "done").length;
  const withTodos = projects.filter((p) => (p.todos?.length ?? 0) > 0).length;

  const pickable = projects
    .filter((p) => p.tracked !== false && p.status !== "untracked")
    .map((p) => ({ rel: p.rel, name: p.name, status: p.status }))
    .sort((a, b) => {
      if ((a.status === "done") !== (b.status === "done")) {
        return a.status === "done" ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">All to-dos</h1>
        <p className="text-sm text-muted-foreground">
          {open} open across {withTodos} {withTodos === 1 ? "project" : "projects"}
        </p>
      </header>
      {pickable.length > 0 && (
        <div className="mb-6 max-w-2xl">
          <AddTodo projects={pickable} placeholder="Add a to-do to a project…" />
        </div>
      )}
      <TodoKanban items={items} showProject groupByProject />
    </div>
  );
}
