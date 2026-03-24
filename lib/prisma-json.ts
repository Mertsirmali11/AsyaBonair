/**
 * Prisma `BigInt` alanları JSON.stringify ile uyumsuz; API yanıtlarında sayıya çevirir.
 */
export function prismaJson<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? Number(value) : value
    )
  ) as T
}
