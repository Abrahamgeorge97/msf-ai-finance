"use client"

import { useRouter } from "next/navigation"

export default function TickerSubmit() {
  const router = useRouter()
  return (
    <button
      type="submit"
      onClick={(e) => {
        e.preventDefault()
        const form = (e.target as HTMLElement).closest("form") as HTMLFormElement
        const ticker = (form.elements.namedItem("ticker") as HTMLInputElement)?.value?.trim().toUpperCase()
        if (ticker) router.push(`/${ticker}`)
      }}
      className="px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
    >
      Analyze →
    </button>
  )
}
