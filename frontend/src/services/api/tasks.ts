// Shop to-do list — the read/write half of the `create_task` workflow action.
//
// Note the response shape: the shared axios interceptor already unwraps `response.data`, so the API's
// `{ success, data: {...} }` arrives as `response.data`, and the payload is `response.data.data`.

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
  return res.data.data;
}

export async function createTask(input: {
  title: string;
  body?: string;
  customerAddress?: string;
  orderId?: string;
  dueAt?: string;
}): Promise<ShopTask> {
  const res = await apiClient.post("/shops/tasks", input);
  return res.data.data;
}

export async function setTaskStatus(id: string, status: ShopTaskStatus): Promise<ShopTask> {
  const res = await apiClient.patch(`/shops/tasks/${id}`, { status });
  return res.data.data;
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/shops/tasks/${id}`);
}
