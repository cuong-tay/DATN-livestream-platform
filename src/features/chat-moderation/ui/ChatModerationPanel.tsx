import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { roomService, type BlockedWord } from "@/shared/api/room.service";
import { extractApiErrorMessage } from "@/shared/api/httpClient";
import { chatDebug, chatDebugWarn } from "@/shared/lib/chatDebug";
import {
  Badge,
  Button,
  Input,
  Label,
  Switch,
} from "@/shared/ui";

interface ChatModerationPanelProps {
  roomId: number;
}

interface DraftState {
  word: string;
  enabled: boolean;
}

const initialDraft: DraftState = {
  word: "",
  enabled: true,
};

function hasDuplicateWord(items: BlockedWord[], word: string, exceptId?: number): boolean {
  const normalized = word.trim().toLowerCase();
  return items.some((item) => item.id !== exceptId && item.word.trim().toLowerCase() === normalized);
}

export function ChatModerationPanel({ roomId }: ChatModerationPanelProps) {
  const [items, setItems] = useState<BlockedWord[]>([]);
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DraftState>(initialDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const enabledCount = useMemo(() => items.filter((item) => item.enabled).length, [items]);
  const disabledCount = items.length - enabledCount;

  const fetchBlockedWords = async () => {
    setIsLoading(true);
    try {
      chatDebug("ChatModerationPanel", "load blocked words", { roomId });
      const response = await roomService.getBlockedWords(roomId);
      chatDebug("ChatModerationPanel", "loaded blocked words", {
        roomId,
        count: response.data.length,
      });
      setItems(response.data);
    } catch (error) {
      chatDebugWarn("ChatModerationPanel", "failed to load blocked words", {
        roomId,
        error: extractApiErrorMessage(error),
      });
      toast.error(`Khong tai duoc danh sach tu chan: ${extractApiErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBlockedWords();
  }, [roomId]);

  const validateDraft = (value: DraftState, exceptId?: number) => {
    const word = value.word.trim();
    if (!word) {
      toast.error("Tu khoa khong duoc de trong.");
      return null;
    }

    if (word.length > 255) {
      toast.error("Tu khoa toi da 255 ky tu.");
      return null;
    }

    if (hasDuplicateWord(items, word, exceptId)) {
      toast.error("Tu khoa da ton tai trong danh sach hien tai.");
      return null;
    }

    return { ...value, word };
  };

  const handleCreate = async () => {
    const value = validateDraft(draft);
    if (!value || isSaving) return;

    setIsSaving(true);
    try {
      chatDebug("ChatModerationPanel", "create blocked word", {
        roomId,
        word: value.word,
        enabled: value.enabled,
      });
      const response = await roomService.createBlockedWord(roomId, value);
      setItems((current) => [response.data, ...current]);
      setDraft(initialDraft);
      toast.success("Da them tu khoa chan.");
    } catch (error) {
      chatDebugWarn("ChatModerationPanel", "failed to create blocked word", {
        roomId,
        word: value.word,
        error: extractApiErrorMessage(error),
      });
      toast.error(extractApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (item: BlockedWord) => {
    setEditingId(item.id);
    setEditDraft({
      word: item.word,
      enabled: item.enabled,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(initialDraft);
  };

  const handleUpdate = async (itemId: number) => {
    const value = validateDraft(editDraft, itemId);
    if (!value || busyId) return;

    setBusyId(itemId);
    try {
      chatDebug("ChatModerationPanel", "update blocked word", {
        roomId,
        itemId,
        word: value.word,
        enabled: value.enabled,
      });
      const response = await roomService.updateBlockedWord(roomId, itemId, value);
      setItems((current) => current.map((item) => (item.id === itemId ? response.data : item)));
      cancelEdit();
      toast.success("Da cap nhat tu khoa chan.");
    } catch (error) {
      chatDebugWarn("ChatModerationPanel", "failed to update blocked word", {
        roomId,
        itemId,
        error: extractApiErrorMessage(error),
      });
      toast.error(extractApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = async (item: BlockedWord, enabled: boolean) => {
    setBusyId(item.id);
    try {
      chatDebug("ChatModerationPanel", "toggle blocked word", {
        roomId,
        itemId: item.id,
        word: item.word,
        enabled,
      });
      const response = await roomService.updateBlockedWord(roomId, item.id, {
        word: item.word,
        enabled,
      });
      setItems((current) => current.map((row) => (row.id === item.id ? response.data : row)));
    } catch (error) {
      chatDebugWarn("ChatModerationPanel", "failed to toggle blocked word", {
        roomId,
        itemId: item.id,
        error: extractApiErrorMessage(error),
      });
      toast.error(extractApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: BlockedWord) => {
    if (!window.confirm(`Xoa tu khoa "${item.word}" khoi bo loc chat?`)) return;

    setBusyId(item.id);
    try {
      chatDebug("ChatModerationPanel", "delete blocked word", {
        roomId,
        itemId: item.id,
        word: item.word,
      });
      await roomService.deleteBlockedWord(roomId, item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      if (editingId === item.id) cancelEdit();
      toast.success("Da xoa tu khoa chan.");
    } catch (error) {
      chatDebugWarn("ChatModerationPanel", "failed to delete blocked word", {
        roomId,
        itemId: item.id,
        error: extractApiErrorMessage(error),
      });
      toast.error(extractApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-xl border border-[#3d3d3d] bg-[#18181b] shadow-sm overflow-hidden">
      <div className="border-b border-[#3d3d3d] bg-[#212121] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10">
              <ShieldAlert className="h-5 w-5 text-red-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Chat Moderation</h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-400">
                Quan ly tu khoa backend gui sang AI moderation de go tin nhan vi pham khoi room.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:w-[300px]">
            <div className="rounded-lg border border-[#3d3d3d] bg-black/20 px-3 py-2">
              <p className="text-lg font-bold text-white">{items.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Rules</p>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
              <p className="text-lg font-bold text-emerald-300">{enabledCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-emerald-500/80">On</p>
            </div>
            <div className="rounded-lg border border-[#3d3d3d] bg-black/20 px-3 py-2">
              <p className="text-lg font-bold text-gray-300">{disabledCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Off</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <div className="rounded-lg border border-[#3d3d3d] bg-[#212121] p-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="blocked-word-input" className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Tu khoa
              </Label>
              <Input
                id="blocked-word-input"
                value={draft.word}
                maxLength={255}
                onChange={(event) => setDraft((current) => ({ ...current, word: event.target.value }))}
                placeholder="18+, spam, toxic"
                className="border-[#4d4d4d] bg-black text-white placeholder:text-gray-600"
              />
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>AI moderation se go tin nhan co chua tu/cum tu nay.</span>
                <span>{draft.word.length}/255</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[#3d3d3d] bg-black/20 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-white">Kich hoat ngay</p>
                <p className="text-xs text-gray-500">Tat neu muon luu rule nhung chua ap dung.</p>
              </div>
              <Switch checked={draft.enabled} onCheckedChange={(enabled) => setDraft((current) => ({ ...current, enabled }))} />
            </div>

            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isSaving || !draft.word.trim()}
              className="bg-white text-black hover:bg-gray-200"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Them tu khoa
            </Button>
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-[#3d3d3d] bg-[#212121]">
          <div className="flex items-center justify-between border-b border-[#3d3d3d] px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Danh sach tu da chan</h3>
              <p className="text-xs text-gray-500">Toggle de bat/tat nhanh trong luc livestream.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchBlockedWords()}
              disabled={isLoading}
              className="border-[#4d4d4d] bg-transparent text-white hover:bg-[#2d2d2d]"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-14 text-sm text-gray-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Dang tai bo loc chat...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
              <ShieldAlert className="mb-3 h-10 w-10 text-gray-600" />
              <p className="font-medium text-gray-300">Chua co tu khoa nao.</p>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Them rule dau tien de AI moderation co context khi kiem tra chat trong room.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#3d3d3d]">
              {items.map((item) => {
                const isEditing = editingId === item.id;
                const isBusy = busyId === item.id;

                return (
                  <div key={item.id} className="p-4 transition-colors hover:bg-[#262626]">
                    {isEditing ? (
                      <div className="grid gap-3 lg:grid-cols-[1fr_96px_auto] lg:items-center">
                        <Input
                          value={editDraft.word}
                          maxLength={255}
                          onChange={(event) => setEditDraft((current) => ({ ...current, word: event.target.value }))}
                          className="border-[#4d4d4d] bg-black text-white"
                        />
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={editDraft.enabled}
                            onCheckedChange={(enabled) => setEditDraft((current) => ({ ...current, enabled }))}
                          />
                          <span className="text-xs text-gray-400">{editDraft.enabled ? "On" : "Off"}</span>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="icon"
                            onClick={() => void handleUpdate(item.id)}
                            disabled={isBusy}
                            className="bg-white text-black hover:bg-gray-200"
                          >
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={cancelEdit}
                            className="border-[#4d4d4d] bg-transparent text-white hover:bg-[#2d2d2d]"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 lg:grid-cols-[1fr_96px_auto] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-mono text-sm font-semibold text-white">{item.word}</p>
                            <Badge
                              variant="outline"
                              className={
                                item.enabled
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                  : "border-[#4d4d4d] bg-black/20 text-gray-400"
                              }
                            >
                              {item.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Cap nhat gan nhat: {item.updatedAt ?? item.createdAt ?? "-"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.enabled}
                            disabled={isBusy}
                            onCheckedChange={(enabled) => void handleToggle(item, enabled)}
                          />
                          <span className="text-xs text-gray-400">{item.enabled ? "On" : "Off"}</span>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => startEdit(item)}
                            className="border-[#4d4d4d] bg-transparent text-white hover:bg-[#2d2d2d]"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => void handleDelete(item)}
                            disabled={isBusy}
                            className="border-red-900/70 bg-transparent text-red-300 hover:bg-red-950/40 hover:text-red-200"
                          >
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </section>
  );
}
