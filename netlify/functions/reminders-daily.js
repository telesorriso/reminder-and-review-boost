import type { Handler } from '@netlify/functions'
import { supa, ok, serverError } from './_shared'

export const handler: Handler = async () => {
  try {
    const now = new Date().toISOString()

    // Trova tutti i messaggi pending e scaduti
    const { data: dueMessages, error } = await supa
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('due_at', now)

    if (error) return serverError(error.message)
    if (!dueMessages || dueMessages.length === 0) {
      return ok({ message: 'Nessun reminder da inviare' })
    }

    for (const msg of dueMessages) {
      try {
        // simulazione invio WhatsApp
        console.log('Invio messaggio a', msg.phone_e164, msg.body)

        await supa
          .from('scheduled_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', msg.id)
      } catch (err: any) {
        await supa
          .from('scheduled_messages')
          .update({
            status: 'failed',
            last_error: err?.message || 'Errore invio',
          })
          .eq('id', msg.id)
      }
    }

    return ok({ sent: dueMessages.length })
  } catch (e: any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
