// Uso: npm run reset-password -- "nova senha aqui"
// Pare o servidor antes de rodar (ele guarda o banco em memória).
import './env'
import { hashPassword } from './auth-crypto'
import { db, save } from './db'

const password = process.argv[2]
if (!password || password.length < 8) {
  console.error('Informe a nova senha (mínimo de 8 caracteres): npm run reset-password -- "minha senha"')
  process.exit(1)
}
db.meta.passwordHash = hashPassword(password)
save()
console.log('Senha do painel atualizada.')
