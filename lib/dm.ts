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
  conversation: { lowerUserId: number; higherUserId: number },
  me: number
): number {
  return conversation.lowerUserId === me
    ? conversation.higherUserId
    : conversation.lowerUserId
}
