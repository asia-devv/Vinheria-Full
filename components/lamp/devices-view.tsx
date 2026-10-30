"use client"

import { useState } from "react"
import { Check, Copy, Cpu, Lightbulb, Plus, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { createDevice, deleteDevice, ENTITY_PREFIX, getHost, type Lamp } from "@/lib/fiware"
import { cn } from "@/lib/utils"
import { useFiware } from "./fiware-provider"
import { GlassButton, GlassCard, GlassInput } from "./glass"
import { AlertSettings, TelegramConfig } from "./alert-settings"

const ID_PATTERN = /^[a-zA-Z0-9]+$/

export function DevicesView() {
  const { server, lamps, refresh, log, error, isLoading } = useFiware()
  const [newId, setNewId] = useState("")
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<Lamp | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const id = newId.trim()
  const invalid = id.length > 0 && !ID_PATTERN.test(id)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!server) return toast.error("Configure o IP do servidor primeiro")
    if (!ID_PATTERN.test(id)) return toast.error("Use apenas letras e números no ID", { description: "Ex: 003" })

    setCreating(true)
    try {
      const result = await createDevice(server, id)
      log("create", `Dispositivo ${result.deviceId} ${result.existed ? "verificado" : "cadastrado"}`)
      toast.success(result.existed ? "Dispositivo já existia" : "Dispositivo cadastrado", {
        description: result.existed ? `${result.deviceId}: registro de comandos verificado.` : `${result.deviceId} criado e registrado.`,
      })
      setNewId("")
      await refresh()
    } catch (err) {
      log("error", `Falha ao cadastrar lamp${id}`)
      toast.error("Erro ao criar dispositivo", { description: (err as Error).message })
    } finally {
      setCreating(false)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    const target = toDelete
    setToDelete(null)
    setDeletingId(target.id)
    try {
      const result = await deleteDevice(server, target.id)
      log("delete", `Dispositivo ${result.deviceId} removido`)
      toast.success("Dispositivo removido", { description: `${result.deviceId} e seus registros foram apagados.` })
      await refresh()
    } catch (err) {
      log("error", `Falha ao remover lamp${target.id}`)
      toast.error("Erro ao deletar dispositivo", { description: (err as Error).message })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[26rem_1fr]">
      <div className="space-y-6">
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold text-white">Cadastrar dispositivo</h2>
          <p className="mt-1 text-sm text-white/55">Provisiona no IoT Agent e registra os comandos on/off no Orion.</p>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="device-id" className="text-sm font-medium text-white/80">
                ID do dispositivo
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-white/40">lamp</span>
                <GlassInput
                  id="device-id"
                  placeholder="003"
                  value={newId}
                  autoComplete="off"
                  maxLength={24}
                  aria-invalid={invalid}
                  aria-describedby="device-id-hint"
                  onChange={(e) => setNewId(e.target.value)}
                  className={cn("pl-[3.25rem]", invalid && "border-lamp-off/60 focus:border-lamp-off/60 focus:ring-lamp-off/15")}
                />
              </div>
              <p id="device-id-hint" className={cn("text-xs transition-colors", invalid ? "text-lamp-off" : "text-white/45")}>
                {invalid ? "Use apenas letras e números." : `Entidade: ${ENTITY_PREFIX}${id || "003"}`}
              </p>
            </div>
            <GlassButton type="submit" variant="primary" className="w-full" loading={creating} disabled={!id || invalid || !server}>
              {!creating && <Plus aria-hidden="true" />}
              {creating ? "Cadastrando..." : "Cadastrar dispositivo"}
            </GlassButton>
          </form>
        </GlassCard>

        <IntegrationHelp server={server} id={id || "003"} />
        <GlassCard className="p-6">
          <h2 className="text-base font-semibold text-white">Telegram</h2>
          <TelegramConfig />
        </GlassCard>
      </div>

      <GlassCard delay={100} className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Dispositivos registrados</h2>
            <p className="text-sm text-white/55">Fonte: IoT Agent (:4041) + Orion (:1026)</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm tabular-nums text-white/80">{lamps.length}</span>
        </div>

        {!server ? (
          <p className="mt-6 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/50">
            Configure o servidor FIWARE para listar os dispositivos.
          </p>
        ) : isLoading && lamps.length === 0 ? (
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : error && lamps.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-lamp-off/30 bg-lamp-off/10 p-4 text-sm text-lamp-off">{error.message}</p>
        ) : lamps.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/50">
            Nenhum dispositivo ainda. Cadastre o primeiro ao lado.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {lamps.map((lamp, i) => (
              <li
                key={lamp.entityName}
                className={cn(
                  "glass-soft animate-rise flex items-center gap-4 rounded-2xl p-3 pr-4 transition-all duration-500 hover:bg-white/10",
                  deletingId === lamp.id && "scale-[0.98] opacity-50",
                )}
                style={{ animationDelay: `${150 + i * 60}ms` }}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-700",
                    lamp.state === "on" ? "bg-lamp/20 text-lamp" : "bg-white/8 text-white/50",
                  )}
                >
                  <Lightbulb className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">
                    {lamp.deviceId ?? `lamp${lamp.id}`}
                    {!lamp.provisioned && (
                      <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-normal text-white/55">
                        só no Orion
                      </span>
                    )}
                  </p>
                  <p className="truncate font-mono text-xs text-white/45">{lamp.entityName}</p>
                  <AlertSettings lampId={lamp.id} />
                </div>
                <GlassButton
                  variant="danger"
                  size="sm"
                  loading={deletingId === lamp.id}
                  disabled={deletingId !== null}
                  onClick={() => setToDelete(lamp)}
                  aria-label={`Deletar ${lamp.deviceId ?? `lamp${lamp.id}`}`}
                >
                  {deletingId !== lamp.id && <Trash2 aria-hidden="true" />}
                  <span className="hidden sm:inline">Deletar</span>
                </GlassButton>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent className="glass rounded-3xl border-white/15 bg-neutral-950/70 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar lamp{toDelete?.id}?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Remove o dispositivo do IoT Agent, os registros de comando e a entidade {toDelete?.entityName} do Orion. Essa
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="rounded-xl bg-lamp-off text-neutral-950 hover:bg-lamp-off/85">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function IntegrationHelp({ server, id }: { server: string; id: string }) {
  const host = server ? getHost(server) : "SEU_IP"
  const snippets = [
    {
      icon: Send,
      title: "Postman · ligar",
      code: `PATCH http://${host}:1026/v2/entities/${ENTITY_PREFIX}${id}/attrs\nfiware-service: smart\nfiware-servicepath: /\n\n{ "on": { "type": "command", "value": "" } }`,
    },
    {
      icon: Cpu,
      title: "Wokwi / ESP32 · tópicos MQTT",
      code: `/TEF/lamp${id}/cmd       (comandos)\n/TEF/lamp${id}/attrs/l   (luminosidade)\n/TEF/lamp${id}/attrs/s   (estado)`,
    },
  ]

  return (
    <GlassCard delay={160} className="p-6">
      <h2 className="text-base font-semibold text-white">Testar com Postman e Wokwi</h2>
      <p className="mt-1 text-xs text-white/50">Tópicos assumem a apikey padrão TEF do FIWARE Descomplicado.</p>
      <div className="mt-4 space-y-3">
        {snippets.map((s) => (
          <Snippet key={s.title} {...s} />
        ))}
      </div>
    </GlassCard>
  )
}

function Snippet({ icon: Icon, title, code }: { icon: typeof Send; title: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="glass-soft rounded-2xl p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium text-white/85">
          <Icon className="size-4 text-lamp" aria-hidden="true" />
          {title}
        </p>
        <GlassButton variant="ghost" size="icon" className="size-8" onClick={copy} aria-label={`Copiar ${title}`}>
          {copied ? <Check className="text-lamp-on" aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </GlassButton>
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed text-white/60">{code}</pre>
    </div>
  )
}
