export const ENTITY_PREFIX = "urn:ngsi-ld:Lamp:"
export const HISTORY_ATTRIBUTES = ["luminosity", "temperature", "humidity"] as const

export type HistoryAttribute = (typeof HISTORY_ATTRIBUTES)[number]
type Port = 1026 | 4041 | 8666

export type Lamp = {
  id: string
  entityName: string
  deviceId?: string
  provisioned: boolean
  state: "on" | "off" | "unknown"
  luminosity: number | null
  temperature: number | null
  humidity: number | null
  updatedAt: string | null
}

export type HistoryPoint = { date: string; value: number }

export class FiwareError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function getHost(server: string) {
  return server.trim().replace(/^https?:\/\//, "").split(":")[0].split("/")[0]
}

export function isValidServer(server: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(getHost(server))
}

async function fiware<T = unknown>(
  server: string,
  path: string,
  { method = "GET", body, port = 1026 }: { method?: string; body?: unknown; port?: Port } = {},
) {
  const response = await fetch("/api/fiware", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ servidor: `${getHost(server)}:${port}`, caminho: path, metodo: method, body }),
  })

  const text = await response.text()
  let data: unknown = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Some FIWARE endpoints return plain text
  }

  return { ok: response.ok, status: response.status, data: data as T }
}

function errorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const d = data as Record<string, string>
    return d.erro ? `${d.erro}${d.causa ? ` (${d.causa})` : ""}` : d.description || d.message || fallback
  }
  return typeof data === "string" && data ? data : fallback
}

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function normalizeState(value: unknown): Lamp["state"] {
  const v = String(value ?? "").toLowerCase()
  if (v === "on" || v === "ligada" || v === "1" || v === "true") return "on"
  if (v === "off" || v === "desligada" || v === "0" || v === "false") return "off"
  return "unknown"
}

type IotDevice = { device_id: string; entity_name: string; entity_type: string }
type LampEntity = Record<string, unknown> & { id: string; type: string }

export async function fetchLamps(server: string): Promise<Lamp[]> {
  const [devicesRes, entitiesRes] = await Promise.all([
    fiware<{ devices?: IotDevice[] }>(server, "/iot/devices?limit=100", { port: 4041 }).catch(() => null),
    fiware<LampEntity[]>(server, "/v2/entities?type=Lamp&options=keyValues&limit=100"),
  ])

  if (!entitiesRes.ok && !devicesRes?.ok) {
    throw new FiwareError(errorMessage(entitiesRes.data, "Falha ao consultar o Orion"), entitiesRes.status)
  }

  const entities = entitiesRes.ok && Array.isArray(entitiesRes.data) ? entitiesRes.data : []
  const devices = devicesRes?.ok ? (devicesRes.data.devices ?? []).filter((d) => d.entity_type === "Lamp") : []
  const lamps = new Map<string, Lamp>()

  const ensure = (entityName: string): Lamp => {
    const existing = lamps.get(entityName)
    if (existing) return existing
    const lamp: Lamp = {
      id: entityName.startsWith(ENTITY_PREFIX) ? entityName.slice(ENTITY_PREFIX.length) : entityName,
      entityName,
      provisioned: false,
      state: "unknown",
      luminosity: null,
      temperature: null,
      humidity: null,
      updatedAt: null,
    }
    lamps.set(entityName, lamp)
    return lamp
  }

  for (const device of devices) {
    const lamp = ensure(device.entity_name)
    lamp.deviceId = device.device_id
    lamp.provisioned = true
  }

  for (const entity of entities) {
    const lamp = ensure(entity.id)
    lamp.state = normalizeState(entity.state)
    lamp.luminosity = toNumber(entity.luminosity)
    lamp.temperature = toNumber(entity.temperature)
    lamp.humidity = toNumber(entity.humidity)
    lamp.updatedAt = typeof entity.TimeInstant === "string" ? entity.TimeInstant : null
  }

  return [...lamps.values()].sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }))
}

export async function sendCommand(server: string, id: string, command: "on" | "off") {
  const res = await fiware(server, `/v2/entities/${ENTITY_PREFIX}${id}/attrs`, {
    method: "PATCH",
    body: { [command]: { type: "command", value: "" } },
  })
  if (!res.ok) throw new FiwareError(errorMessage(res.data, "Erro ao enviar comando"), res.status)
}

type Registration = { id: string; dataProvided?: { entities?: { id: string }[] } }

export async function createDevice(server: string, id: string) {
  const deviceId = `lamp${id}`
  const entityName = `${ENTITY_PREFIX}${id}`

  const deviceRes = await fiware(server, "/iot/devices", {
    method: "POST",
    port: 4041,
    body: {
      devices: [
        {
          device_id: deviceId,
          entity_name: entityName,
          entity_type: "Lamp",
          protocol: "PDI-IoTA-UltraLight",
          transport: "MQTT",
          commands: [
            { name: "on", type: "command" },
            { name: "off", type: "command" },
          ],
          attributes: [
            { object_id: "s", name: "state", type: "Text" },
            { object_id: "l", name: "luminosity", type: "Integer" },
            { object_id: "t", name: "temperature", type: "Float" },
            { object_id: "h", name: "humidity", type: "Float" },
          ],
        },
      ],
    },
  })

  if (!deviceRes.ok && deviceRes.status !== 409) {
    throw new FiwareError(`IoT Agent: ${errorMessage(deviceRes.data, String(deviceRes.status))}`, deviceRes.status)
  }

  const list = await fiware<Registration[]>(server, "/v2/registrations")
  const registrations = list.ok && Array.isArray(list.data) ? list.data : []
  const alreadyRegistered = registrations.some((r) => r.dataProvided?.entities?.some((e) => e.id === entityName))

  if (!alreadyRegistered) {
    const reg = await fiware(server, "/v2/registrations", {
      method: "POST",
      body: {
        description: `Lamp Commands ${deviceId}`,
        dataProvided: { entities: [{ id: entityName, type: "Lamp" }], attrs: ["on", "off"] },
        provider: { http: { url: `http://${getHost(server)}:4041` }, legacyForwarding: true },
      },
    })
    if (!reg.ok) {
      throw new FiwareError(`Registro de comandos: ${errorMessage(reg.data, String(reg.status))}`, reg.status)
    }
  }

  return { deviceId, existed: deviceRes.status === 409 }
}

export async function deleteDevice(server: string, id: string) {
  const deviceId = `lamp${id}`
  const entityName = `${ENTITY_PREFIX}${id}`
  const okOr404 = (r: { ok: boolean; status: number }) => r.ok || r.status === 404

  const device = await fiware(server, `/iot/devices/${deviceId}`, { method: "DELETE", port: 4041 })
  if (!okOr404(device)) throw new FiwareError(`IoT Agent: ${device.status}`, device.status)

  const list = await fiware<Registration[]>(server, "/v2/registrations")
  if (list.ok && Array.isArray(list.data)) {
    const owned = list.data.filter((r) => r.dataProvided?.entities?.some((e) => e.id === entityName))
    for (const reg of owned) {
      await fiware(server, `/v2/registrations/${reg.id}`, { method: "DELETE" })
    }
  }

  const entity = await fiware(server, `/v2/entities/${entityName}`, { method: "DELETE" })
  if (!okOr404(entity)) throw new FiwareError(`Orion: ${entity.status}`, entity.status)

  return { deviceId }
}

type Subscription = {
  subject?: { entities?: { id: string }[] }
  notification?: { http?: { url?: string }; attrs?: string[] }
}

export async function ensureHistorySubscription(server: string, id: string) {
  const entityName = `${ENTITY_PREFIX}${id}`
  const notifyUrl = `http://${getHost(server)}:8666/notify`

  const list = await fiware<Subscription[]>(server, "/v2/subscriptions")
  if (!list.ok) {
    throw new FiwareError(`Assinatura do histórico: ${errorMessage(list.data, String(list.status))}`, list.status)
  }

  const exists = (Array.isArray(list.data) ? list.data : []).some(
    (s) =>
      s.subject?.entities?.some((e) => e.id === entityName) &&
      s.notification?.http?.url === notifyUrl &&
      HISTORY_ATTRIBUTES.every((a) => s.notification?.attrs?.includes(a)),
  )
  if (exists) return false

  const created = await fiware(server, "/v2/subscriptions", {
    method: "POST",
    body: {
      description: `Histórico ${entityName}`,
      subject: { entities: [{ id: entityName, type: "Lamp" }], condition: { attrs: [...HISTORY_ATTRIBUTES] } },
      notification: { http: { url: notifyUrl }, attrs: [...HISTORY_ATTRIBUTES], attrsFormat: "legacy" },
    },
  })
  if (!created.ok) {
    throw new FiwareError(`Ativar histórico: ${errorMessage(created.data, String(created.status))}`, created.status)
  }
  return true
}

type SthResponse = {
  values?: { recvTime?: string; attrValue?: unknown }[]
  contextResponses?: {
    contextElement?: { attributes?: { name: string; values?: { recvTime?: string; attrValue?: unknown }[] }[] }
  }[]
}

export async function fetchHistory(server: string, id: string, attribute: HistoryAttribute, lastN = 30) {
  const res = await fiware<SthResponse>(
    server,
    `/STH/v1/contextEntities/type/Lamp/id/${ENTITY_PREFIX}${id}/attributes/${attribute}?lastN=${lastN}`,
    { port: 8666 },
  )
  if (!res.ok) {
    throw new FiwareError(`STH-Comet (${attribute}): ${errorMessage(res.data, String(res.status))}`, res.status)
  }

  const attrs = res.data?.contextResponses?.flatMap((c) => c.contextElement?.attributes ?? []) ?? []
  const values = res.data?.values ?? attrs.find((a) => a.name === attribute)?.values ?? []

  return values
    .map((v) => ({ date: v.recvTime ?? "", value: toNumber(v.attrValue) }))
    .filter((p): p is HistoryPoint => Boolean(p.date) && p.value !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}
