import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const primaryHost = process.env.ZERVOX_PRIMARY_URL ?? 'http://zervox-primary:8080'
  const backupHost = process.env.ZERVOX_BACKUP_URL ?? 'http://zervox-backup:8081'
  const targetHosts = [primaryHost, backupHost, 'http://localhost:8080', 'http://localhost:8081']

  for (const host of targetHosts) {
    try {
      const res = await fetch(`${host}/api/incidents/${id}/forensics`, {
        cache: 'no-store',
        headers: { 'x-api-key': 'zervox-secret-token' },
      })
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json(data)
      }
    } catch {
      // try next host
    }
  }

  return NextResponse.json(
    { status: 'error', message: 'Forensic evidence not found or node offline' },
    { status: 404 }
  )
}
