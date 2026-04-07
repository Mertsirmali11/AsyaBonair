import { z } from "zod"

/** Risk Board tablosunda gösterilen satır (seed ile aynı şekil). */
export const riskBoardCatalogEntrySchema = z.object({
  id: z.string().min(1).max(80),
  riskNo: z.string().max(120),
  date: z.string().max(40),
  title: z.string().min(1).max(2000),
  titleDot: z.enum(["amber", "red", "green"]).nullable().optional(),
  initial: z.string().max(500),
  final: z.string().max(500),
  field: z.string().max(500),
  threads: z.string().max(4000),
  threadsHighlight: z.boolean().optional(),
  status: z.string().max(200),
  statusTone: z.enum(["awaiting", "mitigation", "monitored"]),
})

export const riskBoardCatalogEntriesSchema = z
  .array(riskBoardCatalogEntrySchema)
  .max(500)

export type RiskBoardCatalogEntry = z.infer<typeof riskBoardCatalogEntrySchema>
