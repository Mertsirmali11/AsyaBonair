import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { findCalisanlarWithBirthdayOnCalendarDay } from "@/lib/birthdays-db"
import { APP_TIMEZONE, getCalendarYmdInTimeZone } from "@/lib/day-range"

export async function GET() {
  const { month, day } = getCalendarYmdInTimeZone(APP_TIMEZONE)
  const birthdays = await findCalisanlarWithBirthdayOnCalendarDay(prisma, month, day)
  return NextResponse.json(birthdays)
}
