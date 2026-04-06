"use client"

import * as React from "react"

const DEFAULT_TITLE = "Documents"

type Ctx = {
  title: string
  setTitle: (t: string) => void
}

const WorkspacePageTitleContext = React.createContext<Ctx | null>(null)

export function WorkspacePageTitleProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [title, setTitle] = React.useState(DEFAULT_TITLE)
  const value = React.useMemo(() => ({ title, setTitle }), [title])
  return (
    <WorkspacePageTitleContext.Provider value={value}>
      {children}
    </WorkspacePageTitleContext.Provider>
  )
}

export function useWorkspacePageTitle(): string {
  const ctx = React.useContext(WorkspacePageTitleContext)
  if (!ctx) return DEFAULT_TITLE
  return ctx.title
}

export function SetWorkspacePageTitle({ title }: { title: string }) {
  const ctx = React.useContext(WorkspacePageTitleContext)
  React.useLayoutEffect(() => {
    if (!ctx) return
    ctx.setTitle(title)
  }, [ctx, title])
  return null
}
