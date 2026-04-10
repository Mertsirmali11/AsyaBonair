/** İki çalışan için sohbet çiftini tekilleştirmek (lower < higher). */
export function dmParticipantPair(
  calisanIdA: number,
  calisanIdB: number
): { lowerUserId: number; higherUserId: number } {
  if (calisanIdA === calisanIdB) {
    throw new Error("Aynı kullanıcıyla sohbet oluşturulamaz")
  }
  return calisanIdA < calisanIdB
    ? { lowerUserId: calisanIdA, higherUserId: calisanIdB }
    : { lowerUserId: calisanIdB, higherUserId: calisanIdA }
}

export function otherParticipantId(
  conversation: { lowerUserId: number | null; higherUserId: number | null },
  me: number
): number {
  const low = conversation.lowerUserId
  const high = conversation.higherUserId
  if (low == null || high == null) {
    throw new Error("1:1 sohbet için lower/higher gerekli")
  }
  return low === me ? high : low
}

export function isDmMember(
  conv: {
    isGroup: boolean
    lowerUserId: number | null
    higherUserId: number | null
    members: { calisanId: number }[]
  },
  calisanId: number
): boolean {
  if (conv.isGroup) {
    return conv.members.some((m) => m.calisanId === calisanId)
  }
  return conv.lowerUserId === calisanId || conv.higherUserId === calisanId
}
