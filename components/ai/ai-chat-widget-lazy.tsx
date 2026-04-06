"use client"

import dynamic from "next/dynamic"

const AiChatWidget = dynamic(() => import("./AiChatWidget"), {
  ssr: false,
  loading: () => null,
})

export function AiChatWidgetLazy() {
  return <AiChatWidget />
}
