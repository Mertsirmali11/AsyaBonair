"use client"

import * as React from "react"

const DEFAULT_TITLE = "Documents"

type Ctx = {
  title: string
  setTitle: (t: string) => void
  titleAccessory: React.ReactNode | null
  setTitleAccessory: (n: React.ReactNode | null) => void
}

const WorkspacePageTitleContext = React.createContext<Ctx | null>(null)

export function WorkspacePageTitleProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [title, setTitle] = React.useState(DEFAULT_TITLE)
  const [titleAccessory, setTitleAccessory] =
    React.useState<React.ReactNode | null>(null)
  const value = React.useMemo(
    () => ({ title, setTitle, titleAccessory, setTitleAccessory }),
    [title, titleAccessory]
  )
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

export function useWorkspaceTitleAccessory(): React.ReactNode | null {
  const ctx = React.useContext(WorkspacePageTitleContext)
  if (!ctx) return null
  return ctx.titleAccessory
}

export function SetWorkspacePageTitle({ title }: { title: string }) {
  const ctx = React.useContext(WorkspacePageTitleContext)
  React.useLayoutEffect(() => {
    if (!ctx) return
    ctx.setTitle(title)
  }, [ctx, title])
  return null
}

/** Üst başlık satırında (ör. «Manuals» yanında) ek düğüm — sayfa unmount olunca temizlenir */
export function SetWorkspacePageTitleAccessory({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = React.useContext(WorkspacePageTitleContext)
  React.useLayoutEffect(() => {
    if (!ctx) return
    ctx.setTitleAccessory(children)
    return () => ctx.setTitleAccessory(null)
  }, [ctx, children])
  return null
}
