"use client"

import * as React from "react"
import { format, parse, isValid, isAfter, startOfDay } from "date-fns"
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

interface DatePickerLimitedProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function DatePickerLimited({
  value,
  onChange,
  placeholder = "dd.mm.yyyy",
  disabled = false,
}: DatePickerLimitedProps) {
  const [open, setOpen] = React.useState(false)

  const parseDate = (dateStr: string | undefined): Date | undefined => {
    if (!dateStr) return undefined
    const parsed = parse(dateStr, "dd.MM.yyyy", new Date())
    return isValid(parsed) ? parsed : undefined
  }

  const formatDate = (date: Date): string => {
    return format(date, "dd.MM.yyyy")
  }

  const selectedDate = parseDate(value)

  const today = startOfDay(new Date())

  const isDateDisabled = (date: Date) => {
    return isAfter(startOfDay(date), today)
  }

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
          disabled={isDateDisabled}
          defaultMonth={selectedDate ?? new Date()}
        />
      </PopoverContent>
    </Popover>
  )
}

