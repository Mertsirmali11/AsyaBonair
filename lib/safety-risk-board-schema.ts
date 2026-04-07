import { z } from "zod"

import { SAFETY_RISK_BOARD_KEY_MAX } from "@/lib/safety-risk-board-key"

const barrierJsonSchema = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    text: z.string(),
    recordedAt: z.string().optional(),
  }),
])

export const boardRowSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  reference: z.string(),
  barriers: z.array(barrierJsonSchema),
  fallbackNote: z.string(),
})

export const openMapSchema = z.record(z.string(), z.boolean())

export const riskBoardStateBodySchema = z.object({
  riskKey: z.string().min(1).max(SAFETY_RISK_BOARD_KEY_MAX),
  riskTitle: z.string().min(1),
  probability: z.union([z.number().int().min(1).max(5), z.null()]),
  severity: z
    .union([z.string().length(1).regex(/^[EDCBA]$/i), z.null()])
    .transform((s) => (s === null ? null : s.toUpperCase())),
  threats: z.array(boardRowSchema),
  consequences: z.array(boardRowSchema),
  threatOpenById: openMapSchema,
  consequenceOpenById: openMapSchema,
})
