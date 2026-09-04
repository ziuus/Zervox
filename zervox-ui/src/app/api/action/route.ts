import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { endpoint, method = 'POST', payload } = body

    const primaryHost = process.env.ZERVOX_PRIMARY_URL ?? 'http://zervox-primary:8080'
    const targetHosts = [primaryHost, 'http://localhost:8080', 'http://127.0.0.1:8080']

    let lastError = null
    for (const host of targetHosts) {
      try {
        const fullUrl = `${host}${endpoint}`
        const res = await fetch(fullUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'zervox-secret-token',
          },
          body: payload ? JSON.stringify(payload) : undefined,
        })
        const data = await res.json().catch(() => ({}))
        return NextResponse.json({ ok: res.ok, status: res.status, data })
      } catch (err) {
        lastError = err
      }
    }

    return NextResponse.json({ ok: false, error: String(lastError) }, { status: 502 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
