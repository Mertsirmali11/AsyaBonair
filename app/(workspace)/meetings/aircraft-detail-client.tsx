"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type AircraftDetail = {
  id: number
  register: string
  msn: string
}

export function AircraftDetailClient({
  aircraft,
}: {
  aircraft: AircraftDetail
  currentUserId: number
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Aircraft</CardTitle>
          <CardDescription>
            Registration and MSN. Full document management is available under{" "}
            <Link
              href={`/documents/aircraft-settings/${aircraft.id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Controlled Documents → Aircraft Settings
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-sm">Registration</p>
            <p className="text-lg font-semibold">{aircraft.register}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">MSN</p>
            <p className="text-lg font-semibold">{aircraft.msn}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
          <CardDescription>
            Open the aircraft record in Aircraft Settings to upload and view PDFs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/meetings">Back to meetings</Link>
          </Button>
          <Button asChild>
            <Link href={`/documents/aircraft-settings/${aircraft.id}`}>
              Open aircraft documents
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
