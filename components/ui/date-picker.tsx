"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { enUS } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
}

export function DatePicker({
  value,
  onChange,
  placeholder = "dd.mm.yyyy",
  disabled = false,
  birthDate = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const currentYear = new Date().getFullYear()

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
      </PopoverContent>
    </Popover>
  )
}

