"use client"

import { useEffect, useRef, useState } from "react"
import type { Lamp } from "@/lib/fiware"
import { GlassInput } from "./glass"

type Metric = "luminosity" | "temperature" | "humidity"
type Limits = Partial<Record<Metric, { min?: number; max?: number }>>
type Config = { token: string; chatId: string; limits: Record<string, Limits> }
const KEY = "lamp-alert-config"
const metrics: { key: Metric; label: string; unit: string }[] = [
  { key: "luminosity", label: "Luminosidade", unit: "%" },
  { key: "temperature", label: "Temperatura", unit: "°C" },
  { key: "humidity", label: "Umidade", unit: "%" },
]

function readConfig(): Config {
  try {
    return { token: "", chatId: "", limits: {}, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }
  } catch { return { token: "", chatId: "", limits: {} } }
}

export function AlertSettings({ lampId }: { lampId: string }) {
  const [config, setConfig] = useState<Config>({ token: "", chatId: "", limits: {} })
  useEffect(() => setConfig(readConfig()), [])

  const updateLimit = (lampId: string, metric: Metric, side: "min" | "max", value: string) => {
    const parsed = value === "" ? undefined : Number(value)
    setConfig(() => {
      const current = readConfig()
      const next = { ...current, limits: { ...current.limits, [lampId]: { ...current.limits[lampId], [metric]: { ...current.limits[lampId]?.[metric], [side]: parsed } } } }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  return <details className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
    <summary className="cursor-pointer text-xs font-medium text-white/70">Limites e alertas do Telegram</summary>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {metrics.map(({ key, label, unit }) => <div key={key} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
        <span className="text-xs text-white/60">{label} ({unit})</span>
        <GlassInput type="number" step="any" aria-label={`${label}: mínimo`} placeholder="Mínimo" value={config.limits[lampId]?.[key]?.min ?? ""} onChange={(e) => updateLimit(lampId, key, "min", e.target.value)} />
        <GlassInput type="number" step="any" aria-label={`${label}: máximo`} placeholder="Máximo" value={config.limits[lampId]?.[key]?.max ?? ""} onChange={(e) => updateLimit(lampId, key, "max", e.target.value)} />
      </div>)}
    </div>
  </details>
}

export function AlertMonitor({ lamps }: { lamps: Lamp[] }) {
  const outside = useRef(new Set<string>())
  const busy = useRef(new Set<string>())
  useEffect(() => {
    const check = () => {
    const config = readConfig()
    if (!config.token || !config.chatId) return
    for (const lamp of lamps) for (const { key, label, unit } of metrics) {
      const value = lamp[key]
      const limit = config.limits[lamp.id]?.[key]
      if (value === null || (!limit?.min && limit?.min !== 0 && !limit?.max && limit?.max !== 0)) continue
      const breached = (limit?.min !== undefined && value < limit.min) || (limit?.max !== undefined && value > limit.max)
      const id = `${lamp.id}:${key}`
      if (!breached) { outside.current.delete(id); continue }
      if (outside.current.has(id) || busy.current.has(id)) continue
      outside.current.add(id)
      busy.current.add(id)
      const bound = limit?.min !== undefined && value < limit.min ? `Abaixo do mínimo (${limit.min}${unit})` : `Acima do máximo (${limit?.max}${unit})`
      void fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: config.token, chatId: config.chatId, text: `⚠️ Alerta! ⚠️ \nDispositivo: ${lamp.deviceId ?? ` lamp${lamp.id}`}\n${label}: ${value}${unit}\n${bound}.` }) })
        .catch(() => undefined).finally(() => busy.current.delete(id))
    }
    }
    check()
    const timer = window.setInterval(check, 5000)
    return () => window.clearInterval(timer)
  }, [lamps])
  return null
}

export function TelegramConfig() {
  const [config, setConfig] = useState<Config>({ token: "", chatId: "", limits: {} })
  useEffect(() => setConfig(readConfig()), [])
  const change = (patch: Partial<Config>) => setConfig(() => {
    const next = { ...readConfig(), ...patch }
    localStorage.setItem(KEY, JSON.stringify(next))
    return next
  })
  return <div className="mt-4 space-y-2">
    <p className="text-xs text-white/55">Configure o bot uma vez para receber os alertas:</p>
    <GlassInput type="password" autoComplete="off" placeholder="Token do bot Telegram" aria-label="Token do bot Telegram" value={config.token} onChange={(e) => change({ token: e.target.value })} />
    <GlassInput autoComplete="off" placeholder="Chat ID" aria-label="Chat ID do Telegram" value={config.chatId} onChange={(e) => change({ chatId: e.target.value })} />
  </div>
}
