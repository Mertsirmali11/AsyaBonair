import { z } from "zod"

import { SAFETY_RISK_BOARD_KEY_MAX } from "@/lib/safety-risk-board-key"

const barrierJsonSchema = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    text: z.string(),
    recordedAt: z.string().optional(),
    linkedTaskId: z.number().int().nullable().optional(),
    linkedMeetingId: z.number().int().nullable().optional(),
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

export const boardHistoryEntrySchema = z.object({
  id: z.string().min(1).max(120),
  date: z.string().max(80),
  message: z.string().max(4000),
  actor: z.string().max(200).optional(),
})

export const riskBoardStateBodySchema = z.object({
  riskKey: z.string().min(1).max(SAFETY_RISK_BOARD_KEY_MAX),
  riskTitle: z.string().min(1),
  probability: z.union([z.number().int().min(1).max(5), z.null()]),
  severity: z
    .union([z.string().length(1).regex(/^[EDCBA]$/i), z.null()])
    .transform((s) => (s === null ? null : s.toUpperCase())),
  initialProbability: z.union([z.number().int().min(1).max(5), z.null()]),
  initialSeverity: z
    .union([z.string().length(1).regex(/^[EDCBA]$/i), z.null()])
    .transform((s) => (s === null ? null : s.toUpperCase())),
  finalProbability: z.union([z.number().int().min(1).max(5), z.null()]),
  finalSeverity: z
    .union([z.string().length(1).regex(/^[EDCBA]$/i), z.null()])
    .transform((s) => (s === null ? null : s.toUpperCase())),
  threats: z.array(boardRowSchema),
  consequences: z.array(boardRowSchema),
  threatOpenById: openMapSchema,
  consequenceOpenById: openMapSchema,
  /** Gönderilmezse PUT mevcut boardHistory’yi silmez (eski istemciler). */
  history: z.array(boardHistoryEntrySchema).max(2000).optional(),
})
