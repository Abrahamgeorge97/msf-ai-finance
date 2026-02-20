"use client"

import { useState, useCallback } from "react"

interface UseAssumptionsDrawer {
  open: boolean
  onOpen: () => void
  onClose: () => void
  toggle: () => void
  setOpen: (open: boolean) => void
}

export function useAssumptionsDrawer(): UseAssumptionsDrawer {
  const [open, setOpen] = useState(false)
  const onOpen  = useCallback(() => setOpen(true),  [])
  const onClose = useCallback(() => setOpen(false), [])
  const toggle  = useCallback(() => setOpen((o) => !o), [])
  return { open, onOpen, onClose, toggle, setOpen }
}
