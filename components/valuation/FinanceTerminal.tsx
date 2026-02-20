"use client"

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import type { ValuationConfig, Assumptions } from "@/types/valuation"

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: number
  type: "input" | "output" | "error" | "system"
  content: string
}

interface Props {
  config: ValuationConfig
  assumptions: Assumptions
  className?: string
}

// ── Blinking cursor ───────────────────────────────────────────────────────────

function BlinkingCursor() {
  return (
    <span
      className="inline-block w-2 h-4 bg-emerald-400 ml-px align-middle"
      style={{ animation: "terminal-blink 1.1s step-end infinite" }}
    />
  )
}

// ── Prompt glyph ──────────────────────────────────────────────────────────────

function Prompt({ ticker }: { ticker: string }) {
  return (
    <span className="select-none shrink-0">
      <span className="text-emerald-400">{ticker.toLowerCase()}</span>
      <span className="text-muted-foreground/60">@fin</span>
      <span className="text-zinc-500">:</span>
      <span className="text-blue-400">~</span>
      <span className="text-zinc-500">$ </span>
    </span>
  )
}

// ── Suggestions ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "explain the DCF terminal value",
  "why is the signal BUY?",
  "compare WACC sensitivity",
  "what drives the EBITDA multiple?",
  "summarize key valuation risks",
]

// ── Main ──────────────────────────────────────────────────────────────────────

let _id = 0
const uid = () => ++_id

export function FinanceTerminal({ config, assumptions, className }: Props) {
  const ticker = config.ticker

  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      id: uid(),
      type: "system",
      content: [
        `FinanceTerminal v1.0  —  ${config.name} (${ticker})`,
        `Fiscal year: ${config.fiscal_year}  |  Currency: ${config.currency}`,
        `Type a question and press Enter. Type 'clear' to reset.`,
        `─`.repeat(52),
      ].join("\n"),
    },
  ])

  const [input, setInput]           = useState("")
  const [loading, setLoading]       = useState(false)
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [cmdIndex, setCmdIndex]     = useState(-1)
  const [focused, setFocused]       = useState(false)

  const inputRef  = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [history, loading])

  // Focus input on mount and on container click
  const focusInput = () => inputRef.current?.focus()
  useEffect(() => { focusInput() }, [])

  const push = (entry: Omit<HistoryEntry, "id">) =>
    setHistory((h) => [...h, { id: uid(), ...entry }])

  const submit = useCallback(async () => {
    const cmd = input.trim()
    if (!cmd || loading) return

    setInput("")
    setCmdHistory((h) => [cmd, ...h])
    setCmdIndex(-1)

    // Echo input
    push({ type: "input", content: cmd })

    // Built-in commands
    if (cmd.toLowerCase() === "clear") {
      setHistory([])
      return
    }
    if (cmd.toLowerCase() === "help") {
      push({
        type: "system",
        content: [
          "Available commands:",
          "  clear     — clear terminal",
          "  help      — show this message",
          "  <query>   — ask the AI about this company",
        ].join("\n"),
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: cmd }],
          config,
          assumptions,
        }),
      })

      if (!res.body) throw new Error("No response body")

      // Create a streaming output entry and update it token-by-token
      const streamId = uid()
      setHistory((h) => [...h, { id: streamId, type: "output", content: "" }])

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ""

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setHistory((h) =>
          h.map((e) => (e.id === streamId ? { ...e, content: acc } : e)),
        )
      }
      if (!acc) {
        setHistory((h) =>
          h.map((e) => (e.id === streamId ? { ...e, content: "(no response)" } : e)),
        )
      }
    } catch {
      push({ type: "error", content: "Error: could not reach API. Check your OPENAI_API_KEY." })
    } finally {
      setLoading(false)
    }
  }, [input, loading, config, assumptions])

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      submit()
      return
    }
    // Command history navigation
    if (e.key === "ArrowUp") {
      e.preventDefault()
      const next = Math.min(cmdIndex + 1, cmdHistory.length - 1)
      setCmdIndex(next)
      setInput(cmdHistory[next] ?? "")
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = Math.max(cmdIndex - 1, -1)
      setCmdIndex(next)
      setInput(next === -1 ? "" : cmdHistory[next] ?? "")
    }
  }

  return (
    <>
      {/* Inject blink keyframe once */}
      <style>{`
        @keyframes terminal-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      <div
        className={cn(
          "flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden font-mono text-sm",
          className,
        )}
        onClick={focusInput}
      >
        {/* Title bar */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 select-none">
          <span className="w-3 h-3 rounded-full bg-red-500/80" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="flex-1 text-center text-xs text-zinc-500 tracking-wide">
            finance-terminal — {ticker}
          </span>
        </div>

        {/* Scrollable history */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700">
          {history.map((entry) => (
            <div key={entry.id}>
              {entry.type === "input" ? (
                <div className="flex gap-0">
                  <Prompt ticker={ticker} />
                  <span className="text-zinc-100 whitespace-pre-wrap break-all">{entry.content}</span>
                </div>
              ) : entry.type === "system" ? (
                <pre className="text-zinc-500 text-xs whitespace-pre-wrap leading-relaxed">
                  {entry.content}
                </pre>
              ) : entry.type === "error" ? (
                <pre className="text-red-400 text-xs whitespace-pre-wrap leading-relaxed pl-2 border-l border-red-500/40">
                  {entry.content}
                </pre>
              ) : (
                /* output */
                <pre className="text-emerald-300 text-xs whitespace-pre-wrap leading-relaxed pl-2 border-l border-emerald-500/20">
                  {entry.content}
                </pre>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-0">
              <Prompt ticker={ticker} />
              <span className="text-zinc-500 italic text-xs">thinking</span>
              <span className="text-zinc-500 ml-0.5" style={{ animation: "terminal-blink 1s step-end infinite" }}>_</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestions (only when history is empty-ish) */}
        {history.length <= 1 && !loading && (
          <div className="shrink-0 px-4 pb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); focusInput() }}
                className="text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:border-emerald-600 hover:text-emerald-300 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="shrink-0 flex items-center gap-0 px-4 py-3 border-t border-zinc-800 bg-zinc-900/60">
          <Prompt ticker={ticker} />
          <div className="relative flex-1 flex items-center">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={loading}
              spellCheck={false}
              autoComplete="off"
              className={cn(
                "w-full bg-transparent text-zinc-100 caret-transparent outline-none",
                "placeholder:text-zinc-700 disabled:opacity-40",
              )}
              placeholder="ask a question..."
            />
            {/* Custom blinking cursor after text */}
            {focused && <BlinkingCursor />}
          </div>
        </div>
      </div>
    </>
  )
}
