import { NextResponse } from "next/server"

export async function POST(request: Request) {
  let body: { token?: string; chatId?: string; text?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }) }
  const { token, chatId, text } = body
  if (!token || !chatId || !text || text.length > 1000 || !/^[0-9]+:[A-Za-z0-9_-]+$/.test(token)) {
    return NextResponse.json({ error: "Token, chat ID or message invalid" }, { status: 400 })
  }
  try {
    const result = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }), cache: "no-store", signal: AbortSignal.timeout(10000),
    })
    const data = await result.json().catch(() => null)
    return NextResponse.json({ ok: result.ok, error: result.ok ? undefined : data?.description }, { status: result.ok ? 200 : 502 })
  } catch {
    return NextResponse.json({ error: "Could not reach Telegram" }, { status: 502 })
  }
}
