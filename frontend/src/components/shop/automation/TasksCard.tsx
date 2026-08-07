"use client";

// The shop's to-do list — the surface half of the `create_task` workflow action.
//
// It ships with the action rather than after it, on purpose. An action that files tasks nobody can see
// reports success while nothing gets actioned, and the shop has no way to tell the difference. The
// whole point of a task over an alert is that it OUTLIVES being read, which only means something if
// there is somewhere it lives.

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Circle, ListTodo, Loader2, Plus, Trash2, Workflow, X } from "lucide-react";
import { getTasks, createTask, setTaskStatus, deleteTask, type ShopTask, type ShopTaskStatus } from "@/services/api/tasks";

const FILTERS: Array<{ value: ShopTaskStatus; label: string }> = [
  { value: "open", label: "To do" },
  { value: "done", label: "Done" },
  { value: "dismissed", label: "Dismissed" },
];

const fmt = (v: string) =>
  new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function TasksCard() {
  const [tasks, setTasks] = useState<ShopTask[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [filter, setFilter] = useState<ShopTaskStatus>("open");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await getTasks(filter);
      // Tolerant reads. This card renders on every visit to Automation, so a shape surprise here used
      // to mean an error toast on every page load and refresh — far more alarming than the empty list
      // it was describing. An unexpected payload now shows "no tasks" instead of shouting.
      setTasks(r?.tasks ?? []);
      // Always the OPEN count, whichever tab is showing — the number in the header answers "how much
      // is waiting on me", which does not change because you looked at the Done list.
      setOpenCount(r?.openCount ?? 0);
    } catch {
      toast.error("Could not load tasks");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const move = async (task: ShopTask, status: ShopTaskStatus) => {
    setBusyId(task.id);
    try {
      await setTaskStatus(task.id, status);
      // Drops out of the current view when it no longer matches the filter, which is what makes
      // ticking things off feel like progress rather than a list that never shrinks.
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setOpenCount((n) => (status === "open" ? n + 1 : Math.max(0, n - 1)));
    } catch {
      toast.error("Could not update the task");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (task: ShopTask) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setBusyId(task.id);
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      if (task.status === "open") setOpenCount((n) => Math.max(0, n - 1));
    } catch {
      toast.error("Could not delete the task");
    } finally {
      setBusyId(null);
    }
  };

  const add = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const created = await createTask({ title });
      setNewTitle("");
      setAdding(false);
      if (filter === "open") setTasks((prev) => [created, ...prev]);
      setOpenCount((n) => n + 1);
    } catch {
      toast.error("Could not add the task");
    }
  };

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-base font-semibold text-white">Tasks</h3>
          {openCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#FFCC00] text-black text-xs font-medium">
              {openCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 text-sm hover:border-gray-600"
        >
          {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {adding ? "Cancel" : "Add"}
        </button>
      </div>

      {adding && (
        <div className="flex gap-2 p-4 border-b border-gray-800">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="What needs doing?"
            maxLength={200}
            className="flex-1 px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={!newTitle.trim()}
            className="px-4 py-2 rounded-lg bg-[#FFCC00] text-black text-sm font-medium disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}

      <div className="flex gap-1 px-4 pt-3">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setLoading(true);
              setFilter(f.value);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              filter === f.value ? "bg-[#0D0D0D] text-white border border-gray-700" : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            {filter === "open"
              ? "Nothing waiting on you. Workflows can add tasks here automatically."
              : `No ${filter} tasks.`}
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-[#0D0D0D] border border-gray-800"
              >
                <button
                  type="button"
                  onClick={() => void move(t, t.status === "open" ? "done" : "open")}
                  disabled={busyId === t.id}
                  className="mt-0.5 text-gray-500 hover:text-[#FFCC00] disabled:opacity-40"
                  aria-label={t.status === "open" ? "Mark done" : "Reopen"}
                >
                  {t.status === "open" ? <Circle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-green-500" />}
                </button>

                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${t.status === "open" ? "text-white" : "text-gray-500 line-through"}`}>
                    {t.title}
                  </p>
                  {t.body && <p className="text-sm text-gray-400 mt-0.5">{t.body}</p>}
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    {/* Where it came from, because "why is this on my list" is the first question about
                        anything a machine put there. */}
                    {t.source === "workflow" && (
                      <span className="inline-flex items-center gap-1">
                        <Workflow className="w-3 h-3" /> From a workflow
                      </span>
                    )}
                    <span>{fmt(t.createdAt)}</span>
                    {t.dueAt && <span className="text-amber-500">Due {fmt(t.dueAt)}</span>}
                  </div>
                </div>

                {t.status === "open" && (
                  <button
                    type="button"
                    onClick={() => void move(t, "dismissed")}
                    disabled={busyId === t.id}
                    className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40"
                  >
                    Dismiss
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(t)}
                  disabled={busyId === t.id}
                  className="text-gray-600 hover:text-red-400 disabled:opacity-40"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
