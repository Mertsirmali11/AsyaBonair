"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  MessageSquare,
  Minus,
  Paperclip,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ErrorBoundary } from "@/components/error-boundary"
import { uploadAuditSessionAttachmentsDirect } from "@/lib/client-audit-session-attachment-upload"
import { FINDING_CATEGORY_VALUES, findingCategoryLabels, isSacaOrSafaField } from "@/lib/finding-category"

// ─── Types ───────────────────────────────────────────────────────────────────

type ChecklistItem = {
  id: number
  label: string
  sortOrder: number
  isRequired: boolean
  isHeading: boolean
  reference?: string | null
  section?: string | null
}

type FindingInfo = {
  id: number
  findingCode: string
  /** Level1 | Level2 | Observation — SACA/SAFA denetimlerinde null (tek sınıflandırma
   * findingCategory'dir). */
  findingLevel: string | null
  /** CAT1 | CAT2 | CAT3 — yalnızca SACA/SAFA denetimlerinde dolu, diğerlerinde null. */
  findingCategory: string | null
  status: string
}

type Attachment = {
  id: number
  fileName: string
  storagePath: string
  mimeType: string | null
  fileSizeBytes: number | null
  uploadedBy: string
  uploadedAt: string
}

type SessionItemState = {
  id?: number          // set after first save
  result: string       // "" | "S" | "U" | "NA" | "OBS"
  notes: string        // auditor notes
  auditeeNotes: string // auditee notes per item
  finding: FindingInfo | null
  attachments: Attachment[]
  dirty: boolean
  dirtyAuditee: boolean
  saving: boolean
  uploading: boolean
}

type AssignedChecklist = {
  assignmentId: number
  checklistId: number
  title: string
  checklistNumber: string | null
  itemCount: number
}

type AuditEntryData = {
  id: string
  auditNumber: string
  field: string
  status: string
  assignedChecklists: AssignedChecklist[]
}

type AuditSession = {
  id: number
  auditPlanEntryId: number
  auditChecklistId: number
  status: string
  auditorComment: string | null
  auditeeComment: string | null
  checklist: { id: number; title: string; checklistNumber: string | null; items: ChecklistItem[] }
  items: {
    id: number
    auditChecklistItemId: number
    result: string | null
    notes: string | null
    auditeeNotes: string | null
    finding: FindingInfo | null
    attachments: Attachment[]
  }[]
  entry: { status: string; cancellationReason: string | null } | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

type ResultKey = "S" | "U" | "NA" | "OBS"

const resultConfig: Record<ResultKey, { label: string; icon: React.ReactNode; cls: string; activeCls: string }> = {
  S: {
    label: "Satisfactory",
    icon: <CheckCircle2 className="size-3.5" />,
    cls: "border-border text-muted-foreground hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
    activeCls: "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/40",
  },
  U: {
    label: "Unsatisfactory",
    icon: <XCircle className="size-3.5" />,
    cls: "border-border text-muted-foreground hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30",
    activeCls: "border-red-400 text-red-700 bg-red-50 dark:text-red-400 dark:border-red-700 dark:bg-red-950/40",
  },
  NA: {
    label: "N/A",
    icon: <Minus className="size-3.5" />,
    cls: "border-border text-muted-foreground hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/30",
    activeCls: "border-slate-400 text-slate-600 bg-slate-50 dark:text-slate-400 dark:border-slate-600 dark:bg-slate-900/40",
  },
  OBS: {
    label: "Observation",
    icon: <Eye className="size-3.5" />,
    cls: "border-border text-muted-foreground hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30",
    activeCls: "border-amber-400 text-amber-700 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950/40",
  },
}

const FINDING_LEVELS = [
  { value: "Level1", label: "Level 1 Bulgu", desc: "10 gün içinde yanıt beklenir", color: "text-red-700 dark:text-red-400" },
  { value: "Level2", label: "Level 2 Bulgu", desc: "90 gün içinde yanıt beklenir", color: "text-orange-700 dark:text-orange-400" },
  { value: "Observation", label: "Gözlem", desc: "Süre verilmez", color: "text-amber-700 dark:text-amber-400" },
]

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try { return JSON.parse(t) as unknown } catch { return null }
}

function formatBytes(n: number | null): string {
  if (!n) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AuditSessionClient({ auditPlanEntryId }: { auditPlanEntryId: number }) {
  const router = useRouter()

  // ── GEÇİCİ TEŞHİS ENSTRÜMANTASYONU — kök nedeni doğrulamak için, kalıcı
  // fix değil. Root cause netleşince kaldırılacak. Yalnızca console.warn
  // (console.log DEĞİL — next.config.ts'teki compiler.removeConsole prod
  // build'de console.log/info/debug'ı SİLİYOR, yalnızca error/warn kalıyor;
  // bu loglar prod'da görünsün diye bilinçli olarak warn kullanıldı),
  // hiçbir state/davranış değiştirmiyor.
  //
  // GÜNCELLEME (gerçek Preview testi sonrası): "native dosya seçici → popstate
  // → ACTION_RESTORE" teorisi CANLI TESTLE ÇÜRÜTÜLDÜ — [ROUTE-LOADING]
  // mounted/unmounted gözlemlendi ama [POPSTATE] HİÇ ateşlenmedi. Bu yüzden
  // popstate artık ana hipotez olarak KULLANILMIYOR. Listener yine de
  // kaldırılmadı — negatif kontrol olarak değerli (bir sonraki testte de
  // popstate'in gerçekten hiç ateşlenmediğini teyit eder) ve [VISIBILITY]
  // ile aynı yerde durması log okumasını kolaylaştırıyor. Asıl güncel
  // hipotez artık [ROUTE-LOADING] mount'unun [VISIBILITY] hidden→visible
  // ile aynı ana denk gelmesi — bunu kesinleştirmek için mount logu artık
  // href + visibilityState + tam stack trace de taşıyor (app-route-loading.tsx).
  React.useEffect(() => {
    const onPopState = () => {
      console.warn("[POPSTATE] fired", {
        pathname: window.location.pathname,
        href: window.location.href,
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus(),
        ts: Date.now(),
        isoTime: new Date().toISOString(),
      })
    }
    const onVisibility = () => {
      console.warn("[VISIBILITY] change", {
        state: document.visibilityState,
        href: window.location.href,
        hasFocus: document.hasFocus(),
        ts: Date.now(),
        isoTime: new Date().toISOString(),
      })
    }
    window.addEventListener("popstate", onPopState)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("popstate", onPopState)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  // GEÇİCİ TEŞHİS LOGU — AuditSessionClient'ın gerçekten unmount+remount olup
  // olmadığını doğrudan kanıtlamak için. `[]` deps ile yalnızca mount/unmount'ta
  // çalışır — bir remount olursa bu component'in TAMAMEN yeni bir instance'ı
  // oluşturulduğu için bu effect de sıfırdan (yeni bir "mounted" logu ile) çalışır.
  React.useEffect(() => {
    console.warn("[AUDIT-SESSION] mounted", {
      auditPlanEntryId,
      href: window.location.href,
      visibilityState: document.visibilityState,
      ts: Date.now(),
      isoTime: new Date().toISOString(),
    })
    return () => {
      console.warn("[AUDIT-SESSION] unmounted", {
        auditPlanEntryId,
        href: window.location.href,
        visibilityState: document.visibilityState,
        ts: Date.now(),
        isoTime: new Date().toISOString(),
      })
    }
  }, [auditPlanEntryId])

  const [entry, setEntry] = React.useState<AuditEntryData | null>(null)
  const [sessionData, setSessionData] = React.useState<AuditSession | null>(null)
  const [selectedChecklistId, setSelectedChecklistId] = React.useState<number | null>(null)
  const [itemStates, setItemStates] = React.useState<Record<number, SessionItemState>>({})
  const [loading, setLoading] = React.useState(true)
  const [completing, setCompleting] = React.useState(false)
  const [confirmComplete, setConfirmComplete] = React.useState(false)

  // Session-level comments
  const [auditorComment, setAuditorComment] = React.useState("")
  const [auditeeComment, setAuditeeComment] = React.useState("")
  const [savingAuditorComment, setSavingAuditorComment] = React.useState(false)
  const [savingAuditeeComment, setSavingAuditeeComment] = React.useState(false)

  // Finding close loading tracker
  const [closingFindings, setClosingFindings] = React.useState<Set<number>>(new Set())

  // Finding level dialog
  const [findingDialog, setFindingDialog] = React.useState<{
    open: boolean
    itemId: number
    selectedLevel: string
    /** CAT1 | CAT2 | CAT3 — yalnızca SACA/SAFA denetimlerinde kullanılır. */
    selectedCategory: string
  }>({ open: false, itemId: 0, selectedLevel: "Level1", selectedCategory: "CAT1" })

  // SACA/SAFA denetimlerinde Finding Category (CAT1/CAT2/CAT3) seçilebilir
  const isSacaOrSafaAudit = isSacaOrSafaField(entry?.field)

  // ─── Load entry ──────────────────────────────────────────────────────────

  const loadEntry = React.useCallback(async () => {
    // GEÇİCİ TEŞHİS LOGU — bu fonksiyonun NE ZAMAN (yalnızca mount'ta mı, yoksa
    // dosya yükleme sırasında da) çalıştığını ve gerçek HTTP yanıtının ne
    // olduğunu (status/ok/content-type/parse başarısı) doğrudan kanıtlamak için.
    console.warn("[LOAD-ENTRY] start", {
      auditPlanEntryId,
      href: window.location.href,
      visibilityState: document.visibilityState,
      ts: Date.now(),
      isoTime: new Date().toISOString(),
    })
    setLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${auditPlanEntryId}`, { cache: "no-store" })
      const data = await parseJson(res)
      console.warn("[LOAD-ENTRY] response", {
        auditPlanEntryId,
        status: res.status,
        ok: res.ok,
        contentType: res.headers.get("content-type"),
        parsedSuccessfully: data !== null,
        ts: Date.now(),
        isoTime: new Date().toISOString(),
      })
      if (!res.ok || !data) {
        console.warn("[LOAD-ENTRY] failed", {
          auditPlanEntryId,
          reason: !res.ok ? "res.ok=false" : "data=null (parse failed or empty body)",
          status: res.status,
          ts: Date.now(),
          isoTime: new Date().toISOString(),
        })
        toast.error("Denetim planı yüklenemedi.")
        return
      }
      setEntry(data as AuditEntryData)
    } catch (err) {
      console.warn("[LOAD-ENTRY] failed", {
        auditPlanEntryId,
        reason: "exception",
        error: err instanceof Error ? err.message : String(err),
        ts: Date.now(),
        isoTime: new Date().toISOString(),
      })
      toast.error("Yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [auditPlanEntryId])

  React.useEffect(() => { void loadEntry() }, [loadEntry])

  // Auto-select first checklist
  React.useEffect(() => {
    if (entry && entry.assignedChecklists.length > 0 && selectedChecklistId === null) {
      setSelectedChecklistId(entry.assignedChecklists[0].checklistId)
    }
  }, [entry, selectedChecklistId])

  // ─── Start/load session ──────────────────────────────────────────────────

  const startSession = React.useCallback(async (checklistId: number) => {
    try {
      const res = await fetch("/api/audit-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditPlanEntryId, auditChecklistId: checklistId }),
      })
      const data = await parseJson(res)
      if (!res.ok) { toast.error("Oturum başlatılamadı."); return }
      const sess = data as AuditSession
      setSessionData(sess)
      setAuditorComment(sess.auditorComment ?? "")
      setAuditeeComment(sess.auditeeComment ?? "")

      // Build item state map
      const stateMap: Record<number, SessionItemState> = {}
      for (const sItem of sess.items) {
        stateMap[sItem.auditChecklistItemId] = {
          id: sItem.id,
          result: sItem.result ?? "",
          notes: sItem.notes ?? "",
          auditeeNotes: sItem.auditeeNotes ?? "",
          finding: sItem.finding ?? null,
          attachments: sItem.attachments ?? [],
          dirty: false,
          dirtyAuditee: false,
          saving: false,
          uploading: false,
        }
      }
      setItemStates(stateMap)
    } catch {
      toast.error("Bağlantı hatası.")
    }
  }, [auditPlanEntryId])

  React.useEffect(() => {
    if (selectedChecklistId !== null) {
      void startSession(selectedChecklistId)
    }
  }, [selectedChecklistId, startSession])

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const defaultState = (): SessionItemState => ({
    id: undefined, result: "", notes: "", auditeeNotes: "", finding: null,
    attachments: [], dirty: false, dirtyAuditee: false, saving: false, uploading: false,
  })

  const getState = (itemId: number): SessionItemState =>
    itemStates[itemId] ?? defaultState()

  const patchState = (itemId: number, patch: Partial<SessionItemState>) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? defaultState()), ...patch },
    }))
  }

  // ─── Save item to server ──────────────────────────────────────────────────

  const sessionIdRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    sessionIdRef.current = sessionData?.id ?? null
  }, [sessionData])

  // Bir soru için "önce sonuç seçin" engelini kaldıran item-oluşturma isteği
  // (ensureSessionItemId) ile aynı sorudaki eşzamanlı bir başka kayıt işlemi
  // (ör. kullanıcı isteği yollandıktan hemen sonra S/U/NA/OBS seçerse) yarışa
  // girip sonucu üzerine yazabilir. Bu ref, aynı soru için AYNI ANDA en fazla
  // bir "ensure" isteğinin uçtuğunu garanti eder — ikinci çağrı yeni bir istek
  // atmak yerine ilkinin sonucunu bekler.
  const ensuringItemRef = React.useRef<Map<number, Promise<number | null>>>(new Map())

  // Her checklist maddesinin gizli dosya input'una doğrudan (label-wrapping yerine
  // programatik .click() ile) erişmek için — herhangi bir tarayıcıya özgü
  // <label>+iç içe <input> davranış tuhaflığından bağımsız, en yalın tetikleme yolu.
  const fileInputRefs = React.useRef<Map<number, HTMLInputElement>>(new Map())

  const saveItem = React.useCallback(async (
    itemId: number,
    result: string,
    notes: string,
    findingLevel: string | null,
    auditeeNotes?: string,
    findingCategory?: string | null,
  ) => {
    const sid = sessionIdRef.current
    if (!sid) return
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? defaultState()), saving: true },
    }))
    try {
      const res = await fetch(`/api/audit-sessions/${sid}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditChecklistItemId: itemId,
          result: result || null,
          notes: notes || null,
          findingLevel,
          // Sunucu SACA/SAFA dışındaki audit type'larda bu değeri zaten null'a zorlar.
          findingCategory: findingCategory ?? null,
          ...(auditeeNotes !== undefined ? { auditeeNotes: auditeeNotes || null } : {}),
        }),
      })
      const data = await parseJson(res) as Record<string, unknown> | null
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Kaydedilemedi.")
        return
      }
      const finding = (data?.finding ?? null) as FindingInfo | null
      const attachments = (data?.attachments ?? []) as Attachment[]
      setItemStates((prev) => ({
        ...prev,
        [itemId]: { ...(prev[itemId] ?? defaultState()), id: data?.id as number | undefined, finding, attachments, dirty: false, dirtyAuditee: false, saving: false },
      }))
    } catch {
      toast.error("Kaydedilemedi.")
      setItemStates((prev) => ({
        ...prev,
        [itemId]: { ...(prev[itemId] ?? defaultState()), saving: false },
      }))
    }
  }, [])

  // ─── Result click ─────────────────────────────────────────────────────────

  // SACA/SAFA denetimlerinde findingLevel hiç kullanılmaz (tek sınıflandırma Category'dir) —
  // "Level1" gibi eski/varsayılan bir değerin yanlışlıkla kaydedilmemesi için bu audit
  // type'larında her zaman null gönderilir; diğerlerinde mevcut Level davranışı korunur.
  const fallbackFindingLevel = (current: string | null | undefined): string | null =>
    isSacaOrSafaAudit ? null : (current ?? "Level1")

  const handleResultClick = (itemId: number, r: ResultKey) => {
    if (!sessionData || sessionData.status === "Completed") return
    const st = getState(itemId)
    const newResult = st.result === r ? "" : r

    if (newResult === "U") {
      // Open finding level dialog
      setFindingDialog({
        open: true,
        itemId,
        selectedLevel: st.finding?.findingLevel ?? "Level1",
        selectedCategory: st.finding?.findingCategory ?? "CAT1",
      })
      return
    }

    patchState(itemId, { result: newResult, dirty: true })
    void saveItem(itemId, newResult, st.notes, fallbackFindingLevel(st.finding?.findingLevel), undefined, st.finding?.findingCategory ?? null)
  }

  // ─── Finding level dialog confirm ─────────────────────────────────────────

  const confirmFindingLevel = () => {
    const { itemId, selectedLevel, selectedCategory } = findingDialog
    const st = getState(itemId)
    setFindingDialog((p) => ({ ...p, open: false }))
    patchState(itemId, { result: "U", dirty: true })
    // SACA/SAFA'da Level hiç gönderilmez — dialogda seçilen selectedLevel yok sayılır.
    void saveItem(itemId, "U", st.notes, isSacaOrSafaAudit ? null : selectedLevel, undefined, isSacaOrSafaAudit ? selectedCategory : null)
  }

  // ─── Notes save ───────────────────────────────────────────────────────────

  const saveNotes = (itemId: number) => {
    const st = getState(itemId)
    if (!st.dirty) return
    void saveItem(itemId, st.result, st.notes, fallbackFindingLevel(st.finding?.findingLevel), st.auditeeNotes, st.finding?.findingCategory ?? null)
  }

  const saveAuditeeNotes = (itemId: number) => {
    const st = getState(itemId)
    if (!st.dirtyAuditee) return
    void saveItem(itemId, st.result, st.notes, fallbackFindingLevel(st.finding?.findingLevel), st.auditeeNotes, st.finding?.findingCategory ?? null)
  }

  // ─── Close finding (by auditee) ───────────────────────────────────────────

  const closeFinding = async (findingId: number, itemId: number) => {
    setClosingFindings((prev) => new Set(prev).add(findingId))
    try {
      const res = await fetch(`/api/audit-findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Closed" }),
      })
      if (!res.ok) { toast.error("Bulgu kapatılamadı."); return }
      // Update local finding status
      setItemStates((prev) => {
        const st = prev[itemId]
        if (!st?.finding) return prev
        return { ...prev, [itemId]: { ...st, finding: { ...st.finding, status: "Closed" } } }
      })
      toast.success("Bulgu kapatıldı.")
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setClosingFindings((prev) => { const s = new Set(prev); s.delete(findingId); return s })
    }
  }

  // ─── File upload ──────────────────────────────────────────────────────────

  // Attachment ≠ Answer: bir soruya dosya eklemek, o sorunun cevaplandığı anlamına
  // GELMEZ. Ancak AuditSessionItemAttachment.auditSessionItemId, DB'de gerçek bir
  // AuditSessionItem satırına referans vermek ZORUNDADIR (FK) — bu satır önceden
  // yalnızca bir S/U/NA/OBS sonucu kaydedildiğinde (upsert ile) oluşturuluyordu, bu
  // yüzden henüz hiçbir sonuç seçilmemiş bir soruya dosya eklemek "Önce bir sonuç
  // seçin." hatasıyla engelleniyordu. Çözüm: result seçilmeden de mevcut PUT /items
  // upsert'ini result:null ile çağırıp satırı (fake bir S/U/NA/OBS DEĞERİ olmadan,
  // gerçekten result=null olarak) oluşturuyoruz — böylece attachment akışı, answer
  // kaydetme akışıyla gereksiz yere iç içe geçmeden, yalnızca ihtiyaç duyduğu FK'yi
  // şeffaf biçimde sağlıyor. Zaten bir id varsa (önceden herhangi bir sonuç/not
  // kaydedilmişse) tekrar istek atılmaz.
  // Bilinçli olarak useCallback ile memoize EDİLMEDİ: içeride doğrudan getState()
  // çağrılıyor (saveItem'in aksine — o, notes/result gibi güncel değerleri parametre
  // olarak çağıran taraftan alır). Memoize edilseydi ilk render'daki (boş) itemStates
  // closure'ına kilitlenir, kullanıcının o an yazmış olduğu notu okuyamazdı.
  const ensureSessionItemId = (itemId: number): Promise<number | null> => {
    const st = getState(itemId)
    if (st.id) return Promise.resolve(st.id)

    // Aynı soru için zaten uçan bir "ensure" isteği varsa (ör. çift tıklama, ya da
    // upload'la aynı anda bir sonuç/not kaydı tetiklendi), YENİ bir istek atmak
    // yerine mevcut promise paylaşılır — iki eşzamanlı PUT'un birbirinin üzerine
    // yazma riskini (ör. sonucu yanlışlıkla null'a döndürme) ortadan kaldırır.
    const inFlight = ensuringItemRef.current.get(itemId)
    if (inFlight) return inFlight

    const promise = (async (): Promise<number | null> => {
      const sid = sessionIdRef.current
      if (!sid) return null
      console.warn("[AUDIT-UPLOAD] ensure-item-start", { itemId, sid, ts: Date.now() })
      try {
        const res = await fetch(`/api/audit-sessions/${sid}/items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auditChecklistItemId: itemId,
            result: null,
            notes: st.notes || null,
            findingLevel: null,
            findingCategory: null,
            auditeeNotes: st.auditeeNotes || null,
          }),
        })
        const data = await parseJson(res) as Record<string, unknown> | null
        if (!res.ok || !data || typeof data.id !== "number") return null
        // Yalnızca "id"yi ekliyoruz — kullanıcının o an yazıyor olabileceği
        // notes/auditeeNotes/result gibi yerel state'e dokunmuyoruz (üzerine yazmaz).
        patchState(itemId, { id: data.id })
        console.warn("[AUDIT-UPLOAD] ensure-item-success", { itemId, sessionItemId: data.id, ts: Date.now() })
        return data.id
      } catch {
        return null
      } finally {
        ensuringItemRef.current.delete(itemId)
      }
    })()
    ensuringItemRef.current.set(itemId, promise)
    return promise
  }

  // Upload akışındaki hiçbir adımın (item oluşturma, imzalı URL alma, Supabase'e
  // gönderme, kayıt) üst sınırı yoktu — biri (ör. yavaş/askıda kalan bir ağ isteği)
  // hiç çözülmez/reddedilmezse "uploading" sonsuza dek true kalır ve buton kalıcı
  // olarak "Yükleniyor…" durumunda disabled kalırdı (kod DOĞRU çalışıyor olsa bile,
  // asılı kalan bir promise "finally"i asla tetiklemez). Bu, production'da gözlemlenen
  // "Dosya ekle disabled ve tıklanamıyor" ile bire bir örtüşüyor. Çözüm: tüm adımı tek
  // bir zaman aşımı ile yarıştırıyoruz — süre dolarsa temiz bir hata fırlatılır, mevcut
  // catch/finally state'i her zaman doğru şekilde geri alır.
  const UPLOAD_TIMEOUT_MS = 30000

  const uploadFiles = async (itemId: number, files: FileList) => {
    // KÖK NEDEN (refCount:0) — burada, HİÇBİR await'ten ÖNCE, FileList senkron
    // olarak düz bir File[]'e kopyalanıyor. Önceki haliyle ham `files` (canlı
    // FileList) parametre olarak taşınıyordu ve `Array.from(files)` yalnızca
    // `await ensureSessionItemId(...)` ÇÖZÜLDÜKTEN SONRA çağrılıyordu — yani bir
    // ağ round-trip'i kadar GECİKMELİ. Bu arada input'un onChange handler'ı
    // `e.target.value = ""` çalıştırıyor; bu, native `<input type=file>`'ın canlı
    // `FileList`'ini SENKRON olarak boşaltıyor (spec: value sıfırlanınca seçili
    // dosya listesi de sıfırlanır). Sonuç: `doUpload()` içindeki geç `Array.from(files)`
    // artık BOŞ bir FileList'i kopyalıyor → `uploadAuditSessionAttachmentsDirect([])`
    // kendi `if (files.length === 0) return []` koruması yüzünden sessizce `[]`
    // döndürüyor → storage'a hiçbir şey yüklenmiyor, attachment register döngüsü hiç
    // çalışmıyor — tüm bunlar hatasız, "success" gibi görünen bir log akışıyla oluyor.
    const selectedFiles = Array.from(files)
    console.warn("[AUDIT-UPLOAD] selected-files", { itemId, fileCount: selectedFiles.length, fileNames: selectedFiles.map((f) => f.name), ts: Date.now() })
    console.warn("[AUDIT-UPLOAD] file-input-change", { itemId, fileCount: selectedFiles.length, pathname: window.location.pathname, ts: Date.now() })
    // "uploading" hemen (herhangi bir await'ten ÖNCE, senkron olarak) set edilir —
    // hem butonu anında kilitler (aynı soruya çift tıklayıp iki upload'ı üst üste
    // tetiklemeyi engeller) hem de kullanıcıya gecikmesiz görsel geri bildirim verir.
    patchState(itemId, { uploading: true })
    const uploaded: Attachment[] = []
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      if (selectedFiles.length === 0) throw new Error("Dosya seçilmedi.")

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Yükleme zaman aşımına uğradı. Lütfen tekrar deneyin.")),
          UPLOAD_TIMEOUT_MS
        )
      })

      const doUpload = async () => {
        const sid = sessionIdRef.current
        if (!sid) throw new Error("Oturum bulunamadı.")
        const itemDbId = await ensureSessionItemId(itemId)
        if (!itemDbId) throw new Error("Soru için oturum kaydı oluşturulamadı. Lütfen tekrar deneyin.")
        // Dosyalar önce doğrudan Supabase Storage'a yüklenir (Vercel'in ~4.5MB
        // fonksiyon gövde sınırını by-pass eder — büyük fotoğraf/taranmış kanıt
        // dosyaları bu sınırı kolayca aşabiliyordu). Artık en baştan kopyalanmış
        // `selectedFiles` (File[]) kullanılıyor — canlı FileList değil.
        console.warn("[AUDIT-UPLOAD] upload-url-start", { itemId, itemDbId, fileCount: selectedFiles.length, ts: Date.now() })
        const refs = await uploadAuditSessionAttachmentsDirect(sid, itemDbId, selectedFiles)
        console.warn("[AUDIT-UPLOAD] upload-url-success + storage-upload-success", { itemId, refCount: refs.length, ts: Date.now() })
        // Kullanıcı gerçekten dosya seçtiyse (selectedFiles.length > 0) ama helper
        // 0 ref döndürdüyse, bunu sessiz bir "success" saymıyoruz — açık bir hataya
        // çeviriyoruz ki buton "başarılı" görünüp de hiçbir şey yüklenmemiş olmasın.
        if (refs.length === 0 && selectedFiles.length > 0) {
          throw new Error("Dosyalar depoya yüklenemedi (0 sonuç döndü). Lütfen tekrar deneyin.")
        }
        return { sid, itemDbId, refs }
      }

      const { sid, itemDbId, refs } = await Promise.race([doUpload(), timeoutPromise])

      for (const ref of refs) {
        try {
          console.warn("[AUDIT-UPLOAD] register-attachment-start / register-start", { itemId, fileName: ref.fileName, ts: Date.now() })
          const res = await fetch(
            `/api/audit-sessions/${sid}/items/${itemDbId}/attachments`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                path: ref.path,
                fileName: ref.fileName,
                mimeType: ref.mimeType,
                sizeBytes: ref.sizeBytes,
                uploadedBy: "auditor",
              }),
            }
          )
          console.warn("[AUDIT-UPLOAD] register-response", { itemId, fileName: ref.fileName, ok: res.ok, status: res.status, ts: Date.now() })
          if (!res.ok) { toast.error(`${ref.fileName} kaydedilemedi.`); continue }
          console.warn("[AUDIT-UPLOAD] register-attachment-success", { itemId, fileName: ref.fileName, ts: Date.now() })
          const parsed = await parseJson(res)
          // Yalnızca "id" alanını değil, render'ın okuduğu her alanı burada normalize
          // ediyoruz — sunucu yanıtı beklenmedik bir şekle sahip olsa bile (eksik alan,
          // yanlış tip vb.) state'e her zaman geçerli bir Attachment objesi yazılır;
          // render aşamasında undefined/null erişimi nedeniyle çökme oluşmaz.
          const raw = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
          const parsedId = raw && typeof raw.id === "number" ? raw.id : null
          if (!raw || parsedId === null) {
            toast.error(`${ref.fileName} yüklendi ama sunucu yanıtı okunamadı. Sayfayı yenileyin.`)
            continue
          }
          const normalized: Attachment = {
            id: parsedId,
            fileName: typeof raw.fileName === "string" && raw.fileName ? raw.fileName : ref.fileName,
            storagePath: typeof raw.storagePath === "string" ? raw.storagePath : ref.path,
            mimeType: typeof raw.mimeType === "string" ? raw.mimeType : null,
            fileSizeBytes: typeof raw.fileSizeBytes === "number" ? raw.fileSizeBytes : null,
            uploadedBy: typeof raw.uploadedBy === "string" ? raw.uploadedBy : "auditor",
            uploadedAt: typeof raw.uploadedAt === "string" ? raw.uploadedAt : new Date().toISOString(),
          }
          uploaded.push(normalized)
        } catch (err) {
          toast.error(`${ref.fileName} kaydedilemedi: ${err instanceof Error ? err.message : "bilinmeyen hata"}.`)
        }
      }
      if (uploaded.length > 0) {
        setItemStates((prev) => ({
          ...prev,
          [itemId]: { ...(prev[itemId] ?? defaultState()), attachments: [...(prev[itemId]?.attachments ?? []), ...uploaded] },
        }))
        console.warn("[AUDIT-UPLOAD] state-patched", { itemId, uploadedCount: uploaded.length, ts: Date.now() })
        toast.success(`${uploaded.length} dosya yüklendi.`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yükleme başarısız.")
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      patchState(itemId, { uploading: false })
      console.warn("[AUDIT-UPLOAD] finished", { itemId, pathname: window.location.pathname, ts: Date.now() })
    }
  }

  const removeAttachment = async (itemId: number, attachmentId: number) => {
    const st = getState(itemId)
    if (!st.id || !sessionData) return
    try {
      await fetch(
        `/api/audit-sessions/${sessionData.id}/items/${st.id}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" }
      )
      patchState(itemId, { attachments: getState(itemId).attachments.filter((a) => a.id !== attachmentId) })
    } catch {
      toast.error("Silinemedi.")
    }
  }

  // ─── Save session-level comments ─────────────────────────────────────────

  const saveAuditorComment = async () => {
    if (!sessionData) return
    setSavingAuditorComment(true)
    try {
      await fetch(`/api/audit-sessions/${sessionData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditorComment: auditorComment || null }),
      })
    } catch {
      toast.error("Denetçi yorumu kaydedilemedi.")
    } finally {
      setSavingAuditorComment(false)
    }
  }

  const saveAuditeeComment = async () => {
    if (!sessionData) return
    setSavingAuditeeComment(true)
    try {
      await fetch(`/api/audit-sessions/${sessionData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditeeComment: auditeeComment || null }),
      })
    } catch {
      toast.error("Denetlenen yorumu kaydedilemedi.")
    } finally {
      setSavingAuditeeComment(false)
    }
  }

  // ─── Complete session ────────────────────────────────────────────────────

  const completeSession = async () => {
    if (!sessionData) return
    setCompleting(true)
    try {
      const res = await fetch(`/api/audit-sessions/${sessionData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      })
      const data = await parseJson(res) as { error?: string; entryCompleted?: boolean } | null
      if (!res.ok) {
        toast.error(
          data && typeof data.error === "string" && data.error.trim()
            ? data.error.trim()
            : "Audit could not be completed. Please try again or contact the system administrator."
        )
        return
      }
      toast.success(
        data?.entryCompleted
          ? "Audit successfully completed."
          : "Denetim tamamlandı. Bulgular oluşturuldu."
      )
      // Denetim kaydının (Manage Audit) merkezi Completed görünümüne dön — eski
      // liste ekranına değil; checklist, bulgular, dosyalar, notlar ve geçmiş
      // olduğu gibi orada görüntülenmeye devam eder.
      router.push(`/compliance/audit-plan/${auditPlanEntryId}/manage`)
    } catch {
      toast.error("Audit could not be completed. Please try again or contact the system administrator.")
    } finally {
      setCompleting(false)
      setConfirmComplete(false)
    }
  }

  // ─── Derived values ──────────────────────────────────────────────────────

  const items = sessionData?.checklist?.items ?? []
  const questionItems = items.filter((it) => !it.isHeading)
  const answeredCount = questionItems.filter((it) => getState(it.id).result !== "").length
  const unsatisfactoryCount = questionItems.filter((it) => getState(it.id).result === "U").length
  const completed = sessionData?.status === "Completed"

  let questionNumber = 0

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title="Denetim Yürüt" />
      <div className="flex flex-col gap-4 p-4 md:p-6">

        {/* Breadcrumb */}
        <Breadcrumb className="text-xs sm:text-sm">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard">Dashboard</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance">Compliance Monitoring</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance/audit-plan">Audit Plan</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href={`/compliance/audit-plan/${auditPlanEntryId}/manage`}>Manage Audit</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Denetim Yürüt</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Manage Audit'ten girilen denetim oturumundan geri dönüş yine Manage Audit'e
                gitmeli — eski davranışta doğrudan Audit Plan listesine dönüyordu. */}
            <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" asChild>
              <Link href={`/compliance/audit-plan/${auditPlanEntryId}/manage`}><ArrowLeft className="size-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <ClipboardCheck className="size-5 text-emerald-600" />
                {loading ? "Yükleniyor…" : entry ? `Denetim — ${entry.field}` : "Denetim"}
              </h1>
              {entry && (
                <p className="text-muted-foreground text-sm mt-0.5">{entry.auditNumber}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sessionData && !completed && (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setConfirmComplete(true)}
              >
                <CheckCircle2 className="mr-1.5 size-4" />
                Denetimi Tamamla
              </Button>
            )}
            {completed && (
              <Badge className="bg-teal-600 text-white">Tamamlandı</Badge>
            )}
          </div>
        </div>

        {/* İptal bilgisi */}
        {sessionData?.entry?.status === "Cancelled" && (
          <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-semibold">Bu denetim iptal edildi.</span>
              {sessionData.entry.cancellationReason && (
                <> {" "}Neden: {sessionData.entry.cancellationReason}</>
              )}
            </span>
          </div>
        )}

        {/* Progress bar */}
        {sessionData && questionItems.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(answeredCount / questionItems.length) * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              {answeredCount}/{questionItems.length} yanıtlandı
              {unsatisfactoryCount > 0 && (
                <span className="ml-2 text-red-600 font-medium">· {unsatisfactoryCount} bulgu</span>
              )}
            </span>
          </div>
        )}

        {/* Checklist selector */}
        {entry && entry.assignedChecklists.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium shrink-0">Checklist:</span>
            <Select
              value={String(selectedChecklistId)}
              onValueChange={(v) => setSelectedChecklistId(Number(v))}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entry.assignedChecklists.map((a) => (
                  <SelectItem key={a.checklistId} value={String(a.checklistId)}>
                    {a.checklistNumber ?? `CL-${a.checklistId}`} — {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* No checklists */}
        {!loading && entry && entry.assignedChecklists.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="inline mr-2 size-4" />
            Bu denetim planına checklist atanmamış. Önce Audit Plan&apos;dan bir checklist atayın.
          </div>
        )}

        {/* Question list — ErrorBoundary ile sarmalı: bu bloktaki beklenmeyen bir render
            hatası (örn. bir dosya yüklemesi sonrası state güncellemesinde bozuk/eksik veri)
            yalnızca bu alt ağacı etkiler; başlık, ilerleme çubuğu ve "Denetimi Tamamla"
            butonu çalışmaya devam eder — sayfa beyaz ekrana düşmez, manuel yenileme
            gerekmez. "Yeniden Dene" checklist'i sıfırdan yeniden yükler. */}
        {sessionData && items.length > 0 && (
          <ErrorBoundary
            label="Checklist"
            onReset={() => { if (selectedChecklistId) void startSession(selectedChecklistId) }}
          >
          <div className="rounded-xl border bg-card shadow-sm divide-y overflow-hidden">
            {items.map((item) => {

              // ── Section heading ───────────────────────────────────────────
              if (item.isHeading) {
                return (
                  <div key={item.id} className="px-5 py-2.5 bg-muted/60 border-l-4 border-l-amber-400">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                      {item.label}
                    </p>
                  </div>
                )
              }

              // ── Question ──────────────────────────────────────────────────
              questionNumber++
              const st = getState(item.id)
              const isU   = st.result === "U"
              const isOBS = st.result === "OBS"
              const finding = st.finding
              const isFindingClosed = finding?.status === "Closed"

              return (
                <div key={item.id} className={cn(
                  // Not: burada bilinçli olarak CSS transition kullanılmıyor.
                  // Bu kapsayıcı, cevap değiştikçe (S/U/NA/OBS) arka plan
                  // rengini değiştiriyor; bir cevap kaydedildiğinde madde
                  // içine (Finding paneli, ek dosya rozetleri vb.) yeni içerik
                  // ekleniyor. Bu container'da aktif bir CSS transition/animasyon
                  // varsa, tarayıcının native scroll-anchoring mekanizması bu
                  // elemanı anchor adayı olarak eleyebiliyor; bu da görünürdeki
                  // içerik üstte büyüdüğünde sayfanın/checklist'in beklenmedik
                  // şekilde kaymasına (scroll jump) yol açabiliyor.
                  isU   && !isFindingClosed && "bg-red-50/40 dark:bg-red-950/10",
                  isOBS && "bg-amber-50/40 dark:bg-amber-950/10",
                  st.result === "S" && "bg-emerald-50/20 dark:bg-emerald-950/5",
                )}>

                  {/* ── Question header row ─────────────────────────────── */}
                  <div className="flex items-start gap-3 px-4 pt-4 pb-2">
                    <span className="shrink-0 mt-0.5 w-6 text-right font-mono text-xs text-muted-foreground">
                      {questionNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug font-medium">{item.label}</p>
                      {(item.reference || finding) && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {item.reference && (
                            <span className="font-mono text-[11px] text-muted-foreground">Ref: {item.reference}</span>
                          )}
                          {finding && (
                            <Badge className={cn(
                              "text-[11px] px-1.5 py-0 h-4 border",
                              isFindingClosed
                                ? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                                : finding.findingLevel === "Level1" && "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400",
                              !isFindingClosed && finding.findingLevel === "Level2" && "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400",
                              !isFindingClosed && finding.findingLevel === "Observation" && "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400",
                            )}>
                              {finding.findingCode}
                              {finding.findingCategory ? ` · ${findingCategoryLabels[finding.findingCategory as keyof typeof findingCategoryLabels] ?? finding.findingCategory}` : ""}
                              {isFindingClosed && " ✓"}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Result buttons */}
                    <div className="flex shrink-0 gap-1">
                      {(["S", "U", "NA", "OBS"] as ResultKey[]).map((r) => {
                        const cfg = resultConfig[r]
                        const active = st.result === r
                        return (
                          <button
                            key={r}
                            type="button"
                            disabled={completed || st.saving}
                            onClick={() => handleResultClick(item.id, r)}
                            title={cfg.label}
                            className={cn(
                              // "transition-all" bilinçli olarak kaldırıldı — bkz. yukarıdaki
                              // madde kapsayıcısındaki scroll-anchoring notu.
                              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold",
                              active ? cfg.activeCls : cfg.cls,
                              (completed || st.saving) && "opacity-50 cursor-not-allowed",
                            )}
                          >
                            {cfg.icon}
                            <span>{r}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── U: Finding panel ────────────────────────────────── */}
                  {isU && finding && (
                    <div className={cn(
                      "mx-4 mb-2 rounded-lg border px-3 py-2.5 text-xs",
                      isFindingClosed
                        ? "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/30"
                        : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20",
                    )}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <div className={cn(
                          "flex items-center gap-1.5 font-semibold",
                          isFindingClosed ? "text-slate-500 dark:text-slate-400" : "text-red-700 dark:text-red-300",
                        )}>
                          {isFindingClosed
                            ? <CheckCircle2 className="size-3.5" />
                            : <AlertTriangle className="size-3.5" />
                          }
                          <span className="font-mono">{finding.findingCode}</span>
                          <span className="font-normal opacity-75">
                            {finding.findingLevel === "Level1" && "— Level 1"}
                            {finding.findingLevel === "Level2" && "— Level 2"}
                            {finding.findingLevel === "Observation" && "— Gözlem"}
                            {finding.findingCategory && ` · ${findingCategoryLabels[finding.findingCategory as keyof typeof findingCategoryLabels] ?? finding.findingCategory}`}
                          </span>
                          {isFindingClosed && <span className="text-emerald-600 dark:text-emerald-400">— Kapatıldı</span>}
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          {!isFindingClosed && (
                            <>
                              {/* Denetlenen: bulguya cevap verir */}
                              <Link
                                href={`/compliance/findings-follow-up/${finding.id}`}
                                className="rounded border border-blue-300 bg-white dark:bg-blue-950/50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                              >
                                Denetlenen: Cevap Ver →
                              </Link>
                              {/* Denetçi: bulguyu kapatır */}
                              <button
                                type="button"
                                disabled={closingFindings.has(finding.id)}
                                onClick={() => void closeFinding(finding.id, item.id)}
                                className="rounded border border-emerald-300 bg-white dark:bg-emerald-950/50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors disabled:opacity-50"
                              >
                                {closingFindings.has(finding.id) ? "Kapatılıyor…" : "Denetçi: Kapat ✓"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── OBS notice ──────────────────────────────────────── */}
                  {isOBS && (
                    <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
                      <Eye className="size-3.5 shrink-0" />
                      Gözlem olarak işaretlendi
                    </div>
                  )}

                  {/* ── Per-item comment boxes + attachments ────────────── */}
                  <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">

                    {/* Denetçi notu */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                        <MessageSquare className="size-3" />
                        Denetçi Notu
                      </label>
                      <Textarea
                        value={st.notes}
                        onChange={(e) => patchState(item.id, { notes: e.target.value, dirty: true })}
                        onBlur={() => saveNotes(item.id)}
                        placeholder="Denetçi yorumu…"
                        className="min-h-[72px] text-xs resize-none"
                        disabled={completed}
                      />
                    </div>

                    {/* Denetlenen notu */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                        <MessageSquare className="size-3" />
                        Denetlenen Notu
                      </label>
                      <Textarea
                        value={st.auditeeNotes}
                        onChange={(e) => patchState(item.id, { auditeeNotes: e.target.value, dirtyAuditee: true })}
                        onBlur={() => saveAuditeeNotes(item.id)}
                        placeholder="Denetlenenin yanıtı veya açıklaması…"
                        className="min-h-[72px] text-xs resize-none"
                      />
                    </div>

                    {/* Attachments row (full width) */}
                    <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                      {(st.attachments ?? [])
                        .filter((att): att is Attachment => !!att && att.id != null)
                        .map((att) => (
                        <div key={att.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                          <Paperclip className="size-3 shrink-0" />
                          <span className="max-w-[180px] truncate">{att.fileName || "Dosya"}</span>
                          <span className="opacity-60 shrink-0">{formatBytes(att.fileSizeBytes ?? null)}</span>
                          {!completed && (
                            <button type="button" onClick={() => void removeAttachment(item.id, att.id)} className="ml-0.5 text-destructive/60 hover:text-destructive shrink-0">
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      {!completed && (
                        <>
                          <button
                            type="button"
                            disabled={st.uploading}
                            onClick={() => fileInputRefs.current.get(item.id)?.click()}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 transition-colors",
                              st.uploading && "opacity-50 pointer-events-none",
                            )}
                          >
                            <Upload className="size-3" />
                            {st.uploading ? "Yükleniyor…" : "Dosya ekle"}
                          </button>
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            disabled={st.uploading}
                            ref={(el) => {
                              if (el) fileInputRefs.current.set(item.id, el)
                              else fileInputRefs.current.delete(item.id)
                            }}
                            onChange={(e) => {
                              if (e.target.files?.length) void uploadFiles(item.id, e.target.files)
                              e.target.value = ""
                            }}
                          />
                        </>
                      )}
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
          </ErrorBoundary>
        )}

      </div>

      {/* ── Finding Level Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={findingDialog.open}
        onOpenChange={(open) => {
          if (!open) setFindingDialog((p) => ({ ...p, open: false }))
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-4 text-red-600" />
              {isSacaOrSafaAudit ? "Finding Category Seçin" : "Bulgu Seviyesi Seçin"}
            </DialogTitle>
          </DialogHeader>
          {/* SACA/SAFA denetimlerinde tek sınıflandırma Finding Category'dir — Bulgu Seviyesi
              (Level) hiç gösterilmez, seçilmez, kaydedilmez. Diğer audit type'larında (ör.
              Internal Audit) mevcut Level davranışı aynen korunur. */}
          {!isSacaOrSafaAudit && (
            <div className="space-y-3 py-1">
              {FINDING_LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => setFindingDialog((p) => ({ ...p, selectedLevel: lvl.value }))}
                  className={cn(
                    "w-full rounded-lg border-2 px-4 py-3 text-left transition-colors",
                    findingDialog.selectedLevel === lvl.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className={cn("font-semibold text-sm", lvl.color)}>{lvl.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{lvl.desc}</div>
                </button>
              ))}
            </div>
          )}
          {isSacaOrSafaAudit && (
            <div className="space-y-2 pb-1">
              <p className="text-xs font-medium text-muted-foreground">Finding Category *</p>
              <div className="flex gap-2">
                {FINDING_CATEGORY_VALUES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFindingDialog((p) => ({ ...p, selectedCategory: cat }))}
                    className={cn(
                      "flex-1 rounded-lg border-2 px-3 py-2 text-center text-sm font-semibold transition-colors",
                      findingDialog.selectedCategory === cat
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    {findingCategoryLabels[cat]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFindingDialog((p) => ({ ...p, open: false }))}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmFindingLevel}
            >
              Bulgu Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Complete Confirmation Dialog ──────────────────────────────────── */}
      <Dialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Denetimi tamamla?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Denetim tamamlandıktan sonra değişiklik yapılamaz.</p>
            {unsatisfactoryCount > 0 && (
              <p className="text-red-700 dark:text-red-400 font-medium">
                <AlertTriangle className="inline mr-1.5 size-4" />
                {unsatisfactoryCount} adet &ldquo;Unsatisfactory&rdquo; bulgu Findings Follow Up&apos;a eklenecek.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmComplete(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={completing}
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={completeSession}
            >
              {completing ? "Tamamlanıyor…" : "Tamamla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
