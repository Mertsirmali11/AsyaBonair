"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  FileText,
  Zap,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  Upload,
  BookMarked,
  FileStack,
  Scale,
  Bot,
  User,
  Send,
  RotateCcw,
  Sparkles,
  BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  DOCUMENT_ACCEPT_HTML,
  isAllowedCorrespondenceDocumentFile,
} from "@/lib/allowed-document-uploads"
import { cn } from "@/lib/utils"
import type { ManualMeta } from "@/app/api/ai/chat/route"

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalysisType = "summary" | "anomaly" | "report" | "regulation_impact"
type Tab = "analyze" | "chat"

type ManualOption = {
  id: number
  title: string
  slug: string
  updatedAt: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  usedManuals?: ManualMeta[]
}

// ─── Analysis tab constants ───────────────────────────────────────────────────

const analysisOptions = [
  {
    type: "summary" as AnalysisType,
    icon: FileText,
    title: "Doküman Özeti",
    description: "Metni havacılık perspektifinden özetle",
    border: "border-blue-300 hover:border-blue-500",
    active: "border-blue-500 bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    type: "anomaly" as AnalysisType,
    icon: AlertTriangle,
    title: "Anomali Tespiti",
    description: "FDM verisinde sapma ve risk analizi",
    border: "border-orange-300 hover:border-orange-500",
    active: "border-orange-500 bg-orange-50",
    iconColor: "text-orange-600",
  },
  {
    type: "report" as AnalysisType,
    icon: Zap,
    title: "Rapor Oluştur",
    description: "SHGM standartlarında otomatik rapor",
    border: "border-green-300 hover:border-green-500",
    active: "border-green-500 bg-green-50",
    iconColor: "text-green-600",
  },
  {
    type: "regulation_impact" as AnalysisType,
    icon: Scale,
    title: "Regülasyon etkisi",
    description: "Yeni düzenlemenin operasyona etkisi ve aksiyonlar",
    border: "border-violet-300 hover:border-violet-500",
    active: "border-violet-600 bg-violet-50",
    iconColor: "text-violet-600",
  },
]

const CHAT_SUGGESTIONS = [
  "Uçuş öncesi kontrol prosedürü nedir?",
  "Acil durum iletişim protokolü nasıl işler?",
  "FOD önleme prosedürleri nelerdir?",
  "Kaza-kırım raporu nasıl doldurulur?",
  "Tehlike bildirimi için hangi formu kullanmalıyım?",
  "SMS kapsamındaki sorumluluklar nelerdir?",
]

// ─── Chat source chips ────────────────────────────────────────────────────────

function SourceChips({ manuals }: { manuals: ManualMeta[] }) {
  if (!manuals.length) return null
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

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user"
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={cn("flex max-w-[78%] flex-col", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm border border-border bg-card shadow-sm text-foreground"
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

// ─── Main component ───────────────────────────────────────────────────────────

export function AiReportsClient({ manualCount = 0 }: { manualCount?: number }) {
  const [activeTab, setActiveTab] = useState<Tab>("chat")

  // ── Analysis tab state ──
  const [selectedType, setSelectedType] = useState<AnalysisType>("summary")
  const [inputText, setInputText] = useState("")
  const [result, setResult] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastInputTruncated, setLastInputTruncated] = useState(false)
  const [copied, setCopied] = useState(false)
  const [manuals, setManuals] = useState<ManualOption[]>([])
  const [selectedManualIds, setSelectedManualIds] = useState<number[]>([])
  const [manualLoading, setManualLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const combinedTextSectionRef = useRef<HTMLElement>(null)

  // ── Chat tab state ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [liveManualCount, setLiveManualCount] = useState(manualCount)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages, isChatLoading])

  // Load manual list for analysis tab
  useEffect(() => {
    let cancelled = false
    void fetch("/api/manuals", { cache: "no-store", credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { manuals?: ManualOption[] }) => {
        if (!cancelled && Array.isArray(data.manuals)) setManuals(data.manuals)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ── Chat handlers ──────────────────────────────────────────────────────────
  const sendChatMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? chatInput).trim()
      if (!content || isChatLoading) return
      const userMsg: ChatMessage = { role: "user", content }
      setChatMessages((prev) => [...prev, userMsg])
      setChatInput("")
      setIsChatLoading(true)
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ messages: [...chatMessages, userMsg] }),
        })
        const data = (await res.json()) as {
          content?: string; error?: string; usedManuals?: ManualMeta[]
        }
        const reply =
          res.ok && typeof data.content === "string"
            ? data.content
            : typeof data.error === "string"
              ? `⚠️ ${data.error}`
              : `Bir hata oluştu (HTTP ${res.status}).`
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply, usedManuals: res.ok ? data.usedManuals : undefined },
        ])
        if (res.ok && data.usedManuals) setLiveManualCount(data.usedManuals.length)
      } catch {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Bağlantı hatası. Lütfen tekrar deneyin." },
        ])
      } finally {
        setIsChatLoading(false)
        setTimeout(() => chatTextareaRef.current?.focus(), 50)
      }
    },
    [chatInput, isChatLoading, chatMessages]
  )

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChatMessage() }
  }

  // ── Analysis tab handlers ──────────────────────────────────────────────────
  const toggleManual = (id: number, checked: boolean) =>
    setSelectedManualIds((prev) => checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id))

  const mergeSelectedManualsIntoText = async () => {
    if (selectedManualIds.length === 0) { toast.error("Önce en az bir manuel işaretleyin."); return }
    setManualLoading(true)
    try {
      const parts: string[] = []
      for (const id of selectedManualIds) {
        const res = await fetch(`/api/manuals/${id}`, { cache: "no-store", credentials: "same-origin" })
        const data = (await res.json()) as { error?: string; manual?: { contentText?: string; title?: string } }
        if (!res.ok) throw new Error(data.error || `Sunucu hatası (${res.status})`)
        const title = data.manual?.title ?? manuals.find((m) => m.id === id)?.title ?? `Manuel #${id}`
        const text = data.manual?.contentText ?? ""
        if (!text.trim()) { toast.warning(`"${title}" içinde metin yok, atlandı.`); continue }
        parts.push(`---\nDOKÜMAN: ${title}\n---\n\n${text}`)
      }
      if (parts.length === 0) throw new Error("Seçilen manuel(ler)de kullanılabilir metin yok.")
      const merged = parts.join("\n\n")
      setInputText((prev) => { const p = prev.trim(); return p ? `${p}\n\n${merged}` : merged })
      toast.success(`${parts.length} doküman metne eklendi.`)
      combinedTextSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Manuel(ler) yüklenemedi.")
    } finally {
      setManualLoading(false)
    }
  }

  const processPdfFiles = async (fileList: File[]) => {
    const docs = fileList.filter((f) => isAllowedCorrespondenceDocumentFile(f))
    if (docs.length === 0) { toast.error("PDF, Word, Excel veya PowerPoint dosyası seçebilirsiniz."); return }
    setPdfLoading(true)
    try {
      const appended: string[] = []
      let anyTruncated = false
      for (const file of docs) {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch("/api/ai/parse-pdf", { method: "POST", body: fd, credentials: "same-origin" })
        let data: { error?: string; text?: string; truncated?: boolean }
        try { data = (await res.json()) as { error?: string; text?: string; truncated?: boolean } }
        catch { throw new Error(`${file.name}: sunucu yanıtı okunamadı (${res.status})`) }
        if (res.status === 401) throw new Error("Oturum süresi dolmuş olabilir; sayfayı yenileyip tekrar giriş yapın.")
        if (!res.ok) throw new Error(data.error || `${file.name}: hata (${res.status})`)
        const text = data.text ?? ""
        if (text.trim()) appended.push(`---\nDosya: ${file.name}\n---\n\n${text}`)
        if (data.truncated) anyTruncated = true
      }
      if (appended.length === 0) throw new Error("Dosyalardan metin alınamadı (taranmış görüntü veya desteklenmeyen format olabilir).")
      setInputText((prev) => { const p = prev.trim(); return p ? `${p}\n\n${appended.join("\n\n")}` : appended.join("\n\n") })
      if (anyTruncated) toast.warning("Bir veya daha fazla dosya metni uzun olduğu için kısaltıldı.")
      toast.success(`${appended.length} dosya metne eklendi.`)
      combinedTextSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya yüklenemedi.")
    } finally {
      setPdfLoading(false)
    }
  }

  const handlePdfInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target; const list = input.files
    if (!list?.length) return
    const files = Array.from(list); input.value = ""
    await processPdfFiles(files)
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!busy) setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    if (busy) return
    const files = e.dataTransfer.files
    if (!files?.length) return
    await processPdfFiles(Array.from(files))
  }

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      toast.error("Önce aşağıdaki metin alanına içerik ekleyin (manuel, dosya veya yapıştırma).")
      combinedTextSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      document.getElementById("ai-report-textarea")?.focus()
      return
    }
    setIsAnalyzing(true); setResult(""); setLastInputTruncated(false)
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, analysisType: selectedType }),
      })
      let data: { error?: string; content?: string; inputTruncated?: boolean }
      try { data = (await res.json()) as { error?: string; content?: string; inputTruncated?: boolean } }
      catch { throw new Error("Sunucu yanıtı okunamadı.") }
      if (!res.ok) throw new Error(data.error || `Sunucu hatası (${res.status})`)
      if (data.error) throw new Error(data.error)
      if (typeof data.content !== "string" || !data.content) throw new Error("Yanıt alınamadı.")
      setResult(data.content); setLastInputTruncated(!!data.inputTruncated)
      if (data.inputTruncated) {
        toast.success("Analiz tamamlandı", { description: "Girdi metni ücretsiz API sınırına sığması için otomatik kısaltıldı; sonuç bu kısma göredir.", duration: 8000 })
      } else {
        toast.success("Analiz tamamlandı.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analiz sırasında bir hata oluştu.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true); toast.success("Kopyalandı!")
    setTimeout(() => setCopied(false), 2000)
  }

  const busy = isAnalyzing || manualLoading || pdfLoading

  return (
    <div className="flex h-full flex-col">
      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border px-6 pt-4">
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "chat"
              ? "border border-b-0 border-border bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Bot size={15} />
          Manual Q&amp;A
          {liveManualCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {liveManualCount}
            </Badge>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("analyze")}
          className={cn(
            "flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "analyze"
              ? "border border-b-0 border-border bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Zap size={15} />
          Doküman Analizi
        </button>
      </div>

      {/* ── CHAT TAB ────────────────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold">Manual AI Assistant</p>
                <p className="text-xs text-muted-foreground">
                  {liveManualCount > 0
                    ? `${liveManualCount} güncel manuel otomatik taranıyor`
                    : "Aktif manuel bulunamadı — Manuals bölümünden yükleyin"}
                </p>
              </div>
            </div>
            {chatMessages.length > 0 && (
              <Button
                variant="ghost" size="sm"
                onClick={() => { setChatMessages([]); setChatInput("") }}
                className="gap-1.5 text-xs text-muted-foreground"
              >
                <RotateCcw size={13} />
                Temizle
              </Button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {chatMessages.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center gap-5 px-6 py-14">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles size={26} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">Sorunuzu yazın</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {liveManualCount > 0
                      ? `${liveManualCount} güncel manuel revizyonu taranıyor. Manuel seçmenize gerek yok — sistem otomatik bulur.`
                      : "Henüz aktif manuel yok. Controlled Documents → Manuals bölümünden yükleyebilirsiniz."}
                  </p>
                </div>
                {liveManualCount > 0 && (
                  <div className="flex max-w-lg flex-wrap justify-center gap-2">
                    {CHAT_SUGGESTIONS.map((s) => (
                      <button
                        key={s} type="button"
                        onClick={() => void sendChatMessage(s)}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-5 px-6 py-5">
                {chatMessages.map((msg, i) => (
                  <ChatBubble key={i} msg={msg} />
                ))}
                {isChatLoading && (
                  <div className="flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Bot size={14} />
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 shadow-sm">
                      <Loader2 size={14} className="animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Manuel içerikleri taranıyor…</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="border-t border-border bg-background px-4 py-3">
            <p className="mb-2 text-[11px] text-muted-foreground">
              Yanıtlar yalnızca{" "}
              <span className="font-medium text-foreground">Controlled Documents → Manuals</span>{" "}
              bölümündeki güncel revizyonlara dayanır. Cevap altında kaynak manuel ve revizyon numarası belirtilir.
            </p>
            <div className="flex items-end gap-2">
              <Textarea
                ref={chatTextareaRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Örn: Uçuş öncesi kontrol listesi prosedürü nedir?"
                className="min-h-[44px] max-h-[120px] flex-1 resize-none text-sm"
                rows={1}
                disabled={isChatLoading}
              />
              <Button
                onClick={() => void sendChatMessage()}
                disabled={isChatLoading || !chatInput.trim()}
                size="icon"
                className="size-11 shrink-0"
              >
                {isChatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── ANALYZE TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "analyze" && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Report Creator</h1>
              <p className="text-gray-500 mt-1 text-sm sm:text-base">
                Analiz türünü seçin; regülasyon metnini ve isteğe bağlı şirket manueli/PDF ekleyin.
              </p>
            </div>

            {/* Step 1: Analysis type */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white text-xs">1</span>
                Analiz türü
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {analysisOptions.map((opt) => {
                  const Icon = opt.icon
                  const isActive = selectedType === opt.type
                  return (
                    <button key={opt.type} type="button" onClick={() => setSelectedType(opt.type)}
                      className={`p-4 border-2 rounded-xl text-left transition-all ${isActive ? opt.active : "border-gray-200 " + opt.border}`}
                    >
                      <Icon className={`mb-2 ${opt.iconColor}`} size={22} />
                      <p className="font-semibold text-gray-800 text-sm">{opt.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{opt.description}</p>
                    </button>
                  )
                })}
              </div>
              {selectedType === "regulation_impact" && (
                <p className="text-xs text-violet-900 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2.5 leading-relaxed">
                  <strong>Regülasyon etkisi:</strong> Aşağıya önce yeni regülasyon / genelge metnini yapıştırın; ardından ilgili şirket manuel(ler)ini &quot;metne ekle&quot; ile birleştirin.
                </p>
              )}
            </section>

            {/* Step 2: Sources */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white text-xs">2</span>
                Kaynak ekle
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <BookMarked className="h-4 w-4 text-sky-600" />
                    Kayıtlı şirket manueli
                  </div>
                  <p className="text-xs text-gray-500">
                    Controlled Documents → Manuals ile eklenen PDF&apos;ler. İşaretleyip <strong>metne ekle</strong> deyin.
                  </p>
                  {manuals.length === 0 ? (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-2">
                      Kayıtlı manuel yok. Önce Configurations bölümünden manuel yükleyin.
                    </p>
                  ) : (
                    <>
                      <div className="flex justify-end gap-2 text-xs">
                        <button type="button" className="text-sky-700 hover:underline disabled:opacity-50" disabled={busy}
                          onClick={() => setSelectedManualIds(manuals.map((m) => m.id))}>
                          Tümünü seç
                        </button>
                        <button type="button" className="text-gray-600 hover:underline disabled:opacity-50" disabled={busy}
                          onClick={() => setSelectedManualIds([])}>
                          Temizle
                        </button>
                      </div>
                      <div className="max-h-36 overflow-y-auto rounded-md border border-gray-100 bg-gray-50/80 p-2 space-y-2">
                        {manuals.map((m) => (
                          <div key={m.id} className="flex items-start gap-2">
                            <Checkbox id={`ai-manual-${m.id}`} checked={selectedManualIds.includes(m.id)}
                              onCheckedChange={(v) => toggleManual(m.id, v === true)} disabled={busy} />
                            <label htmlFor={`ai-manual-${m.id}`} className="text-sm text-gray-800 leading-snug cursor-pointer">
                              {m.title}
                            </label>
                          </div>
                        ))}
                      </div>
                      <Button type="button" className="w-full bg-slate-800 hover:bg-slate-900 text-white" size="default"
                        disabled={busy || selectedManualIds.length === 0}
                        onClick={() => void mergeSelectedManualsIntoText()}>
                        {manualLoading ? (<><Loader2 size={16} className="mr-2 animate-spin" />Yükleniyor…</>) : "Seçili manuel(ler)i metne ekle"}
                      </Button>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <FileStack className="h-4 w-4 text-violet-600" />
                    Dosya (PDF, Word, Excel, PowerPoint)
                  </div>
                  <p className="text-xs text-gray-500">
                    Bilgisayarınızdan seçin veya kutuya sürükleyip bırakın.
                  </p>
                  <input id="ai-report-pdf-input" ref={pdfInputRef} type="file" accept={DOCUMENT_ACCEPT_HTML}
                    multiple className="sr-only" disabled={busy} onChange={handlePdfInputChange} />
                  <label
                    htmlFor={busy || pdfLoading ? undefined : "ai-report-pdf-input"}
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={(e) => void handleDrop(e)}
                    className={cn(
                      "w-full min-h-[140px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 px-4 py-6 transition-colors text-center",
                      busy || pdfLoading
                        ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-70"
                        : isDragging
                          ? "border-violet-500 bg-violet-50 cursor-pointer"
                          : "border-gray-300 bg-gray-50/50 hover:border-violet-400 hover:bg-violet-50/30 cursor-pointer"
                    )}>
                    {pdfLoading ? (
                      <><Loader2 className="h-8 w-8 animate-spin text-violet-600" /><span className="text-sm font-medium text-gray-700">Dosya okunuyor…</span></>
                    ) : (
                      <><Upload className="h-8 w-8 text-violet-600" /><span className="text-sm font-medium text-gray-800">Dosya seçmek için tıklayın veya buraya sürükleyin</span><span className="text-xs text-gray-500">.pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx — çoklu seçim</span></>
                    )}
                  </label>
                </div>
              </div>
            </section>

            {/* Step 3: Combined text */}
            <section className="space-y-3" ref={combinedTextSectionRef as React.RefObject<HTMLElement>} id="ai-report-combined-text">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white text-xs">3</span>
                  Birleşik metin (analiz buradan yapılır)
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 tabular-nums">{inputText.length.toLocaleString("tr-TR")} karakter</span>
                  {inputText.trim() && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-gray-600" disabled={busy}
                      onClick={() => { setInputText(""); toast.success("Metin alanı temizlendi.") }}>
                      Metni temizle
                    </Button>
                  )}
                </div>
              </div>
              <Textarea id="ai-report-textarea" value={inputText} onChange={(e) => setInputText(e.target.value)}
                placeholder={"Yukarıdan eklediğiniz metin burada görünür. İsterseniz yeni regülasyon metnini, checklist veya notları doğrudan buraya da yapıştırabilirsiniz."}
                className={cn("min-h-[280px] text-sm leading-relaxed border-2", !inputText.trim() && "border-dashed border-gray-300 bg-amber-50/30")}
                disabled={manualLoading} />
              <p className="text-xs text-amber-900/90 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 leading-relaxed">
                <strong>Not:</strong> Ücretsiz yapay zekâ kotası çok uzun metinleri tek seferde kısaltabilir. Gerekirse metni bölerek analiz edin.
              </p>
              <Button type="button" onClick={() => void handleAnalyze()} disabled={busy || !inputText.trim()}
                size="lg" className="w-full sm:w-auto min-w-[200px] bg-black hover:bg-gray-800 text-white">
                {isAnalyzing ? (<><Loader2 size={18} className="mr-2 animate-spin" />Analiz ediliyor...</>) : (<><Zap size={18} className="mr-2" />Analiz et</>)}
              </Button>
            </section>

            {result && (
              <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-3">
                {lastInputTruncated && (
                  <p className="text-xs text-sky-900 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 leading-relaxed">
                    <strong>Bilgi:</strong> Analiz, uzun metnin yalnızca sunucuya gönderilen ilk kısmına göre yapıldı.
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">AI analiz sonucu</p>
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? <><Check size={14} className="mr-1" />Kopyalandı</> : <><Copy size={14} className="mr-1" />Kopyala</>}
                  </Button>
                </div>
                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{result}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
