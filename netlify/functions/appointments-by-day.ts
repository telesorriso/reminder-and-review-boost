import type { Handler } from '@netlify/functions'

export const handler: Handler = async (event) => {
  try {
    const date = event.queryStringParameters?.date || ''
    console.info('PING appointments-by-day', { date })
    return new Response(JSON.stringify({ ok: true, echoDate: date }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('UNHANDLED_PING', e?.message || e)
    return new Response(JSON.stringify({ error: e?.message || 'err' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
