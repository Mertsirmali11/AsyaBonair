"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { tr } from "date-fns/locale"
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
  value?: string // dd.mm.yyyy format
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = "dd.mm.yyyy",
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Convert dd.mm.yyyy string to Date object
  const parseDate = (dateStr: string | undefined): Date | undefined => {
    if (!dateStr) return undefined
    const parsed = parse(dateStr, "dd.MM.yyyy", new Date())
    return isValid(parsed) ? parsed : undefined
  }

  // Convert Date object to dd.mm.yyyy string
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
          locale={tr}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

