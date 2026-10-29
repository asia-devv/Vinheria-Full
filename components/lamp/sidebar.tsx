"use client"

import { Activity, Lightbulb, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { GlassCard } from "./glass"
import { ServerConfig } from "./server-config"

export type View = "overview" | "luminosity" | "devices"

export const NAV_ITEMS: { id: View; label: string; description: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Monitoramento", description: "Estado em tempo real", icon: Activity },
  { id: "luminosity", label: "Luminosidade", description: "Dashboards e histórico", icon: Sun },
  { id: "devices", label: "Dispositivos", description: "Cadastrar e remover", icon: Lightbulb },
]

export function Sidebar({ view, onViewChange }: { view: View; onViewChange: (v: View) => void }) {
  return (
    <GlassCard className="flex flex-col gap-6 p-5 lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)] lg:w-72 lg:shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative flex size-11 items-center justify-center rounded-2xl bg-lamp/15 ring-1 ring-lamp/40">
          <span className="animate-lamp-breathe absolute inset-0 rounded-2xl bg-lamp/30 blur-md" aria-hidden="true" />
          <Lightbulb className="relative size-5 text-lamp" aria-hidden="true" />
        </div>
        <div>
          <p className="text-lg font-bold leading-tight text-white">Smart Lamp</p>
          <p className="text-xs text-white/55">ESP32 · MQTT · FIWARE</p>
        </div>
      </div>

      <nav aria-label="Navegação principal">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Painel</p>
        <ul className="flex gap-2 overflow-x-auto lg:flex-col">
          {NAV_ITEMS.map((item) => {
            const active = item.id === view
            return (
              <li key={item.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => onViewChange(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left outline-none transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-lamp/70",
                    active
                      ? "border-white/25 bg-white/15 text-white shadow-[0_10px_30px_-15px_rgb(0_0_0/0.8)]"
                      : "border-transparent text-white/70 hover:translate-x-0.5 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl transition-all duration-500",
                      active ? "bg-lamp text-neutral-950" : "bg-white/8 text-white/70 group-hover:text-lamp",
                    )}
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="hidden text-xs text-white/50 lg:block">{item.description}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-auto space-y-4">
        <ServerConfig />
        <div className="flex flex-wrap gap-1.5" aria-label="Integrações">
          {["Orion :1026", "IoT Agent :4041", "STH :8666", "Postman", "Wokwi"].map((tag) => (
            <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/55">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}
