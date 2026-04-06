"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { enUS } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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

  const parseDate = (dateStr: string | undefined): Date | undefined => {
    if (!dateStr) return undefined
    const parsed = parse(dateStr, "dd.MM.yyyy", new Date())
    return isValid(parsed) ? parsed : undefined
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
      defaultMonth={selectedDate ?? new Date(currentYear - 30, 0, 1)}
    />
  )

  if (allowManualInput) {
    return (
      <div className="flex w-full gap-2">
        <Input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 font-mono text-sm h-9"
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

