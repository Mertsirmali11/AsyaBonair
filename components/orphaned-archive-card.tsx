"use client"

import * as React from "react"
import { IconArchive, IconChevronDown } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"

type OrphanedArchiveCardProps = {
  loading: boolean
  itemCount: number
  filteredEmpty: boolean
  filteredEmptyMessage: string
  description: string
  children: React.ReactNode
}

/** Seride güncel kalmayan arşiv kayıtları — manuel / form listelerinin altında. */
export function OrphanedArchiveCard({
  loading,
  itemCount,
  filteredEmpty,
  filteredEmptyMessage,
  description,
  children,
}: OrphanedArchiveCardProps) {
  if (!loading && itemCount === 0) return null

  return (
    <Card>
      <Collapsible defaultOpen={!loading && itemCount > 0 && itemCount <= 8}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left [&[data-state=open]>svg:last-child]:rotate-180"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <IconArchive className="text-muted-foreground size-5 shrink-0" />
              <CardTitle className="text-base">Arşiv</CardTitle>
              {!loading && itemCount > 0 ? (
                <Badge variant="secondary" className="font-normal tabular-nums">
                  {itemCount}
                </Badge>
              ) : null}
            </div>
            <IconChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform duration-200" />
          </CollapsibleTrigger>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredEmpty ? (
              <p className="text-muted-foreground text-sm">{filteredEmptyMessage}</p>
            ) : (
              children
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
