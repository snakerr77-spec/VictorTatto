// Gera public/site.json (conteúdo inicial do site) para o build estático do GitHub Pages.
// Uso: tsx scripts/export-static.ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// O banco é criado do zero numa pasta temporária, só para ler o conteúdo inicial (fotos e estilos).
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'victor-seed-'))

const { db } = await import('../server/db')
const { publicSettings } = await import('../server/routes/public')

const site = {
  settings: publicSettings(),
  categories: db.categories.filter((c) => c.visible).sort((a, b) => a.order - b.order),
  works: db.works.filter((w) => w.visible).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  notices: [],
}

fs.writeFileSync(path.resolve('public/site.json'), JSON.stringify(site))
fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true })
console.log(`site.json: ${site.works.length} fotos, ${site.categories.length} estilos`)
process.exit(0)
