// Precisa ser o PRIMEIRO import do servidor: carrega o .env antes dos demais módulos lerem process.env.
try {
  process.loadEnvFile()
} catch {
  // sem .env — segue com o ambiente do sistema
}
