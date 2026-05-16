"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Minimize2,
  BookOpen,
  LibraryBig,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ManualMeta } from "@/app/api/ai/chat/route";
import { useLanguage } from "@/lib/i18n/context";

interface Message {
  role: "user" | "assistant";
  content: string;
  usedManuals?: ManualMeta[];
}

type ManualOption = { id: number; title: string };

export default function AiChatWidget() {
  const pathname = usePathname();
  const { t, locale } = useLanguage();
  const ai = t.ai;
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: ai.widgetGreeting },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [manualCount, setManualCount] = useState<number | null>(null);
  const [manualList, setManualList] = useState<ManualOption[]>([]);
  /** "all" = tüm manueller, sayı string'i = seçili manualId */
  const [selectedManual, setSelectedManual] = useState<string>("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Re-sync greeting when locale changes (only if chat is still at the welcome state)
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === "assistant") {
        return [{ role: "assistant", content: ai.widgetGreeting }];
      }
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai.widgetGreeting]);

  // Widget açılınca manuel listesini ve sayısını yükle
  useEffect(() => {
    if (!isOpen || isMinimized) return;
    fetch("/api/manuals", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: { manuals?: { id: number; title: string }[]; total?: number }) => {
        if (Array.isArray(d.manuals)) {
          setManualList(d.manuals.map((m) => ({ id: m.id, title: m.title })));
          setManualCount(d.manuals.length);
        } else if (typeof d.total === "number") {
          setManualCount(d.total);
        }
      })
      .catch(() => {/* sessiz */});
  }, [isOpen, isMinimized]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const manualId =
        selectedManual !== "all" ? parseInt(selectedManual) : undefined;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          messages: [...messages, userMessage],
          ...(manualId ? { manualId } : {}),
          locale,
        }),
      });
      const data = (await res.json()) as {
        content?: string;
        error?: string;
        usedManuals?: ManualMeta[];
      };
      const reply =
        res.ok && typeof data.content === "string"
          ? data.content
          : typeof data.error === "string"
            ? data.error
            : `Bir hata oluştu (${res.status}).`;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          usedManuals: res.ok ? data.usedManuals : undefined,
        },
      ]);
      if (res.ok && data.usedManuals) {
        setManualCount(data.usedManuals.length);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: ai.connectionError },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  /** Messages sayfasında FAB ile çakışmasın */
  if (pathname === "/messages" || pathname?.startsWith("/messages/")) {
    return null;
  }

  const selectedTitle =
    selectedManual !== "all"
      ? (manualList.find((m) => String(m.id) === selectedManual)?.title ?? "Manuel")
      : null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && !isMinimized && (
        <div className="flex h-[580px] w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                <Bot size={16} className="text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Bonair AI</p>
                <p className="text-xs text-primary-foreground/70 truncate">
                  {selectedTitle
                    ? `${ai.selectedManual}: ${selectedTitle.slice(0, 24)}${selectedTitle.length > 24 ? "…" : ""}`
                    : manualCount !== null
                      ? `${manualCount} ${ai.allManualsScanning}`
                      : ai.assistantName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="rounded p-1 transition-colors hover:bg-primary-foreground/10"
              >
                <Minimize2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded p-1 transition-colors hover:bg-primary-foreground/10"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-primary-foreground",
                    msg.role === "user"
                      ? "bg-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className="flex max-w-[78%] flex-col gap-1">
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-tl-sm bg-muted text-foreground"
                    )}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "assistant" &&
                    msg.usedManuals &&
                    msg.usedManuals.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 px-1">
                        <BookOpen size={10} className="text-muted-foreground shrink-0" />
                        {msg.usedManuals.slice(0, 4).map((m) => (
                          <span
                            key={m.id}
                            className="text-[10px] rounded bg-primary/10 text-primary px-1.5 py-0.5 leading-tight"
                            title={`${m.title}${m.manualNumber ? ` (${m.manualNumber})` : ""} — Rev.${m.revision}${m.revisionDate ? ` • ${m.revisionDate}` : ""}`}
                          >
                            {m.manualNumber ?? m.title.slice(0, 12)} Rev.{m.revision}
                          </span>
                        ))}
                        {msg.usedManuals.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{msg.usedManuals.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Bot size={14} />
                </div>
                <div className="rounded-xl rounded-tl-sm bg-muted px-3 py-2">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex flex-col gap-2">
            {/* Manuel seçici */}
            {manualList.length > 0 && (
              <Select
                value={selectedManual}
                onValueChange={(v) => {
                  setSelectedManual(v);
                  // Sohbeti sıfırla — farklı bağlam karışmasın
                  setMessages([
                    {
                      role: "assistant",
                      content:
                        v === "all"
                          ? ai.allManualsGreeting
                          : `"${manualList.find((m) => String(m.id) === v)?.title ?? "Manuel"}" — ${ai.selectedManualDescription}`,
                    },
                  ]);
                  setInput("");
                }}
              >
                <SelectTrigger className="h-7 w-full text-xs gap-1.5">
                  <LibraryBig size={12} className="shrink-0 text-muted-foreground" />
                  <SelectValue placeholder={ai.selectManual} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    {ai.allManualsOption}
                  </SelectItem>
                  {manualList.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <p className="text-[10px] text-muted-foreground leading-snug">
              {ai.sourceNote}
            </p>
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={ai.inputPlaceholder}
                className="resize-none text-sm min-h-[40px] max-h-[100px]"
                rows={1}
              />
              <Button
                onClick={() => void sendMessage()}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="bg-black hover:bg-gray-800 text-white flex-shrink-0"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {isOpen && isMinimized && (
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md transition-opacity hover:opacity-90"
          onClick={() => setIsMinimized(false)}
        >
          <Bot size={16} />
          <span>Bonair AI</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setIsMinimized(false);
        }}
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 hover:opacity-90"
        aria-label={isOpen ? t.common.close : ai.assistantName}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
