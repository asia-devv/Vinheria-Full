"use client"

import { AlertTriangle, Info, Lightbulb, Plus, Power, PowerOff, Sun, Thermometer, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFiware, type ActivityItem } from "./fiware-provider"
import { GlassCard } from "./glass"
import { LampCard } from "./lamp-card"
import { average, formatNumber, formatTime } from "./format"
import { DataGate } from "./state-panels"

const ACTIVITY_ICON: Record<ActivityItem["kind"], { icon: typeof Info; className: string }> = {
  on: { icon: Power, className: "bg-lamp-on/15 text-lamp-on" },
  off: { icon: PowerOff, className: "bg-lamp-off/15 text-lamp-off" },
  create: { icon: Plus, className: "bg-lamp/15 text-lamp" },
  delete: { icon: Trash2, className: "bg-lamp-off/15 text-lamp-off" },
  error: { icon: AlertTriangle, className: "bg-lamp-off/15 text-lamp-off" },
  info: { icon: Info, className: "bg-white/10 text-white/70" },
}

export function OverviewView({
  onOpenChart,
  onAddDevice,
}: {
  onOpenChart: (id: string) => void
  onAddDevice: () => void
}) {
  const { lamps, activity } = useFiware()
  const onCount = lamps.filter((l) => l.state === "on").length

  const stats = [
    { label: "Dispositivos", value: String(lamps.length), hint: "registrados no FIWARE", icon: Lightbulb, tone: "text-lamp" },
    { label: "Ligados agora", value: `${onCount}/${lamps.length}`, hint: "estado reportado", icon: Power, tone: "text-lamp-on" },
    {
      label: "Luminosidade média",
      value: formatNumber(average(lamps.map((l) => l.luminosity))),
      hint: "% · todos os dispositivos",
      icon: Sun,
      tone: "text-lamp",
    },
    {
      label: "Temperatura média",
      value: `${formatNumber(average(lamps.map((l) => l.temperature)), 1)} °C`,
      hint: "sensores DHT",
      icon: Thermometer,
      tone: "text-lamp-off",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat, i) => (
          <GlassCard
            key={stat.label}
            delay={i * 70}
            className="p-5 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-white/12"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-white/60">{stat.label}</p>
              <stat.icon className={cn("size-5", stat.tone)} aria-hidden="true" />
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">{stat.value}</p>
            <p className="mt-1 text-xs text-white/45">{stat.hint}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1fr_20rem]">
        <section aria-labelledby="lamps-heading" className="space-y-4">
          <h2 id="lamps-heading" className="sr-only">
            Dispositivos
          </h2>
          <DataGate onAddDevice={onAddDevice}>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2 min-[1800px]:grid-cols-3">
              {lamps.map((lamp, i) => (
                <LampCard key={lamp.entityName} lamp={lamp} delay={120 + i * 80} onOpenChart={() => onOpenChart(lamp.id)} />
              ))}
            </div>
          </DataGate>
        </section>

        <GlassCard delay={200} className="h-fit p-5">
          <h2 className="text-base font-semibold text-white">Atividade da sessão</h2>
          <p className="text-xs text-white/50">Comandos e alterações feitas neste painel</p>
          {activity.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-white/15 p-4 text-center text-sm text-white/50">
              Nenhuma ação ainda. Ligue um dispositivo para começar.
            </p>
          ) : (
            <ol className="mt-4 space-y-2" aria-live="polite">
              {activity.map((item) => {
                const { icon: Icon, className } = ACTIVITY_ICON[item.kind]
                return (
                  <li key={item.id} className="animate-rise flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-white/5">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", className)}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white">{item.message}</span>
                      <time className="text-xs text-white/45" dateTime={item.at.toISOString()}>
                        {formatTime(item.at)}
                      </time>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
