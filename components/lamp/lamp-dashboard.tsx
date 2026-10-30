"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { DevicesView } from "./devices-view"
import { FiwareProvider, useFiware } from "./fiware-provider"
import { GlassButton, GlassCard, LiveDot } from "./glass"
import { LuminosityView } from "./luminosity-view"
import { OverviewView } from "./overview-view"
import { NAV_ITEMS, Sidebar, type View } from "./sidebar"
import { AlertMonitor } from "./alert-settings"

export function LampDashboard() {
  return (
    <FiwareProvider>
      <Shell />
    </FiwareProvider>
  )
}

const SUBTITLES: Record<View, string> = {
  overview: "Estado, luminosidade e sensores de cada lâmpada em tempo real",
  luminosity: "Histórico de luminosidade, temperatura e umidade via STH-Comet",
  devices: "Provisione ou remova dispositivos no IoT Agent e no Orion",
}

function Shell() {
  const [view, setView] = useState<View>("overview")
  const [selectedLamp, setSelectedLamp] = useState<string | null>(null)
  const { server, error, isValidating, refresh, lamps } = useFiware()
  const title = NAV_ITEMS.find((n) => n.id === view)?.label

  const openChart = (id: string) => {
    setSelectedLamp(id)
    setView("luminosity")
  }

  return (
    <div className="relative isolate min-h-dvh">
      <AlertMonitor lamps={lamps} />
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/fractal-glow.png')" }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-black/55 via-black/35 to-black/60" aria-hidden="true" />

      <div className="mx-auto flex max-w-[1800px] flex-col gap-6 p-4 sm:p-6 lg:flex-row">
        <Sidebar view={view} onViewChange={setView} />

        <main className="min-w-0 flex-1 space-y-6">
          <GlassCard className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div key={view} className="animate-rise">
              <h1 className="text-balance text-2xl font-bold text-white sm:text-3xl">{title}</h1>
              <p className="text-sm text-white/60">{SUBTITLES[view]}</p>
            </div>
            <div className="flex items-center gap-3">
              {server ? (
                <span className="glass-soft flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white/70">
                  <LiveDot active={!error} />
                  {error ? "Conexão instável" : "Ao vivo · 5s"}
                </span>
              ) : null}
              <GlassButton
                variant="glass"
                size="icon"
                onClick={() => refresh()}
                disabled={!server}
                aria-label="Atualizar dados"
              >
                <RefreshCw className={cn("transition-transform", isValidating && "animate-spin")} aria-hidden="true" />
              </GlassButton>
            </div>
          </GlassCard>

          <div key={view}>
            {view === "overview" && <OverviewView onOpenChart={openChart} onAddDevice={() => setView("devices")} />}
            {view === "luminosity" && (
              <LuminosityView selectedId={selectedLamp} onSelect={setSelectedLamp} onAddDevice={() => setView("devices")} />
            )}
            {view === "devices" && <DevicesView />}
          </div>
        </main>
      </div>
    </div>
  )
}
