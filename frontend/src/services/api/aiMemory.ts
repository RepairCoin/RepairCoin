// frontend/src/services/api/aiMemory.ts
//
// Shop-side AI Memory (Phase 2). The unified assistant's saved STANDING
// instructions (preferences/decisions/corrections) — NOT chat history, NOT
// DB facts. Backed by /api/ai/memories. Gated by ENABLE_AI_MEMORY: the list
// response carries `enabled` so the UI hides itself when the feature is off.

import apiClient from './client';

export type AiMemoryKind = 'preference' | 'instruction' | 'decision' | 'correction';

export interface AiMemory {
  id: string;
  shopId: string;
  scope: string;
  kind: AiMemoryKind;
  customerId: string | null;
  content: string;
  tags: string[];
  source: 'explicit' | 'auto';
  pinned: boolean;
  sourceConversationId: string | null;
  confidence: number | null;
  lastReferencedAt: string | null;
  createdAt: string;
}

export interface MemoryListResponse {
  enabled: boolean;
  memories: AiMemory[];
}

export const MEMORY_KINDS: { value: AiMemoryKind; label: string; hint: string }[] = [
  { value: 'instruction', label: 'Instruction', hint: 'A standing rule for the assistant' },
  { value: 'preference', label: 'Preference', hint: 'Style or tone you prefer' },
  { value: 'decision', label: 'Decision', hint: 'Something you’ve decided' },
  { value: 'correction', label: 'Correction', hint: 'Fix how it interprets something' },
];

export const listMemories = async (): Promise<MemoryListResponse> => {
  const res = await apiClient.get('/ai/memories');
  return res.data.data ?? res.data;
};

export const createMemory = async (input: {
  kind: AiMemoryKind;
  content: string;
  tags?: string[];
}): Promise<AiMemory> => {
  const res = await apiClient.post('/ai/memories', input);
  return res.data.data ?? res.data;
};

export const updateMemory = async (
  id: string,
  input: { content?: string; tags?: string[]; pinned?: boolean }
): Promise<AiMemory> => {
  const res = await apiClient.patch(`/ai/memories/${id}`, input);
  return res.data.data ?? res.data;
};

export const deleteMemory = async (id: string): Promise<void> => {
  await apiClient.delete(`/ai/memories/${id}`);
};
