import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type {
  AccessToken,
  AdminNotification,
  Booking,
  Category,
  Notice,
  QuoteRequest,
  Settings,
  TimeWindow,
  TokenStatus,
  Work,
} from '../shared/types'
import { hashPassword } from './auth-crypto'
import { slugify, uid } from './util'

export interface Meta {
  sessionSecret: string
  passwordHash: string
  lastSummaryDate: string
  reminded: string[]
}

export interface DB {
  version: 1
  settings: Settings
  categories: Category[]
  works: Work[]
  notices: Notice[]
  requests: QuoteRequest[]
  tokens: AccessToken[]
  bookings: Booking[]
  /** data (YYYY-MM-DD) → janelas abertas. Dia ausente = fechado. */
  schedule: Record<string, TimeWindow[]>
  notifications: AdminNotification[]
  meta: Meta
}

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? 'data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
const DB_FILE = path.join(DATA_DIR, 'db.json')

export const defaultSettings = (): Settings => ({
  studioName: 'Victor Tattoo',
  since: 2020,
  tagline: 'Arte que fica. História que permanece.',
  about:
    'O estúdio do Victor nasceu de uma ideia simples: tatuagem é compromisso para a vida inteira, e merece ser tratada assim.\n\n' +
    'Cada projeto começa na conversa. Ouvimos sua história, entendemos o que o traço precisa dizer e só então o desenho ganha forma — sempre autoral, sempre pensado para o seu corpo.\n\n' +
    'Trabalhamos com biossegurança rigorosa, materiais descartáveis e um ambiente reservado, para você viver a sessão com tranquilidade do começo ao fim.',
  heroImage: '/works/65.jpg',
  ctaImage: '/works/70.jpg',
  whatsapp: '5515998434555',
  instagram: 'victorm.',
  tiktok: '',
  address: '',
  city: '',
  hoursText: 'Ter – Sáb · 10:00 – 20:00',
  timezone: 'America/Sao_Paulo',
  slotStepMin: 60,
  bufferMin: 30,
  minLeadHours: 12,
  tokenValidityHours: 72,
  cancelWindowHours: 48,
  defaultDurationMin: 180,
  reminderMin: 60,
  daySummaryHour: 7,
  openTemplate: {
    weekdays: [2, 3, 4, 5, 6],
    windows: [
      { start: '10:00', end: '14:00' },
      { start: '15:00', end: '20:00' },
    ],
  },
  notify: { ntfyTopic: '', telegramBotToken: '', telegramChatId: '' },
})

function seedContent(): Pick<DB, 'categories' | 'works'> {
  const cat = (name: string, description: string, photo: string, order: number): Category => ({
    id: uid(),
    name,
    slug: slugify(name),
    description,
    coverUrl: `/works/${photo}.jpg`,
    visible: true,
    showOnHome: true,
    order,
  })
  const categories = [
    cat('Realismo', 'Retratos, rostos e figuras que respiram.', '86', 0),
    cat('Animais', 'Leões, lobos e tigres com presença e textura.', '65', 1),
    cat('Religioso', 'Fé em black & grey, com luz e profundidade.', '85', 2),
    cat('Lettering', 'Letras com peso, ritmo e personalidade.', '62', 3),
    cat('Fineline', 'Traço fino, delicado e preciso.', '16', 4),
    cat('Oriental', 'Samurais, carpas e máscaras em traço firme.', '43', 5),
  ]
  const id = (slug: string) => categories.find((c) => c.slug === slug)?.id ?? ''

  // [foto, título, categorias, região do corpo, destaque]
  const rows: [string, string, string[], string, boolean][] = [
    ['84', 'Leão coroado', ['animais', 'realismo'], 'Antebraço', true],
    ['86', 'Silêncio', ['realismo'], 'Antebraço', true],
    ['43', 'Samurai e crisântemo', ['oriental'], 'Braço', true],
    ['40', 'Lobo de olhos azuis', ['animais'], 'Antebraço', true],
    ['28', 'Cristo e leão', ['religioso', 'realismo'], 'Antebraço', true],
    ['0', 'Lettering no antebraço', ['lettering'], 'Antebraço', false],
    ['1', 'Onça e flores', ['fineline', 'animais'], 'Braço', false],
    ['2', 'Frases em bloco', ['lettering'], 'Braço', false],
    ['3', 'Lettering fechando o braço', ['lettering'], 'Braço', false],
    ['4', 'Medusa', ['fineline', 'realismo'], 'Coxa', false],
    ['5', 'Guerreiro e leão', ['realismo'], 'Antebraço', false],
    ['6', 'Ramo delicado', ['fineline'], 'Antebraço', false],
    ['7', 'Tigre e lettering', ['animais', 'lettering'], 'Antebraço', false],
    ['8', 'Águia', ['animais'], 'Braço', false],
    ['9', 'Coringa', ['realismo'], 'Antebraço', false],
    ['10', 'Rosto barbado', ['realismo'], 'Antebraço', false],
    ['11', 'Zeus', ['realismo'], 'Antebraço', false],
    ['12', 'Coruja e olho', ['animais', 'realismo'], 'Antebraço', false],
    ['13', 'Leão e rosa', ['animais'], 'Antebraço', false],
    ['14', 'Tigre', ['animais'], 'Antebraço', false],
    ['15', 'Palhaço sombrio', ['realismo'], 'Antebraço', false],
    ['16', 'Lírio', ['fineline'], 'Costas', false],
    ['17', 'Relógio de bolso', ['realismo'], 'Antebraço', false],
    ['18', 'Leão', ['animais'], 'Antebraço', false],
    ['19', 'Olho e mãos', ['realismo'], 'Braço', false],
    ['20', 'Ambition', ['lettering'], 'Peito', false],
    ['21', 'Espartano', ['realismo'], 'Ombro', false],
    ['22', 'Anjos', ['religioso', 'realismo'], 'Antebraço', false],
    ['23', 'Leão e cruz', ['animais', 'religioso'], 'Antebraço', false],
    ['24', 'Floral no quadril', ['fineline'], 'Quadril', false],
    ['25', 'Pomba e cruz', ['religioso'], 'Antebraço', false],
    ['26', 'Rosto e cruz', ['realismo', 'religioso'], 'Panturrilha', false],
    ['27', 'Lettering e rosa vermelha', ['lettering'], 'Panturrilha', false],
    ['29', 'Rostos', ['realismo'], 'Antebraço', false],
    ['30', 'Nossa Senhora', ['religioso'], 'Braço', false],
    ['31', 'Cristo no peito', ['religioso', 'realismo'], 'Peito', false],
    ['32', 'Mitologia', ['realismo'], 'Braço', false],
    ['33', 'Palhaço', ['realismo'], 'Antebraço', false],
    ['34', 'Coruja e flores', ['animais', 'fineline'], 'Antebraço', false],
    ['35', 'Leão e cruz', ['animais'], 'Antebraço', false],
    ['36', 'Flor ampliada', ['fineline'], 'Ombro', false],
    ['37', 'Anúbis e balança', ['realismo'], 'Costas', false],
    ['38', 'Cavaleiro encapuzado', ['realismo'], 'Ombro', false],
    ['39', 'Anúbis', ['realismo'], 'Antebraço', false],
    ['41', 'Retrato', ['realismo'], 'Costela', false],
    ['42', 'Mulher e flor vermelha', ['realismo'], 'Antebraço', false],
    ['44', 'Cristo', ['religioso', 'realismo'], 'Braço', false],
    ['45', 'Fechamento de braço', ['realismo'], 'Braço', false],
    ['46', 'Lobo', ['animais'], 'Antebraço', false],
    ['47', 'Guerreira e leão', ['realismo', 'animais'], 'Antebraço', false],
    ['48', 'Leão', ['animais'], 'Antebraço', false],
    ['49', 'Musa sombria', ['realismo'], 'Braço', false],
    ['50', 'Gladiador e Coliseu', ['realismo'], 'Braço', false],
    ['51', 'Retrato feminino', ['realismo'], 'Braço', false],
    ['52', 'Máscara e rosto', ['realismo'], 'Braço', false],
    ['53', 'Lobo no pescoço', ['animais'], 'Pescoço', false],
    ['54', 'Guerreiro', ['realismo', 'lettering'], 'Braço', false],
    ['55', 'Destined for Success', ['lettering'], 'Pescoço', false],
    ['56', 'Carpas koi', ['oriental'], 'Costas', false],
    ['57', 'Casal e coroa', ['realismo'], 'Braço', false],
    ['58', 'Chapéu e fumaça', ['realismo'], 'Costela', false],
    ['59', 'Escultura dourada', ['realismo'], 'Antebraço', false],
    ['60', 'Wanted', ['realismo'], 'Peito', false],
    ['61', 'Doberman', ['animais'], 'Braço', false],
    ['62', 'Ambizione', ['lettering'], 'Braço', false],
    ['63', 'Ave e fechamento', ['animais', 'realismo'], 'Antebraço', false],
    ['64', 'Cristo nas costas', ['religioso', 'realismo'], 'Costas', false],
    ['65', 'Leão', ['animais'], 'Braço', false],
    ['66', 'Cristo em sleeve', ['religioso'], 'Braço', false],
    ['67', 'Lírios e frase', ['fineline'], 'Costas', false],
    ['68', 'Onça', ['animais'], 'Braço', false],
    ['69', 'Guerreiro de capacete', ['realismo'], 'Antebraço', false],
    ['71', 'Cristo e cruz', ['religioso', 'realismo'], 'Antebraço', false],
    ['72', 'Oni samurai', ['oriental'], 'Braço', false],
    ['73', 'Lobo rugindo', ['animais'], 'Antebraço', false],
    ['74', 'Marilyn', ['realismo'], 'Braço', false],
    ['75', 'Dama de pedra', ['realismo'], 'Antebraço', false],
    ['76', 'Olho', ['realismo'], 'Braço', false],
    ['77', 'Estrela de Davi', ['religioso', 'animais'], 'Braço', false],
    ['78', 'Coruja e anjo', ['religioso', 'animais'], 'Antebraço', false],
    ['79', 'Zeus e colunas', ['realismo'], 'Antebraço', false],
    ['80', 'Anjo em oração', ['religioso'], 'Braço', false],
    ['81', 'Virgem Maria', ['religioso'], 'Antebraço', false],
    ['82', 'Hércules', ['realismo'], 'Braço', false],
    ['83', 'Scarface', ['realismo'], 'Antebraço', false],
    ['85', 'Cristo e cruz', ['religioso'], 'Antebraço', false],
    ['87', 'Pombas e fé', ['religioso'], 'Antebraço', false],
    ['88', 'Resiliência', ['lettering'], 'Antebraço', false],
    ['89', 'Palhaço', ['realismo'], 'Braço', false],
    ['90', 'Cristo e coroa de espinhos', ['religioso', 'realismo'], 'Ombro', false],
    ['91', 'Anjo e pombas', ['religioso'], 'Antebraço', false],
  ]
  const day = 86_400_000
  const works: Work[] = rows.map(([photo, title, cats, bodyArea, featured], i) => ({
    id: uid(),
    title,
    imageUrl: `/works/${photo.padStart(2, '0')}.jpg`,
    categoryIds: cats.map(id).filter(Boolean),
    bodyArea,
    featured,
    visible: true,
    createdAt: new Date(Date.now() - i * day).toISOString(),
  }))
  return { categories, works }
}

function fresh(): DB {
  const password = process.env.ADMIN_PASSWORD || 'victor2024'
  return {
    version: 1,
    settings: defaultSettings(),
    ...seedContent(),
    notices: [],
    requests: [],
    tokens: [],
    bookings: [],
    schedule: {},
    notifications: [],
    meta: {
      sessionSecret: randomBytes(32).toString('hex'),
      passwordHash: hashPassword(password),
      lastSummaryDate: '',
      reminded: [],
    },
  }
}

function load(): DB {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  if (!fs.existsSync(DB_FILE)) {
    const db = fresh()
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
    if (!process.env.ADMIN_PASSWORD) {
      console.warn('\n⚠  Painel criado com a senha padrão "victor2024". Troque em Configurações ou defina ADMIN_PASSWORD no .env.\n')
    }
    return db
  }
  const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Partial<DB>
  const base = fresh()
  const settings: Settings = {
    ...base.settings,
    ...raw.settings,
    openTemplate: { ...base.settings.openTemplate, ...raw.settings?.openTemplate },
    notify: { ...base.settings.notify, ...raw.settings?.notify },
  }
  return {
    ...base,
    ...raw,
    settings,
    meta: { ...base.meta, ...raw.meta },
  } as DB
}

export const db: DB = load()

function write() {
  const tmp = `${DB_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(db))
  fs.renameSync(tmp, DB_FILE)
}

/** Grava em disco na hora (arquivo temporário + rename, então nunca fica pela metade). */
export const save = write

// ---------- consultas úteis ----------

export const tokenStatus = (t: AccessToken, now = Date.now()): TokenStatus =>
  t.status === 'active' && Date.parse(t.expiresAt) < now ? 'expired' : t.status

export const withStatus = (t: AccessToken): AccessToken => ({ ...t, status: tokenStatus(t) })

export const findBooking = (id: string): Booking | undefined => db.bookings.find((b) => b.id === id)

export function pushLimited<T>(list: T[], item: T, max: number) {
  list.unshift(item)
  if (list.length > max) list.length = max
}

