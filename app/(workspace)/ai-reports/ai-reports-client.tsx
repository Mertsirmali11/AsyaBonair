"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Bot,
  User,
  Send,
  Loader2,
  BookOpen,
  RotateCcw,
  ChevronDown,
  Sparkles,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ManualMeta } from "@/app/api/ai/chat/route"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant"
  content: string
  usedManuals?: ManualMeta[]
}

// ─── Suggested questions ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Uçuş öncesi kontrol prosedürü nedir?",
  "Acil durum iletişim protokolü nasıl işler?",
  "FOD önleme prosedürleri nelerdir?",
  "Kaza-kırım raporu nasıl doldurulur?",
  "Tehlike bildirimi için hangi formu kullanmalıyım?",
  "SMS kapsamındaki sorumluluklar nelerdir?",
]

// ─── Source chips ─────────────────────────────────────────────────────────────

function SourceChips({ manuals }: { manuals: ManualMeta[] }) {
  if (manuals.length === 0) return null
  const shown = manuals.slice(0, 5)
  const rest = manuals.length - shown.length
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <BookOpen size={11} />
        Kaynaklar:
      </span>
      {shown.map((m) => (
        <span
          key={m.id}
          title={`${m.title}${m.manualNumber ? ` (${m.manualNumber})` : ""} — Rev.${m.revision}${m.revisionDate ? ` • ${m.revisionDate}` : ""}`}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
        >
          <FileText size={9} />
          {m.manualNumber ?? m.title.slice(0, 14)} Rev.{m.revision}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[11px] text-muted-foreground">+{rest} daha</span>
      )}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      {/* Bubble */}
      <div className={cn("flex max-w-[78%] flex-col", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm border border-border bg-card text-foreground shadow-sm"
          )}
        >
          {msg.content}
        </div>
        {!isUser && msg.usedManuals && msg.usedManuals.length > 0 && (
          <SourceChips manuals={msg.usedManuals} />
        )}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  manualCount,
  onSuggest,
}: {
  manualCount: number
  onSuggest: (q: string) => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      {/* Icon */}
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles size={28} />
      </div>

      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Manual AI Assistant
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {manualCount > 0
            ? `${manualCount} güncel manuel revizyonu taranıyor. Sorunuzu yazın — ilgili bölümleri bulup yanıtlayayım.`
            : "Henüz aktif manuel yok. Controlled Documents → Manuals bölümünden manuel yükleyebilirsiniz."}
        </p>
      </div>

      {/* Suggestion chips */}
      {manualCount > 0 && (
        <div className="flex max-w-lg flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggest(s)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AiReportsClient({ manualCount }: { manualCount: number }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [liveManualCount, setLiveManualCount] = useState(manualCount)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim()
      if (!content || isLoading) return

      const userMsg: Message = { role: "user", content }
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsLoading(true)

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ messages: [...messages, userMsg] }),
        })
        const data = (await res.json()) as {
          content?: string
          error?: string
          usedManuals?: ManualMeta[]
        }
        const reply =
          res.ok && typeof data.content === "string"
            ? data.content
            : typeof data.error === "string"
              ? `⚠️ ${data.error}`
              : `Bir hata oluştu (HTTP ${res.status}).`

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: reply,
            usedManuals: res.ok ? data.usedManuals : undefined,
          },
        ])
        if (res.ok && data.usedManuals) {
          setLiveManualCount(data.usedManuals.length)
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Bağlantı hatası. Lütfen tekrar deneyin." },
        ])
      } finally {
        setIsLoading(false)
        setTimeout(() => textareaRef.current?.focus(), 50)
      }
    },
    [input, isLoading, messages]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    setInput("")
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Manual AI Assistant</p>
            <p className="text-xs text-muted-foreground">
              {liveManualCount > 0
                ? `${liveManualCount} güncel manuel taranıyor`
                : "Aktif manuel bulunamadı"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Manuel sayısı badge */}
          {liveManualCount > 0 && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <FileText size={11} />
              {liveManualCount} manuel
            </Badge>
          )}
          {/* Sohbeti temizle */}
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw size={13} />
              Temizle
            </Button>
          )}
        </div>
      </div>

      {/* ── Message area ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {isEmpty ? (
          <EmptyState
            manualCount={liveManualCount}
            onSuggest={(q) => sendMessage(q)}
          />
        ) : (
          <div className="flex flex-col gap-5 px-6 py-5">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Bot size={15} />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 shadow-sm">
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Manuel içerikleri taranıyor…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Scroll-to-bottom hint (only when messages overflow) ────────────── */}
      {messages.length > 3 && (
        <button
          type="button"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="mx-auto mb-1 flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted/80"
        >
          <ChevronDown size={11} />
          En alta git
        </button>
      )}

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <div className="border-t border-border bg-background px-4 py-3">
        {/* Info strip */}
        <p className="mb-2 text-[11px] text-muted-foreground leading-snug">
          Yanıtlar yalnızca{" "}
          <span className="font-medium text-foreground">
            Controlled Documents → Manuals
          </span>{" "}
          bölümündeki en güncel revizyonlara dayanır. Kaynaklar cevap altında listelenir.
        </p>

        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Örn: Uçuş öncesi kontrol listesi prosedürü nedir?"
            className="min-h-[44px] max-h-[140px] flex-1 resize-none text-sm"
            rows={1}
            disabled={isLoading}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="size-11 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
