import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function handler() {
  try {
    // Prendi tutti i reminder da inviare entro ora
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('status', 'queued')
      .lte('due_at', new Date().toISOString())

    if (error) throw error

    if (!data || data.length === 0) {
      return { statusCode: 200, body: "Nessun reminder da inviare" }
    }

    // Ciclo e invio (per ora simuliamo con log)
    for (const reminder of data) {
      console.log(`Invio reminder a ${reminder.phone_e164}: ${reminder.text}`)

      // qui puoi chiamare la tua API del bot WhatsApp
      // es: await fetch(WA_API_URL, { method: "POST", body: JSON.stringify({...}) })

      // Aggiorna status a "sent"
      await supabase
        .from('reminders')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', reminder.id)
    }

    return { statusCode: 200, body: "Reminder processati" }
  } catch (err) {
    console.error(err)
    return { statusCode: 500, body: err.message }
  }
}
