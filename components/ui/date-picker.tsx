"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { enUS } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDateInputMask, isDateInputComplete, parseDdMmYyyyToUtcDate } from "@/lib/correspondence-date"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/** Digits typed strictly before `pos` in the raw (possibly still-unmasked) string. */
function digitsBefore(str: string, pos: number): number {
  return str.slice(0, pos).replace(/\D/g, "").length
}

/** Cursor index inside `masked` that sits right after the `digitCount`-th digit. */
function cursorAfterDigitCount(masked: string, digitCount: number): number {
  if (digitCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < masked.length; i++) {
    if (/\d/.test(masked[i])) {
      seen++
      if (seen === digitCount) return i + 1
    }
  }
  return masked.length
}

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /**
   * Month and year dropdowns for faster navigation (e.g. date of birth).
   * Year range defaults to last 100 years through the current calendar year.
   */
  birthDate?: boolean
  /**
   * Show a text field for typing (dd.MM.yyyy) plus a calendar button.
   * Defaults to true except when `birthDate` is true (calendar-only then).
   */
  allowManualInput?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = "dd.mm.yyyy",
  disabled = false,
  birthDate = false,
  allowManualInput: allowManualInputProp,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const currentYear = new Date().getFullYear()
  const allowManualInput =
    allowManualInputProp !== undefined ? allowManualInputProp : !birthDate
  const textInputRef = React.useRef<HTMLInputElement>(null)

  const showInvalid = !!value && isDateInputComplete(value) && !parseDdMmYyyyToUtcDate(value)

  const applyMasked = (masked: string, cursorDigitCount: number) => {
    onChange?.(masked)
    requestAnimationFrame(() => {
      const pos = cursorAfterDigitCount(masked, cursorDigitCount)
      textInputRef.current?.setSelectionRange(pos, pos)
    })
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const cursorPos = e.target.selectionStart ?? raw.length
    const digitCount = digitsBefore(raw, cursorPos)
    applyMasked(formatDateInputMask(raw), digitCount)
  }

  // Backspace/Delete right next to an auto-inserted "." must remove the adjacent digit too —
  // otherwise the dot just bounces back (removed then immediately re-inserted by the mask)
  // and the field looks stuck to the user.
  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const pos = input.selectionStart ?? 0
    const selEnd = input.selectionEnd ?? pos
    if (pos !== selEnd) return // has a real selection — let the browser handle it normally
    const raw = input.value

    if (e.key === "Backspace" && pos > 0 && raw[pos - 1] === ".") {
      e.preventDefault()
      const digitCount = digitsBefore(raw, pos - 1)
      const digits = raw.replace(/\D/g, "")
      const newDigits = digits.slice(0, digitCount - 1) + digits.slice(digitCount)
      applyMasked(formatDateInputMask(newDigits), digitCount - 1)
    } else if (e.key === "Delete" && raw[pos] === ".") {
      e.preventDefault()
      const digitCount = digitsBefore(raw, pos)
      const digits = raw.replace(/\D/g, "")
      const newDigits = digits.slice(0, digitCount) + digits.slice(digitCount + 1)
      applyMasked(formatDateInputMask(newDigits), digitCount)
    }
  }

  const parseDate = (dateStr: string | undefined): Date | undefined => {
    if (!dateStr) return undefined
    const parsed = parse(dateStr, "dd.MM.yyyy", new Date())
    if (!isValid(parsed)) return undefined
    // date-fns `parse` silently rolls over out-of-range values (e.g. 31.02 -> 03.03) instead
    // of rejecting them — round-trip through the same day/month/year to catch that, so the
    // calendar never "selects" a date that doesn't match what was actually typed.
    if (format(parsed, "dd.MM.yyyy") !== dateStr) return undefined
    return parsed
  }

  const formatDate = (date: Date): string => {
    return format(date, "dd.MM.yyyy")
  }

  const selectedDate = parseDate(value)

  const handleSelect = (date: Date | undefined) => {
    if (date && onChange) {
      onChange(formatDate(date))
    }
    setOpen(false)
  }

  const calendar = (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={handleSelect}
      locale={enUS}
      initialFocus
      captionLayout={birthDate ? "dropdown" : "label"}
      fromYear={birthDate ? currentYear - 100 : undefined}
      toYear={birthDate ? currentYear : undefined}
      defaultMonth={
        selectedDate ??
        (birthDate ? new Date(currentYear - 30, 0, 1) : new Date())
      }
    />
  )

  if (allowManualInput) {
    return (
      <div className="w-full space-y-1">
        <div className="flex w-full gap-2">
          <Input
            ref={textInputRef}
            type="text"
            inputMode="numeric"
            value={value ?? ""}
            onChange={handleTextChange}
            onKeyDown={handleTextKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={10}
            aria-invalid={showInvalid}
            className={cn("min-w-0 flex-1 font-mono text-sm h-9", showInvalid && "border-destructive focus-visible:ring-destructive/40")}
            autoComplete="off"
            spellCheck={false}
          />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                className="h-9 w-9 shrink-0"
                title="Open calendar"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              {calendar}
            </PopoverContent>
          </Popover>
        </div>
        {showInvalid && <p className="text-xs text-destructive">Geçerli bir tarih giriniz.</p>}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-9",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {calendar}
      </PopoverContent>
    </Popover>
  )
}

