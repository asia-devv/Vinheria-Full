"use client"

import { useState } from "react"
import { Droplets, LineChart, Lightbulb, Power, PowerOff, Thermometer } from "lucide-react"
import { toast } from "sonner"
import { sendCommand, type Lamp } from "@/lib/fiware"
import { cn } from "@/lib/utils"
import { useFiware } from "./fiware-provider"
import { GlassButton, GlassCard } from "./glass"
import { formatNumber, luminosityPercent } from "./format"

export function LampCard({ lamp, delay, onOpenChart }: { lamp: Lamp; delay?: number; onOpenChart: () => void }) {
  const { server, patchLamp, log } = useFiware()
  const [pending, setPending] = useState<"on" | "off" | null>(null)
  const isOn = lamp.state === "on"
  const percent = luminosityPercent(lamp.luminosity)

  const run = async (command: "on" | "off") => {
    setPending(command)
    try {
      await sendCommand(server, lamp.id, command)
      patchLamp(lamp.id, { state: command })
      log(command, `Lâmpada ${lamp.id} ${command === "on" ? "ligada" : "desligada"}`)
      toast.success(`Comando "${command}" enviado`, { description: `Dispositivo lamp${lamp.id}` })
    } catch (error) {
      const message = (error as Error).message
      log("error", `Falha no comando "${command}" (${lamp.id})`)
      toast.error("Erro ao enviar comando", { description: message })
    } finally {
      setPending(null)
    }
  }

  return (
    <GlassCard
      delay={delay}
      className={cn(
        "group relative overflow-hidden p-5 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:bg-white/12",
        isOn && "border-lamp/40",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-lamp/40 blur-3xl transition-opacity duration-1000",
          isOn ? "opacity-70" : "opacity-0",
        )}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/50">
            {lamp.deviceId ?? `lamp${lamp.id}`}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-white">Lâmpada {lamp.id}</h3>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-700",
            isOn && "bg-lamp-on/15 text-lamp-on",
            lamp.state === "off" && "bg-lamp-off/15 text-lamp-off",
            lamp.state === "unknown" && "bg-white/10 text-white/60",
          )}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {isOn ? "Ligada" : lamp.state === "off" ? "Desligada" : "Sem leitura"}
        </span>
      </div>

      <div className="relative mt-6 flex items-center gap-5">
        <div className="relative flex size-20 shrink-0 items-center justify-center">
          <span
            className={cn(
              "absolute inset-0 rounded-full bg-lamp blur-xl transition-opacity duration-1000",
              isOn ? "animate-lamp-breathe opacity-80" : "opacity-0",
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              "relative flex size-20 items-center justify-center rounded-full border transition-all duration-700",
              isOn ? "border-lamp/60 bg-lamp/25" : "border-white/15 bg-white/5",
            )}
          >
            <Lightbulb
              className={cn("size-9 transition-all duration-700", isOn ? "text-lamp drop-shadow-[0_0_12px_var(--lamp)]" : "text-white/40")}
              aria-hidden="true"
            />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/55">Luminosidade</p>
          <p className="text-3xl font-bold tabular-nums text-white transition-all duration-500">
            {formatNumber(lamp.luminosity)}
            <span className="ml-1 text-sm font-medium text-white/50">%</span>
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
            role="meter"
            aria-label="Nível de luminosidade"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-lamp-strong to-lamp transition-[width] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      <dl className="relative mt-5 grid grid-cols-2 gap-3">
        <div className="glass-soft rounded-2xl p-3">
          <dt className="flex items-center gap-1.5 text-xs text-white/55">
            <Thermometer className="size-3.5 text-lamp-off" aria-hidden="true" />
            Temperatura
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{formatNumber(lamp.temperature, 1)} °C</dd>
        </div>
        <div className="glass-soft rounded-2xl p-3">
          <dt className="flex items-center gap-1.5 text-xs text-white/55">
            <Droplets className="size-3.5 text-sky-300" aria-hidden="true" />
            Umidade
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{formatNumber(lamp.humidity, 1)} %</dd>
        </div>
      </dl>

      <div className="relative mt-5 grid grid-cols-[1fr_1fr_auto] gap-2">
        <GlassButton variant="success" size="sm" loading={pending === "on"} disabled={pending !== null} onClick={() => run("on")}>
          {pending !== "on" && <Power aria-hidden="true" />}
          Ligar
        </GlassButton>
        <GlassButton variant="danger" size="sm" loading={pending === "off"} disabled={pending !== null} onClick={() => run("off")}>
          {pending !== "off" && <PowerOff aria-hidden="true" />}
          Desligar
        </GlassButton>
        <GlassButton variant="glass" size="sm" onClick={onOpenChart} aria-label={`Ver gráfico da lâmpada ${lamp.id}`}>
          <LineChart aria-hidden="true" />
        </GlassButton>
      </div>
    </GlassCard>
  )
}
