// netlify/functions/scheduler.ts
import type { Handler } from '@netlify/functions'
import { json } from './_shared'

export const handler: Handler = async () => {
  // placeholder: niente da fare, il bot su Hetzner processa i messaggi
  return json({ ok: true })
}
