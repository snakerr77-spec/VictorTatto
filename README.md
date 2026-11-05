# Victor Tattoo — site + tokens + painel

Site preto e branco com agendamento por token e painel do tatuador. React 19 + TypeScript + Tailwind v4 + Motion no front; Express + banco em arquivo JSON (`data/db.json`) no back.

## Fluxo

1. O cliente pede orçamento pelo WhatsApp.
2. Aprovado, o Victor gera um **token** em `/admin/tokens` e envia (botão de WhatsApp já monta a mensagem com o link).
3. O cliente abre o link (ou digita o token em `/agendamento`), escolhe **dia e horário** livres e confirma. O token é consumido.
4. O Victor vê tudo no painel e pode cancelar um horário (o token volta a valer para o cliente remarcar).

Só aparecem para o cliente os dias **abertos** em `/admin/agenda`. Para **bloquear** dias: selecione-os e toque em *Bloquear* (dias com cliente marcado exigem cancelar antes).

## Painel (`/admin`)

Painel · Tokens · Agenda (abrir/bloquear dias, horário padrão ou personalizado) · Fotos (enviar, ocultar, destacar, trocar estilo, apagar) · Avisos (faixa no topo do site) · Ajustes (WhatsApp, horários, senha).

## Rodando

```bash
npm install
npm run dev      # API em :3011 + site em http://localhost:5190
```

Painel: `http://localhost:5190/admin`. Senha inicial `Victor2026` (ou `ADMIN_PASSWORD` do `.env`, antes da 1ª execução). Troque em **Ajustes**.

## Produção

```bash
npm run build
npm start        # um servidor só entrega site + API
```

Veja `.env.example`. Faça backup de `data/` (banco + fotos enviadas). Atrás de proxy, use `TRUST_PROXY=1`.

Para ter tokens, agenda e painel no ar, hospede em algo que rode Node (Render, Railway, VPS…) com build `npm install && npm run build`, start `npm start`, `ADMIN_PASSWORD` definida e um **disco persistente** em `DATA_DIR` (senão banco e fotos enviadas somem a cada deploy).

## GitHub Pages (mostruário)

O Pages só hospeda arquivos estáticos, então nele o site é um **mostruário de demonstração**: tudo (token, agenda, painel) funciona, mas roda no navegador de quem usa e guarda os dados em `localStorage`. **Nada é gravado no repositório** e o que um visitante faz não aparece para outro.

- Painel de demonstração: `/<repositorio>/admin`, senha provisória **`Victor2026`** (`DEMO_PASSWORD` em `src/lib/static/backend.ts`). É só uma trava de vitrine: como o código é público, não protege nada real.
- Para o fluxo de ponta a ponta: no painel, **Agenda → Abrir mês**, **Tokens → Gerar token**, e depois use o código em `/<repositorio>/agendamento` (no mesmo navegador).
- Para limpar a demonstração, apague os dados do site no navegador.

O workflow `.github/workflows/pages.yml` publica a cada push na `main` (**Settings → Pages → Source: GitHub Actions**). Para uso de verdade (clientes reais, dados compartilhados), use a versão com servidor acima.

Para testar o build do Pages localmente: `VITE_STATIC=1 VITE_BASE=/NomeDoRepo/ npm run build:pages` e depois `npx vite preview`.

## Fotos iniciais

As 91 fotos do portfólio vêm de `public/works` (e miniaturas em `public/thumbs`) e entram no banco na primeira execução. Depois disso gerencie tudo pelo painel.
