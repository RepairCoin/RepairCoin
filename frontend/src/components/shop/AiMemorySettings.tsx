"use client";

// Shop "What the AI remembers" panel (AI Memory Phase 2). Lets the owner view,
// add (pre-seed), edit, and forget the unified assistant's STANDING instructions
// — preferences/decisions/corrections it carries across conversations. This is
// NOT chat history and NOT business data (those come from the assistant's tools);
// it's how the owner tells the assistant to behave. Hidden when the feature flag
// is off (the list endpoint returns enabled:false).

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Plus, Trash2, Pencil, Brain, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  MEMORY_KINDS,
  type AiMemory,
  type AiMemoryKind,
} from "@/services/api/aiMemory";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedCard } from "@/components/shop/FeatureLockedCard";

const KIND_LABEL: Record<AiMemoryKind, string> = {
  instruction: "Instruction",
  preference: "Preference",
  decision: "Decision",
  correction: "Correction",
};

const REASON_COPY: Record<string, string> = {
  looks_like_fact:
    "That looks like a question or a fact the assistant can already look up. Memory is for standing instructions (e.g. “never suggest discounts”).",
  duplicate: "You’ve already saved something just like that.",
  empty: "Please enter what you’d like the assistant to remember.",
};

export const AiMemorySettings: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState<AiMemoryKind>("instruction");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // WS2: AI Memory is a Business-only feature. When the plan doesn't include it
  // we show the upgrade card and skip the (server-gated) list request entirely.
  const { can, loading: featureLoading } = useFeatureAccess();
  const locked = !featureLoading && !can("aiMemory");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMemories();
      setEnabled(res.enabled);
      setMemories(res.memories ?? []);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (featureLoading) return; // wait until the tier resolves
    if (locked) {
      setLoading(false); // below tier — don't fire the gated request
      return;
    }
    load();
  }, [featureLoading, locked, load]);

  const parseTags = (raw: string): string[] =>
    raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content) return;
    setAdding(true);
    try {
      const created = await createMemory({ kind: newKind, content, tags: parseTags(newTags) });
      setMemories((prev) => [created, ...prev]);
      setNewContent("");
      setNewTags("");
      setNewKind("instruction");
      toast.success("Saved — the assistant will remember that.");
    } catch (err: any) {
      const reason = err?.response?.data?.error;
      toast.error(REASON_COPY[reason] || "Couldn’t save that. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (m: AiMemory) => {
    setEditingId(m.id);
    setEditContent(m.content);
  };

  const saveEdit = async (id: string) => {
    const content = editContent.trim();
    if (!content) return;
    try {
      const updated = await updateMemory(id, { content });
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
      setEditingId(null);
      toast.success("Updated.");
    } catch {
      toast.error("Couldn’t update that.");
    }
  };

  const handleDelete = async (id: string) => {
    // optimistic
    const prev = memories;
    setMemories((cur) => cur.filter((m) => m.id !== id));
    try {
      await deleteMemory(id);
      toast.success("Forgotten.");
    } catch {
      setMemories(prev);
      toast.error("Couldn’t delete that.");
    }
  };

  if (featureLoading || loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading memory…
      </div>
    );
  }

  // WS2: plan doesn't include AI Memory → upgrade prompt (not the "contact
  // support" copy below, which is for the flag being off on an entitled plan).
  if (locked) {
    return (
      <FeatureLockedCard
        feature="aiMemory"
        title="Assistant Memory is a Business feature"
        description="Give your assistant standing instructions it remembers across conversations — available on the Business plan."
      />
    );
  }

  // Feature off → keep the section quiet (a single informational line).
  if (!enabled) {
    return (
      <div className="rounded-xl border border-[#303236] bg-[#161616] p-5">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#FFCC00]" /> Assistant Memory
        </h3>
        <p className="text-sm text-gray-400 mt-2">
          Letting your assistant remember standing instructions isn’t enabled for your
          account yet. Contact RepairCoin support to turn it on.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#303236] bg-[#161616] p-5">
      <h3 className="text-base font-semibold text-white flex items-center gap-2">
        <Brain className="w-5 h-5 text-[#FFCC00]" /> Assistant Memory
      </h3>
      <p className="text-sm text-gray-400 mt-1">
        Standing instructions your assistant remembers across conversations — like
        “never suggest discounts” or “address me as Boss.” These guide how it behaves;
        they’re not chat history or business data.
      </p>

      {/* Add form */}
      <div className="mt-4 rounded-lg border border-[#303236] bg-[#101010] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Type</label>
            <Select value={newKind} onValueChange={(v) => setNewKind(v as AiMemoryKind)}>
              <SelectTrigger className="bg-[#1a1a1a] border-[#303236] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEMORY_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">What should it remember?</label>
            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="e.g. Never suggest discounts in campaigns."
              className="bg-[#1a1a1a] border-[#303236] text-white text-sm min-h-[44px]"
              rows={2}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Tags (optional, comma-separated)</label>
            <Input
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="campaigns, discounts"
              className="bg-[#1a1a1a] border-[#303236] text-white text-sm"
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={adding || !newContent.trim()}
            className="bg-[#FFCC00] text-black hover:bg-[#E6B800] font-medium"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 space-y-2">
        {memories.length === 0 ? (
          <p className="text-sm text-gray-500 px-1 py-3">
            Nothing saved yet. Add a standing instruction above, or just tell the
            assistant in chat — “from now on, …”.
          </p>
        ) : (
          memories.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-[#303236] bg-[#101010] p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                {editingId === m.id ? (
                  <div className="flex items-start gap-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="bg-[#1a1a1a] border-[#303236] text-white text-sm min-h-[44px]"
                      rows={2}
                    />
                    <button
                      onClick={() => saveEdit(m.id)}
                      className="text-green-400 hover:text-green-300 p-1"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-gray-400 hover:text-white p-1"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="bg-[#FFCC00]/15 text-[#FFCC00] border-0 text-[11px]">
                        {KIND_LABEL[m.kind]}
                      </Badge>
                      {m.tags.map((t) => (
                        <span key={t} className="text-[11px] text-gray-500">
                          #{t}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-200 mt-1">{m.content}</p>
                  </>
                )}
              </div>
              {editingId !== m.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(m)}
                    className="text-gray-400 hover:text-white p-1"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-gray-400 hover:text-red-400 p-1"
                    title="Forget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AiMemorySettings;
