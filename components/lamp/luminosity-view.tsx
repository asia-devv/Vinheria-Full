"use client"

import { useState } from "react"
import useSWR from "swr"
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { AlertTriangle, Droplets, Sparkles, Sun, Thermometer } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Switch } from "@/components/ui/switch"
import { ensureHistorySubscription, fetchHistory, type HistoryPoint } from "@/lib/fiware"
import { cn } from "@/lib/utils"
import { useFiware } from "./fiware-provider"
import { GlassCard, LiveDot } from "./glass"
import { average, formatNumber, formatTime, luminosityPercent, luminosityScale } from "./format"
import { DataGate } from "./state-panels"

const chartConfig = {
  luminosity: { label: "Luminosidade", color: "var(--lamp)" },
  temperature: { label: "Temperatura", color: "var(--lamp-off)" },
  humidity: { label: "Umidade", color: "oklch(0.8 0.11 230)" },
} satisfies ChartConfig

type History = Record<keyof typeof chartConfig, HistoryPoint[]>

export function LuminosityView({
  selectedId,
  onSelect,
  onAddDevice,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  onAddDevice: () => void
}) {
  const { lamps } = useFiware()
  const lamp = lamps.find((l) => l.id === selectedId) ?? lamps[0]

  return (
    <DataGate onAddDevice={onAddDevice}>
      {lamp ? (
        <div className="space-y-6">
          <div className="animate-rise flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Selecionar lâmpada">
            {lamps.map((l) => {
              const active = l.id === lamp.id
              return (
                <button
                  key={l.entityName}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => onSelect(l.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium outline-none transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-lamp/70",
                    active
                      ? "border-lamp/60 bg-lamp text-neutral-950 shadow-[0_8px_30px_-10px_var(--lamp)]"
                      : "glass text-white/75 hover:-translate-y-0.5 hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      l.state === "on" ? "bg-lamp-on" : l.state === "off" ? "bg-lamp-off" : "bg-white/40",
                      active && l.state === "unknown" && "bg-neutral-950/40",
                    )}
                    aria-hidden="true"
                  />
                  Lâmpada {l.id}
                </button>
              )
            })}
          </div>
          <LampHistory key={lamp.id} lampId={lamp.id} />
        </div>
      ) : null}
    </DataGate>
  )
}

function LampHistory({ lampId }: { lampId: string }) {
  const { server, lamps } = useFiware()
  const lamp = lamps.find((l) => l.id === lampId)
  const [live, setLive] = useState(true)

  const subscription = useSWR(["history-sub", server, lampId], ([, s, id]) => ensureHistorySubscription(s, id), {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  })

  const history = useSWR<History>(
    subscription.data !== undefined || subscription.error ? ["history", server, lampId] : null,
    async ([, s, id]: [string, string, string]) => {
      const [luminosity, temperature, humidity] = await Promise.all([
        fetchHistory(s, id, "luminosity"),
        fetchHistory(s, id, "temperature"),
        fetchHistory(s, id, "humidity"),
      ])
      return { luminosity, temperature, humidity }
    },
    { refreshInterval: live ? 10000 : 0, keepPreviousData: true },
  )

  const data = history.data
  const lumValues = data?.luminosity.map((p) => p.value) ?? []
  const scale = luminosityScale([...lumValues, lamp?.luminosity ?? null])
  const current = lamp?.luminosity ?? lumValues.at(-1) ?? null
  const percent = luminosityPercent(current, scale)
  const loading = !data && !history.error

  const merged = mergeSeries(data)

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <GlassCard delay={60} className="relative overflow-hidden p-6">
          <div
            className="pointer-events-none absolute -top-20 left-1/2 size-72 -translate-x-1/2 rounded-full bg-lamp/30 blur-3xl transition-opacity duration-1000"
            style={{ opacity: 0.25 + percent / 140 }}
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between">
            <p className="text-sm font-medium text-white/70">Leitura atual</p>
            <span className="flex items-center gap-2 text-xs text-white/60">
              <LiveDot active={live} />
              {live ? "Ao vivo" : "Pausado"}
            </span>
          </div>

          <div className="relative mx-auto mt-6 size-52">
            <div
              className="absolute inset-0 rounded-full transition-[background] duration-1000"
              style={{
                background: `conic-gradient(var(--lamp) ${percent * 3.6}deg, rgb(255 255 255 / 0.08) 0deg)`,
                mask: "radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 13px))",
                WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 13px))",
              }}
              role="meter"
              aria-label="Luminosidade atual"
              aria-valuemin={0}
              aria-valuemax={scale}
              aria-valuenow={current ?? 0}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Sun className="size-6 text-lamp" aria-hidden="true" />
              <p className="mt-1 text-5xl font-bold tabular-nums text-white">{formatNumber(current)}</p>
              <p className="text-sm text-white/50">lx · {Math.round(percent)}%</p>
            </div>
          </div>

          <dl className="relative mt-6 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Mín.", value: lumValues.length ? Math.min(...lumValues) : null },
              { label: "Média", value: average(lumValues) },
              { label: "Máx.", value: lumValues.length ? Math.max(...lumValues) : null },
            ].map((s) => (
              <div key={s.label} className="glass-soft rounded-2xl py-2">
                <dt className="text-xs text-white/50">{s.label}</dt>
                <dd className="text-base font-semibold tabular-nums text-white">{formatNumber(s.value)}</dd>
              </div>
            ))}
          </dl>

          <label className="relative mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            Atualizar a cada 10s
            <Switch checked={live} onCheckedChange={setLive} className="data-[state=checked]:bg-lamp" />
          </label>
        </GlassCard>

        <GlassCard delay={140} className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Grau de luminosidade</h2>
              <p className="text-sm text-white/55">Últimas {lumValues.length || 30} leituras do STH-Comet</p>
            </div>
            {data?.luminosity.length ? (
              <p className="text-xs text-white/45">
                {formatTime(data.luminosity[0].date)} — {formatTime(data.luminosity.at(-1)!.date)}
              </p>
            ) : null}
          </div>

          {subscription.data === true ? (
            <p className="animate-rise mt-4 flex items-center gap-2 rounded-2xl border border-lamp/30 bg-lamp/10 px-4 py-3 text-sm text-lamp">
              <Sparkles className="size-4 shrink-0" aria-hidden="true" />
              Captura do histórico ativada. As próximas leituras do dispositivo aparecerão aqui.
            </p>
          ) : null}
          {history.error || subscription.error ? (
            <p className="animate-rise mt-4 flex items-start gap-2 rounded-2xl border border-lamp-off/30 bg-lamp-off/10 px-4 py-3 text-sm text-lamp-off">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {(history.error ?? subscription.error).message}
            </p>
          ) : null}

          <div className="mt-6">
            {loading ? (
              <div className="h-72 animate-pulse rounded-2xl bg-white/5" aria-label="Carregando histórico" />
            ) : merged.length === 0 ? (
              <EmptyChart />
            ) : (
              <ChartContainer config={chartConfig} className="h-72 w-full">
                <AreaChart data={merged} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fill-lum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-luminosity)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="var(--color-luminosity)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgb(255 255 255 / 0.08)" />
                  <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tick={{ fill: "rgb(255 255 255 / 0.5)", fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: "rgb(255 255 255 / 0.5)", fontSize: 11 }} />
                  <ChartTooltip cursor={{ stroke: "rgb(255 255 255 / 0.2)" }} content={<ChartTooltipContent indicator="line" />} />
                  <Area
                    dataKey="luminosity"
                    type="monotone"
                    stroke="var(--color-luminosity)"
                    strokeWidth={2.5}
                    fill="url(#fill-lum)"
                    connectNulls
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {(
          [
            { key: "temperature", title: "Temperatura", unit: "°C", icon: Thermometer, iconClass: "text-lamp-off" },
            { key: "humidity", title: "Umidade", unit: "%", icon: Droplets, iconClass: "text-sky-300" },
          ] as const
        ).map((series, i) => {
          const points = data?.[series.key] ?? []
          return (
            <GlassCard key={series.key} delay={220 + i * 80} className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <series.icon className={cn("size-4", series.iconClass)} aria-hidden="true" />
                  {series.title}
                </h3>
                <p className="text-2xl font-bold tabular-nums text-white">
                  {formatNumber(lamp?.[series.key] ?? points.at(-1)?.value ?? null, 1)}
                  <span className="ml-1 text-sm font-medium text-white/50">{series.unit}</span>
                </p>
              </div>
              <div className="mt-4">
                {loading ? (
                  <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
                ) : points.length === 0 ? (
                  <p className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/15 text-sm text-white/45">
                    Sem leituras de {series.title.toLowerCase()}
                  </p>
                ) : (
                  <ChartContainer config={chartConfig} className="h-40 w-full">
                    <LineChart data={merged} margin={{ left: 0, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} stroke="rgb(255 255 255 / 0.06)" />
                      <XAxis dataKey="time" hide />
                      <YAxis tickLine={false} axisLine={false} width={36} domain={["auto", "auto"]} tick={{ fill: "rgb(255 255 255 / 0.45)", fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                      <Line
                        dataKey={series.key}
                        type="monotone"
                        stroke={`var(--color-${series.key})`}
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls
                        animationDuration={900}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </div>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-center">
      <Sun className="size-6 text-white/40" aria-hidden="true" />
      <p className="text-sm text-white/60">Nenhuma leitura no histórico ainda</p>
      <p className="max-w-xs text-xs text-white/40">
        Publique valores pelo ESP32/Wokwi ou atualize o atributo via Postman para popular o gráfico.
      </p>
    </div>
  )
}

function mergeSeries(history?: History) {
  if (!history) return []
  const rows = new Map<string, { time: string; ts: number } & Partial<Record<keyof History, number>>>()
  for (const key of Object.keys(history) as (keyof History)[]) {
    for (const point of history[key]) {
      // Readings from one MQTT payload arrive within the same second
      const ts = Math.floor(new Date(point.date).getTime() / 1000) * 1000
      const row = rows.get(String(ts)) ?? { time: formatTime(new Date(ts)), ts }
      row[key] = point.value
      rows.set(String(ts), row)
    }
  }
  return [...rows.values()].sort((a, b) => a.ts - b.ts)
}
