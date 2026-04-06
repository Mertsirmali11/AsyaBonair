"use client"

import { IconChevronDown, IconFileTypePdf } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type CorrespondenceAttachmentItem = { path: string; fileName: string }

type Props = {
  attachments: CorrespondenceAttachmentItem[]
  getHref: (path: string) => string | null
}

export function CorrespondenceAttachmentsCell({ attachments, getHref }: Props) {
  if (attachments.length === 0) {
    return "-"
  }

  if (attachments.length === 1) {
    const a = attachments[0]
    const href = getHref(a.path)
    return (
      <a
        href={href ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-[200px] items-center gap-1 truncate text-primary hover:underline"
        title={a.fileName}
        onClick={(e) => {
          if (!href) e.preventDefault()
        }}
      >
        <IconFileTypePdf className="h-4 w-4 shrink-0" />
        <span className="truncate">{a.fileName}</span>
      </a>
    )
  }

  const label = `${attachments.length} PDFs`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 max-w-[9rem] gap-1 px-2 font-normal"
        >
          <IconFileTypePdf className="size-4 shrink-0 text-red-600" />
          <span className="truncate">{label}</span>
          <IconChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2" sideOffset={6}>
        <p className="text-muted-foreground mb-1.5 px-2 text-xs font-medium">
          Attachments
        </p>
        <ul className="max-h-60 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {attachments.map((a) => {
            const href = getHref(a.path)
            return (
              <li key={a.path}>
                <a
                  href={href ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 rounded-md px-2 py-2 text-sm text-primary hover:bg-muted"
                  title={a.fileName}
                  onClick={(e) => {
                    if (!href) e.preventDefault()
                  }}
                >
                  <IconFileTypePdf className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0 break-words">{a.fileName}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
