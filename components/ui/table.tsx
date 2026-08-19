"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { cn } from "@/lib/utils"

type TableProps = React.ComponentProps<"table"> & {
  /**
   * Dış sarmalayıcı `<div>`'in className'ini TAMAMEN değiştirir (varsayılan:
   * `"relative w-full overflow-x-auto"`). Yalnızca sticky `TableHeader` ile
   * birlikte, tabloyu kendi `ScrollArea`'sı içine koyarken kullanın —
   * `containerClassName="relative w-full"` verip `overflow-x-auto`'yu
   * bilerek DIŞARIDA bırakın.
   *
   * Neden: `position: sticky`, "en yakın, overflow'u visible olmayan ata"ya
   * göre hesaplanır. Bu div'in kendi `overflow-x-auto`'su, DIŞARIDA zaten
   * hem x hem y scroll'u tek elemanda yöneten doğru bir `ScrollArea` olsa
   * bile, sticky'nin referans aldığı en-yakın-ata olur ve sticky'yi kırar
   * (CSS: overflow-x visible değilse overflow-y de "auto"ya yükseltilir —
   * bu iç div, dıştaki gerçek scroll kutusunu gölgeler). Çözüm: yatay VE
   * dikey scroll'u TEK elemanda yönet (ScrollArea'nın Viewport'u zaten
   * ikisini de yapıyor), bu iç div'e ayrıca overflow verme.
   */
  containerClassName?: string
}

function Table({ className, containerClassName, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      className={containerClassName ?? "relative w-full overflow-x-auto"}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

type TableHeaderProps = React.ComponentProps<"thead"> & {
  /**
   * Header dikey scroll'da (kendi ScrollArea'sı içinde veya sayfanın kendi
   * scroll'unda) üstte sabit kalsın — opak arka plan + z-index dahil.
   * Opt-in: verilmezse davranış hiç değişmez, mevcut tüm tablolar etkilenmez.
   * Arka plan varsayılanı `bg-card`; farklı bir konteyner rengi gerekiyorsa
   * `className` ile ez (örn. `className="bg-popover"`).
   */
  sticky?: boolean
}

function TableHeader({ className, sticky, ...props }: TableHeaderProps) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b",
        sticky && "sticky top-0 z-10 bg-card",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

type SortableTableHeadProps = React.ComponentProps<"th"> & {
  /** Bu kolon şu an aktif sıralama kolonu mu (ikon/state ona göre gösterilir). */
  active: boolean
  /** Aktifken hangi yönde (ArrowUp/ArrowDown); pasifken kullanılmaz. */
  direction: "asc" | "desc"
  onClick: () => void
}

/**
 * Findings Follow Up / Audit Plan'da kurulan sortable kolon başlığı deseninin
 * paylaşılan hali — her sayfada aynı buton/ikon JSX'i tekrar yazmak yerine
 * bunu kullanın. Sıralama state/karşılaştırma mantığı için
 * `hooks/use-sortable-table.ts`'teki `useSortableTable` + `sortRowsBy`.
 */
function SortableTableHead({
  active,
  direction,
  onClick,
  className,
  children,
  ...props
}: SortableTableHeadProps) {
  return (
    <TableHead className={className} {...props}>
      <button
        type="button"
        onClick={onClick}
        className="hover:text-foreground inline-flex items-center gap-1"
        title="Sırala"
      >
        {children}
        {active ? (
          direction === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-50" />
        )}
      </button>
    </TableHead>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  SortableTableHead,
  TableRow,
  TableCell,
  TableCaption,
}
