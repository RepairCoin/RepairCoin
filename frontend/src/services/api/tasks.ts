// Shop to-do list — the read/write half of the `create_task` workflow action.
//
// Response shape, which this file originally got wrong and shipped: the shared axios interceptor
// returns the HTTP BODY, so what you await is already `{ success, data }` — the payload is
// `res.data`, never `res.data.data`. Reading one level too deep yields undefined, and destructuring
// it throws, which surfaced as a "Could not load tasks" toast on every visit to the Automation page.

import apiClient from "./client";

export type ShopTaskStatus = "open" | "done" | "dismissed";

export interface ShopTask {
  id: string;
  shopId: string;
  title: string;
  body: string | null;
  /** 'workflow' when an automation filed it, 'manual' when a person did. */
  source: "workflow" | "manual";
  sourceRuleId: string | null;
  customerAddress: string | null;
  orderId: string | null;
  status: ShopTaskStatus;
  dueAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export async function getTasks(
  status?: ShopTaskStatus
): Promise<{ tasks: ShopTask[]; total: number; openCount: number }> {
  const res = await apiClient.get("/shops/tasks", { params: status ? { status } : {} });
  return res.data;
}

export async function createTask(input: {
  title: string;
  body?: string;
  customerAddress?: string;
  orderId?: string;
  dueAt?: string;
}): Promise<ShopTask> {
  const res = await apiClient.post("/shops/tasks", input);
  return res.data;
}

export async function setTaskStatus(id: string, status: ShopTaskStatus): Promise<ShopTask> {
  const res = await apiClient.patch(`/shops/tasks/${id}`, { status });
  return res.data;
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/shops/tasks/${id}`);
}
