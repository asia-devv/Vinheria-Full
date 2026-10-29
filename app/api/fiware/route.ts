import { NextResponse } from "next/server"

// 1026 = Orion, 4041 = IoT Agent, 8666 = STH-Comet
const ALLOWED_PORTS = ["1026", "4041", "8666"]
const ALLOWED_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"]
const IP_WITH_PORT = /^(\d{1,3}\.){3}\d{1,3}:\d{2,5}$/

type ProxyPayload = {
  servidor?: string
  caminho?: string
  metodo?: string
  body?: unknown
}

export async function POST(request: Request) {
  let payload: ProxyPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
  }

  const { servidor, caminho, metodo = "GET", body } = payload

  if (!servidor) {
    return NextResponse.json({ erro: "Servidor não informado" }, { status: 400 })
  }

  const port = String(servidor).split(":")[1]
  if (!IP_WITH_PORT.test(servidor) || !ALLOWED_PORTS.includes(port)) {
    return NextResponse.json(
      { erro: `Servidor inválido. Use IP:porta (portas: ${ALLOWED_PORTS.join(", ")})` },
      { status: 400 },
    )
  }

  if (servidor.split(":")[0].split(".").some((part) => Number(part) > 255)) {
    return NextResponse.json({ erro: "Endereço IP inválido" }, { status: 400 })
  }

  if (typeof caminho !== "string" || !caminho.startsWith("/") || caminho.includes("..")) {
    return NextResponse.json({ erro: "Caminho inválido" }, { status: 400 })
  }

  const method = String(metodo).toUpperCase()
  if (!ALLOWED_METHODS.includes(method)) {
    return NextResponse.json({ erro: "Método não permitido" }, { status: 400 })
  }

  const hasBody = method !== "GET" && method !== "DELETE" && body !== undefined
  const headers: Record<string, string> = {
    "fiware-service": "smart",
    "fiware-servicepath": "/",
    accept: "application/json",
  }
  if (hasBody) headers["Content-Type"] = "application/json"

  try {
    const response = await fetch(`http://${servidor}${caminho}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    })

    const text = await response.text()
    if (response.status === 204 || text.length === 0) {
      return new NextResponse(null, { status: response.status === 204 ? 204 : response.status })
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: response.status })
    } catch {
      return new NextResponse(text, { status: response.status })
    }
  } catch (error) {
    const err = error as Error & { cause?: { code?: string; message?: string } }
    return NextResponse.json(
      {
        erro: "Não foi possível conectar ao servidor FIWARE",
        detalhe: err.message,
        causa: err.cause?.code || err.cause?.message,
      },
      { status: 502 },
    )
  }
}
