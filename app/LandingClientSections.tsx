"use client"

import { useState, useRef, useEffect, useCallback, DragEvent } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileJson, X, ChevronRight, ChevronDown, Clock, Trash2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import type { ValuationConfig } from "@/types/valuation"

// ── localStorage key helpers ──────────────────────────────────────────────────

const STORAGE_PREFIX = "msf_config_"
const PROFILES_INDEX  = "msf_profiles"

interface SavedProfile {
  ticker: string
  name: string
  savedAt: string   // ISO string
}

function saveConfig(config: ValuationConfig) {
  localStorage.setItem(`${STORAGE_PREFIX}${config.ticker}`, JSON.stringify(config))
  const existing: SavedProfile[] = JSON.parse(localStorage.getItem(PROFILES_INDEX) ?? "[]")
  const filtered = existing.filter((p) => p.ticker !== config.ticker)
  const updated: SavedProfile[] = [
    { ticker: config.ticker, name: config.name, savedAt: new Date().toISOString() },
    ...filtered,
  ]
  localStorage.setItem(PROFILES_INDEX, JSON.stringify(updated))
}

function loadProfiles(): SavedProfile[] {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_INDEX) ?? "[]")
  } catch { return [] }
}

function removeProfile(ticker: string) {
  localStorage.removeItem(`${STORAGE_PREFIX}${ticker}`)
  const existing = loadProfiles().filter((p) => p.ticker !== ticker)
  localStorage.setItem(PROFILES_INDEX, JSON.stringify(existing))
}

// ── Upload section ────────────────────────────────────────────────────────────

export function UploadConfigSection() {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [open,      setOpen]      = useState(false)
  const [fileName,  setFileName]  = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".json")) {
      setError("Only .json files are supported.")
      return
    }
    if (file.size > 200 * 1024 * 1024) {
      setError("File exceeds 200 MB limit.")
      return
    }

    setError(null)
    setFileName(file.name)
    setLoading(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string)
        const config: ValuationConfig = raw.config ?? raw
        if (!config.ticker) throw new Error("JSON must contain a 'ticker' field.")
        saveConfig(config)
        router.push(`/${config.ticker.toUpperCase()}`)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Invalid JSON structure.")
        setLoading(false)
      }
    }
    reader.onerror = () => { setError("Failed to read file."); setLoading(false) }
    reader.readAsText(file)
  }, [router])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="w-full max-w-md">
      {/* Dropdown trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
          open
            ? "border-border bg-card text-foreground"
            : "border-border bg-card/40 text-muted-foreground hover:bg-card hover:text-foreground",
        )}
      >
        <div className="flex items-center gap-2">
          <Upload className="w-3.5 h-3.5" />
          Upload Custom Company JSON Config
        </div>
        <ChevronDown
          className={cn("w-4 h-4 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border border-t-0 border-border rounded-b-lg bg-card/40 px-4 py-4 space-y-3">
              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upload a JSON file with full company financial data. This is useful for detailed
                configurations with custom comps, segments, and acquisition data.
              </p>

              {/* Upload button + filename */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={loading}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-muted/50 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Company JSON
                </button>
                <span className="text-xs text-muted-foreground truncate">
                  {fileName ?? "No file chosen"}
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={onFileChange}
                />
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "w-full rounded-lg border-2 border-dashed px-6 py-8 cursor-pointer",
                  "flex flex-col items-center justify-center gap-2 text-center",
                  "transition-colors duration-150",
                  isDragging
                    ? "border-blue-500 bg-blue-500/5"
                    : "border-border hover:border-border/80 hover:bg-card/60",
                )}
              >
                <FileJson className={cn("w-7 h-7", isDragging ? "text-blue-400" : "text-muted-foreground/50")} />
                <p className="text-xs text-muted-foreground">
                  {loading ? "Loading…" : "Drag and drop file here"}
                </p>
                <p className="text-[10px] text-muted-foreground/50">
                  Limit 200MB per file • JSON
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
                  <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Saved profiles section ────────────────────────────────────────────────────

export function SavedProfilesSection() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<SavedProfile[]>([])

  useEffect(() => {
    setProfiles(loadProfiles())
  }, [])

  const handleDelete = (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeProfile(ticker)
    setProfiles(loadProfiles())
  }

  if (profiles.length === 0) return null

  return (
    <div className="w-full max-w-md space-y-2">
      <p className="text-sm font-semibold text-foreground text-left">Saved Company Profiles</p>
      <div className="space-y-1.5">
        {profiles.map((p) => {
          const date = new Date(p.savedAt)
          const label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
          return (
            <div
              key={p.ticker}
              onClick={() => router.push(`/${p.ticker}`)}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card/40 hover:bg-card hover:border-border/80 cursor-pointer transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">{p.ticker}</span>
                  <span className="text-xs text-muted-foreground truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground/50">{label}</span>
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(p.ticker, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/50 hover:text-red-400 transition-all"
                aria-label={`Remove ${p.ticker}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
