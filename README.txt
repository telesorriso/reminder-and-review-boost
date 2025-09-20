PATCH: Netlify Functions (agenda + contatti)

Contenuto:
- netlify/functions/_shared.ts
- netlify/functions/appointments-by-day.ts
- netlify/functions/appointments-create.ts
- netlify/functions/contacts-list.ts

Come usare:
1) Estrai lo zip nella root del repo, sovrascrivendo i file esistenti.
2) Commit & push su GitHub (branch main).
3) Netlify farà il deploy automatico. 
4) Ricarica l'app e prova:
   - /.netlify/functions/appointments-by-day?date=YYYY-MM-DD
   - POST /.netlify/functions/appointments-create
   - /.netlify/functions/contacts-list?q=Rossi
