"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type ManualOption = { id: number; title: string };

export default function AiChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Merhaba! Ben Bonair AI Asistanı. Controlled Documents’tan yüklenen manuellerden bir veya birden fazlasını işaretleyin; uzun PDF’lerde sorunuza göre ilgili metin parçaları kullanılır. Hiç seçmezseniz genel havacılık konusunda yardımcı olurum — kesin mevzuat için resmi kaynağa bakın. Regülasyon etkisi için: AI Report Creator → «Regülasyon etkisi».",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [manuals, setManuals] = useState<ManualOption[]>([]);
  const [selectedManualIds, setSelectedManualIds] = useState<number[]>([]);
  const [manualsLoading, setManualsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadManuals = useCallback(async () => {
    setManualsLoading(true);
    try {
      const res = await fetch("/api/manuals", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as {
        manuals?: ManualOption[];
      };
      if (Array.isArray(data.manuals)) {
        setManuals(data.manuals);
      }
    } catch {
      /* sessiz */
    } finally {
      setManualsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadManuals();
  }, [loadManuals]);

  /** Sohbet açılınca ve sekme tekrar görününce liste güncellenir (yeni yüklenen manueller için). */
  useEffect(() => {
    if (isOpen && !isMinimized) {
      void loadManuals();
    }
  }, [isOpen, isMinimized, loadManuals]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && isOpen && !isMinimized) {
        void loadManuals();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isOpen, isMinimized, loadManuals]);

  useEffect(() => {
    setSelectedManualIds((prev) =>
      prev.filter((id) => manuals.some((m) => m.id === id))
    );
  }, [manuals]);

  const toggleManual = (id: number) => {
    setSelectedManualIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          messages: [...messages, userMessage],
          ...(selectedManualIds.length > 0
            ? { manualIds: selectedManualIds }
            : {}),
        }),
      });
      const data = (await res.json()) as {
        content?: string;
        error?: string;
      };
      const reply =
        res.ok && typeof data.content === "string"
          ? data.content
          : typeof data.error === "string"
            ? data.error
            : `Bir hata oluştu (${res.status}).`;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Bağlantı hatası. Lütfen tekrar deneyin." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /** Team mesajları: gönder FAB ile aynı köşede; üst üste binmesin. */
  if (pathname === "/messages" || pathname?.startsWith("/messages/")) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && !isMinimized && (
        <div className="flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/15">
                <Bot size={16} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Bonair AI</p>
                <p className="text-xs text-primary-foreground/80">Havacılık Asistanı</p>
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

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-primary-foreground",
                    msg.role === "user" ? "bg-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div
                  className={cn(
                    "max-w-[75%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-muted text-foreground"
                  )}
                >
                  {msg.content}
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
          <div className="border-t border-gray-100 p-3 flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-500 flex-1">
                  Kayıtlı manuel ({manuals.length}) — çoklu seçim, soruya göre parça
                </span>
                <div className="flex items-center gap-1">
                  {selectedManualIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedManualIds([])}
                      className="text-[10px] text-sky-700 underline px-1"
                    >
                      Temizle
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void loadManuals()}
                    disabled={isLoading || manualsLoading}
                    className="flex items-center gap-1 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
                    title="Listeyi yenile"
                  >
                    <RefreshCw
                      size={14}
                      className={manualsLoading ? "animate-spin" : ""}
                    />
                  </button>
                </div>
              </div>
              <div className="max-h-[120px] overflow-y-auto rounded-md border border-gray-200 bg-white px-2 py-1.5">
                {manuals.length === 0 ? (
                  <p className="text-[10px] text-gray-500 py-1">
                    {manualsLoading ? "Yükleniyor…" : "Henüz manuel yok."}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {manuals.map((m) => (
                      <li key={m.id} className="flex items-start gap-2">
                        <Checkbox
                          id={`bonair-ai-manual-${m.id}`}
                          checked={selectedManualIds.includes(m.id)}
                          onCheckedChange={() => toggleManual(m.id)}
                          disabled={isLoading}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor={`bonair-ai-manual-${m.id}`}
                          className="text-[11px] text-gray-900 leading-snug cursor-pointer flex-1"
                        >
                          {m.title}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-[10px] text-gray-600 leading-snug border-t border-gray-100 pt-1.5 mt-0.5">
                Bu listede yalnızca{" "}
                <Link
                  href="/documents"
                  className="text-sky-700 underline font-medium"
                >
                  Controlled Documents → Manuals
                </Link>{" "}
                sayfasına kaydedilen PDF’ler görünür. Uzun dosyalarda yanıt,
                sorunuzdaki kelimelerle eşleşen bölümlere dayanır (tam metin
                gönderilmez). AI Report Creator’daki geçici yüklemeler burada
                yok — kalıcı eklemek için yukarıdaki sayfadan yükleyin veya ↻.
              </p>
              {selectedManualIds.length > 0 && (
                <p className="text-[10px] text-sky-800 leading-snug">
                  {selectedManualIds.length} manuel seçili; yanıtlar bu
                  dokümanlara öncelik verir.
                </p>
              )}
            </div>
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Örn. Compliance Monitoring manueline göre bu süreç nasıl izlenir?"
                className="resize-none text-sm min-h-[40px] max-h-[100px]"
                rows={1}
              />
              <Button
                onClick={sendMessage}
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
        aria-label={isOpen ? "Sohbeti kapat" : "AI sohbetini aç"}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
