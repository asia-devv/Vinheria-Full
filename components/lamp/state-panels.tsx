"use client"

import { AlertTriangle, Lightbulb, Plus, Server } from "lucide-react"
import { useFiware } from "./fiware-provider"
import { GlassButton, GlassCard } from "./glass"

function Panel({
  icon: Icon,
  title,
  description,
  action,
  tone = "lamp",
}: {
  icon: typeof Server
  title: string
  description: string
  action?: React.ReactNode
  tone?: "lamp" | "error"
}) {
  return (
    <GlassCard className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span
        className={
          tone === "error"
            ? "flex size-14 items-center justify-center rounded-2xl bg-lamp-off/15 text-lamp-off ring-1 ring-lamp-off/30"
            : "flex size-14 items-center justify-center rounded-2xl bg-lamp/15 text-lamp ring-1 ring-lamp/30"
        }
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="max-w-md space-y-1.5">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-pretty text-sm leading-relaxed text-white/60">{description}</p>
      </div>
      {action}
    </GlassCard>
  )
}

/** Renders a blocking state when the server is missing, failing, or has no lamps. Returns null when data is ready. */
export function DataGate({ onAddDevice, children }: { onAddDevice?: () => void; children: React.ReactNode }) {
  const { server, error, isLoading, lamps, refresh } = useFiware()

  if (!server) {
    return (
      <Panel
        icon={Server}
        title="Conecte seu servidor FIWARE"
        description="Informe o IP público da instância AWS no painel lateral (ex: 98.91.20.39:1026). O endereço fica salvo neste navegador."
      />
    )
  }

  if (isLoading && lamps.length === 0) {
    return (
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3" aria-busy="true" aria-label="Carregando dispositivos">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass h-72 animate-pulse rounded-3xl" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    )
  }

  if (error && lamps.length === 0) {
    return (
      <Panel
        tone="error"
        icon={AlertTriangle}
        title="Não foi possível falar com o FIWARE"
        description={`${error.message}. Verifique se o servidor está ligado e se as portas 1026, 4041 e 8666 estão liberadas no Security Group.`}
        action={
          <GlassButton variant="glass" size="sm" onClick={() => refresh()}>
            Tentar novamente
          </GlassButton>
        }
      />
    )
  }

  if (lamps.length === 0) {
    return (
      <Panel
        icon={Lightbulb}
        title="Nenhuma lâmpada encontrada"
        description="Cadastre um dispositivo aqui ou via Postman. Lâmpadas simuladas no Wokwi aparecem assim que publicarem a primeira leitura."
        action={
          onAddDevice ? (
            <GlassButton variant="primary" size="sm" onClick={onAddDevice}>
              <Plus aria-hidden="true" />
              Cadastrar dispositivo
            </GlassButton>
          ) : null
        }
      />
    )
  }

  return <>{children}</>
}
