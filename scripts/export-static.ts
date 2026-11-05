// Gera public/seed-state.json: conteúdo inicial do site para o build do GitHub Pages.
// É o ponto de partida do "banco" (state.json na branch `data`) e o que o site mostra enquanto ele não existe.
// Uso: tsx scripts/export-static.ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// O banco é criado do zero numa pasta temporária, só para ler o conteúdo inicial (fotos e estilos).
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'victor-seed-'))

const { db } = await import('../server/db')

const state = {
  v: 1,
  settings: { ...db.settings, notify: { ntfyTopic: '', telegramBotToken: '', telegramChatId: '' } },
  categories: [...db.categories].sort((a, b) => a.order - b.order),
  works: [...db.works].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  notices: [],
  schedule: {},
  bookings: [],
  tokens: [],
}

fs.writeFileSync(path.resolve('public/seed-state.json'), JSON.stringify(state))
fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true })
console.log(`seed-state.json: ${state.works.length} fotos, ${state.categories.length} estilos`)
process.exit(0)
