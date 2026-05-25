"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { ProfilePhotoCropDialog } from "@/components/profile-photo-crop-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  REGISTER_BLOOD_TYPE_OPTIONS,
  REGISTER_EDUCATION_OPTIONS,
  REGISTER_MARITAL_STATUS_OPTIONS,
  WORKER_REGISTRATION_PHOTO_MAX_BYTES,
} from "@/lib/worker-registration-constants"

const initial = {
  isim: "",
  soyisim: "",
  tcNo: "",
  dogumTarihi: "",
  telNo: "",
  adres: "",
  anneAdi: "",
  babaAdi: "",
  medeniDurum: "",
  cocuk: "",
  kanGrubu: "",
  email: "",
  password: "",
  egitimDurum: "",
  acilIletisim: "",
  acilIletisimTel: "",
  sgkSicilNo: "",
  bankaAdi: "",
  iban: "",
}

export function RegisterWorkerForm() {
  const router = useRouter()
  const [form, setForm] = React.useState(initial)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [photoFile, setPhotoFile] = React.useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null)
  const [cropOpen, setCropOpen] = React.useState(false)
  const [cropFile, setCropFile] = React.useState<File | null>(null)
  const [kvkkAccepted, setKvkkAccepted] = React.useState(false)

  React.useEffect(() => {
    if (!photoFile) {
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const setField = (name: keyof typeof initial, value: string) => {
    setForm((f) => ({ ...f, [name]: value }))
  }

  const initials = `${form.isim[0] ?? ""}${form.soyisim[0] ?? ""}`.toUpperCase() || "?"

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!kvkkAccepted) {
      setError("You must read and accept the privacy notice (KVKK) before submitting.")
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => {
        fd.append(k, v)
      })
      if (photoFile) fd.append("photo", photoFile)

      const res = await fetch("/api/worker-registrations", {
        method: "POST",
        body: fd,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) {
        setError(data.error || "Registration failed")
        setSubmitting(false)
        return
      }
      setSuccess(data.message || "Registration submitted.")
      setForm(initial)
      setPhotoFile(null)
      setKvkkAccepted(false)
      setTimeout(() => router.push("/login"), 2800)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex justify-center">
        <div className="rounded-xl border bg-card px-10 py-4 shadow-sm">
          <Image
            src="/logo-bonjour.png"
            alt="Bonjour"
            width={180}
            height={45}
            className="h-auto w-auto"
            priority
          />
        </div>
      </div>

      <Card className="border-border/80 shadow-md">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-2xl">Worker registration</CardTitle>
          <CardDescription>
            Complete all required fields. Your account is created only after an administrator
            approves this request; they will assign your department and your hire date will be set
            to the approval date. You can add a profile photo; it will be cropped to a square before
            upload.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {error && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="mb-6 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-100"
            >
              {success}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-8">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Account
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="email">Work email *</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Personal
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="isim">First name *</Label>
                  <Input
                    id="isim"
                    required
                    value={form.isim}
                    onChange={(e) => setField("isim", e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soyisim">Last name *</Label>
                  <Input
                    id="soyisim"
                    required
                    value={form.soyisim}
                    onChange={(e) => setField("soyisim", e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tcNo">ID number</Label>
                  <Input
                    id="tcNo"
                    value={form.tcNo}
                    onChange={(e) => setField("tcNo", e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of birth</Label>
                  <DatePicker
                    value={form.dogumTarihi}
                    onChange={(v) => setField("dogumTarihi", v)}
                    placeholder="dd.mm.yyyy"
                    disabled={submitting}
                    birthDate
                  />
                  <p className="text-xs text-muted-foreground">
                    Use the month and year menus above the calendar to jump to your birth year.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telNo">Phone</Label>
                  <Input
                    id="telNo"
                    type="tel"
                    value={form.telNo}
                    onChange={(e) => setField("telNo", e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="adres">Address</Label>
                  <Input
                    id="adres"
                    value={form.adres}
                    onChange={(e) => setField("adres", e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <Label className="text-base">Profile photo</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional. JPEG, PNG, GIF, or WebP — max 21 MB. You can drag to frame before
                  upload.
                </p>
                <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <Avatar className="size-24 ring-2 ring-border">
                    <AvatarImage src={photoPreview ?? undefined} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-lg font-medium text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    disabled={submitting}
                    className="max-w-md cursor-pointer"
                    onChange={(ev) => {
                      const f = ev.target.files?.[0]
                      ev.target.value = ""
                      if (!f) return
                      if (f.size > WORKER_REGISTRATION_PHOTO_MAX_BYTES) {
                        setError(
                          `Photo must be at most ${WORKER_REGISTRATION_PHOTO_MAX_BYTES / (1024 * 1024)} MB.`
                        )
                        return
                      }
                      setCropFile(f)
                      setCropOpen(true)
                    }}
                  />
                  {photoFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPhotoFile(null)}
                      disabled={submitting}
                    >
                      Remove photo
                    </Button>
                  )}
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Family
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="anneAdi">Mother&apos;s name</Label>
                  <Input
                    id="anneAdi"
                    value={form.anneAdi}
                    onChange={(e) => setField("anneAdi", e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="babaAdi">Father&apos;s name</Label>
                  <Input
                    id="babaAdi"
                    value={form.babaAdi}
                    onChange={(e) => setField("babaAdi", e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medeniDurum">Marital status</Label>
                  <Select
                    value={form.medeniDurum || undefined}
                    onValueChange={(v) => setField("medeniDurum", v)}
                    disabled={submitting}
                  >
                    <SelectTrigger id="medeniDurum" className="w-full">
                      <SelectValue placeholder="Select marital status" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGISTER_MARITAL_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cocuk">Number of children</Label>
                  <Input
                    id="cocuk"
                    type="number"
                    min={0}
                    value={form.cocuk}
                    onChange={(e) => setField("cocuk", e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Employment &amp; other
              </h3>
              <p className="text-sm text-muted-foreground">
                Department and hire date are set when an administrator approves your registration.
                Termination date and extra fields 1–2 are maintained later in User Settings by an
                administrator.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="kanGrubu">Blood type</Label>
                  <Select
                    value={form.kanGrubu || undefined}
                    onValueChange={(v) => setField("kanGrubu", v)}
                    disabled={submitting}
                  >
                    <SelectTrigger id="kanGrubu" className="w-full">
                      <SelectValue placeholder="Select blood type" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGISTER_BLOOD_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="egitimDurum">Education</Label>
                  <Select
                    value={form.egitimDurum || undefined}
                    onValueChange={(v) => setField("egitimDurum", v)}
                    disabled={submitting}
                  >
                    <SelectTrigger id="egitimDurum" className="w-full">
                      <SelectValue placeholder="Select education level" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGISTER_EDUCATION_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acilIletisim">Emergency contact</Label>
                  <Input
                    id="acilIletisim"
                    value={form.acilIletisim}
                    onChange={(e) => setField("acilIletisim", e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acilIletisimTel">Emergency phone</Label>
                  <Input
                    id="acilIletisimTel"
                    value={form.acilIletisimTel}
                    onChange={(e) => setField("acilIletisimTel", e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sgkSicilNo">SSN / social security no.</Label>
                  <Input
                    id="sgkSicilNo"
                    value={form.sgkSicilNo}
                    onChange={(e) => setField("sgkSicilNo", e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankaAdi">Bank name</Label>
                  <Input
                    id="bankaAdi"
                    value={form.bankaAdi}
                    onChange={(e) => setField("bankaAdi", e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    value={form.iban}
                    onChange={(e) => setField("iban", e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            </section>

            <Separator />

            <div className="rounded-lg border border-border bg-muted/25 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="kvkk-accept"
                  checked={kvkkAccepted}
                  onCheckedChange={(v) => setKvkkAccepted(v === true)}
                  disabled={submitting}
                  className="mt-0.5"
                  aria-required="true"
                />
                <div className="space-y-1 text-sm leading-relaxed text-foreground">
                  <Label htmlFor="kvkk-accept" className="cursor-pointer font-medium leading-relaxed">
                    I have read and agree to the processing of my personal data as described in the
                    official privacy notice (KVKK).
                  </Label>
                  <p className="text-muted-foreground">
                    Open the full text in a new tab:{" "}
                    <Link
                      href="/kvkk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Privacy notice (KVKK)
                    </Link>
                    . You must tick the box above to confirm your consent before registering.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="submit"
                size="lg"
                className="min-w-[200px]"
                disabled={submitting || !kvkkAccepted}
              >
                {submitting ? "Submitting…" : "I agree — submit registration"}
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Already have an approved account?{" "}
              <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      <ProfilePhotoCropDialog
        open={cropOpen}
        onOpenChange={(o) => {
          setCropOpen(o)
          if (!o) setCropFile(null)
        }}
        file={cropFile}
        uploading={false}
        onConfirm={(cropped) => {
          setPhotoFile(cropped)
          setCropOpen(false)
          setCropFile(null)
        }}
      />
    </div>
  )
}
