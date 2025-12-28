"use client"

import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePickerLimited } from "@/components/ui/date-picker-limited"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface ReportHazardFormProps {
  userId: string
}

const SOURCE_TYPES = [
  "Safety Observation",
  "Incident Report",
  "Near Miss",
  "Hazard Identification",
  "Other",
]

export function ReportHazardForm({ userId }: ReportHazardFormProps) {
  const [eventDate, setEventDate] = useState<string>("")
  const [sourceType, setSourceType] = useState<string>("")
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false)
  const [title, setTitle] = useState<string>("")
  const [details, setDetails] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      // Convert dd.mm.yyyy to YYYY-MM-DD for API
      const dateParts = eventDate.split(".")
      if (dateParts.length !== 3) {
        setError("Invalid date format")
        setSubmitting(false)
        return
      }
      const [day, month, year] = dateParts
      const isoDate = `${year}-${month}-${day}`

      const response = await fetch("/api/hazard-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventDate: isoDate,
          sourceType: sourceType || null,
          isAnonymous: isAnonymous,
          title: title || null,
          details: details || null,
          reportedBy: isAnonymous ? null : parseInt(userId),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Failed to submit hazard report")
        return
      }

      setSuccess(true)
      setEventDate("")
      setSourceType("")
      setIsAnonymous(false)
      setTitle("")
      setDetails("")
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSuccess(false)
      }, 3000)
    } catch (err) {
      console.error("Error submitting hazard report:", err)
      setError("An error occurred while submitting the report")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Hazard Report</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            
            {success && (
              <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-400">
                Hazard report submitted successfully!
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="eventDate" className="text-sm font-medium">
                Event Date
              </Label>
              <DatePickerLimited
                value={eventDate}
                onChange={setEventDate}
                placeholder="Select event date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceType" className="text-sm font-medium">
                Source Type
              </Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger id="sourceType" className="w-full">
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="notAnonymous"
                checked={!isAnonymous}
                onCheckedChange={(checked) => setIsAnonymous(!checked)}
              />
              <Label
                htmlFor="notAnonymous"
                className="text-sm font-medium cursor-pointer"
              >
                Not anonymous (Reporter information will be saved)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Please briefly describe the subject of your report..."
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="details" className="text-sm font-medium">
                Details
              </Label>
              <Textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Please write the details of your report. Do not omit any information that may be important."
                className="w-full min-h-[120px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="submit"
                disabled={submitting || !eventDate}
                className="bg-slate-700 hover:bg-slate-800"
              >
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

