"use client"

import { useState } from "react"
import { Server } from "lucide-react"
import { toast } from "sonner"
import { isValidServer } from "@/lib/fiware"
import { cn } from "@/lib/utils"
import { useFiware } from "./fiware-provider"
import { GlassButton, GlassInput } from "./glass"

export function ServerConfig() {
  const { server, setServer, error, lamps, isLoading, log } = useFiware()
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? server

  const status = !server ? "idle" : isLoading ? "connecting" : error ? "error" : "online"
  const statusLabel = {
    idle: "Não configurado",
    connecting: "Conectando...",
    error: "Sem resposta",
    online: `Online · ${lamps.length} ${lamps.length === 1 ? "lâmpada" : "lâmpadas"}`,
  }[status]

  const connect = (event: React.FormEvent) => {
    event.preventDefault()
    if (!isValidServer(value)) {
      toast.error("Informe um IPv4 válido", { description: "Ex: 98.91.20.39:1026" })
      return
    }
    setServer(value)
    setDraft(null)
    log("info", `Servidor configurado: ${value.trim()}`)
    toast.success("Servidor configurado", { description: value.trim() })
  }

  return (
    <form onSubmit={connect} className="glass-soft space-y-3 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="server-ip" className="flex items-center gap-2 text-sm font-semibold text-white">
          <Server className="size-4 text-lamp" aria-hidden="true" />
          Servidor FIWARE
        </label>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors duration-500",
            status === "online" && "bg-lamp-on/15 text-lamp-on",
            status === "error" && "bg-lamp-off/15 text-lamp-off",
            (status === "idle" || status === "connecting") && "bg-white/10 text-white/60",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full bg-current",
              status === "connecting" && "animate-pulse",
            )}
            aria-hidden="true"
          />
          {statusLabel}
        </span>
      </div>
      <GlassInput
        id="server-ip"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Ex: 98.91.20.39:1026"
        value={value}
        onChange={(e) => setDraft(e.target.value)}
      />
      <GlassButton type="submit" variant="primary" size="sm" className="w-full">
        Conectar
      </GlassButton>
    </form>
  )
}
