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

Painel: `http://localhost:5190/admin`. Senha inicial `victor2024` (ou `ADMIN_PASSWORD` do `.env`, antes da 1ª execução). Troque em **Ajustes**.

## Produção

```bash
npm run build
npm start        # um servidor só entrega site + API
```

Veja `.env.example`. Faça backup de `data/` (banco + fotos enviadas). Atrás de proxy, use `TRUST_PROXY=1`.

Para ter tokens, agenda e painel no ar, hospede em algo que rode Node (Render, Railway, VPS…) com build `npm install && npm run build`, start `npm start`, `ADMIN_PASSWORD` definida e um **disco persistente** em `DATA_DIR` (senão banco e fotos enviadas somem a cada deploy).

## GitHub Pages (sem servidor)

O Pages só hospeda arquivos estáticos, então nele o sistema roda **inteiro no navegador** e usa o próprio repositório como banco: o arquivo `state.json` na branch **`data`** (criada sozinha no primeiro login do admin). O workflow `.github/workflows/pages.yml` publica o site a cada push na `main` (**Settings → Pages → Source: GitHub Actions**). Gravar na branch `data` não republica o site.

**Primeiro acesso do Victor (uma vez, por aparelho)**
1. No GitHub: *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate*. Repositório **VictorTatto**, permissão **Contents: Read and write**.
2. Abra `/<repositorio>/admin`, cole a chave e entre. A chave fica só naquele navegador.

**Como o agendamento funciona aqui**
- O Victor gera o token no painel (o código completo e o telefone ficam só no aparelho dele; no repositório vai apenas um hash).
- O cliente digita o token, escolhe dia e horário e toca em **Enviar pedido no WhatsApp**. A mensagem leva um link de confirmação.
- O Victor abre o link (já logado), confere e toca **Confirmar horário**. Aí o horário é gravado, o token é consumido e o dia deixa de oferecer aquele horário.
- Sem servidor não há confirmação automática: o horário só é reservado quando o Victor confirma. Mudanças levam até ~1 minuto para aparecer para os clientes.

**Limites:** o repositório é público, então agenda ocupada, estilos/fotos e primeiro nome de quem agendou ficam visíveis em `state.json` (telefones e códigos, não). Remarcar/cancelar é pelo WhatsApp. Não há senha: quem tiver a chave do GitHub administra o site; revogue a chave no GitHub se perder o aparelho.

Para testar o build do Pages localmente: `VITE_STATIC=1 VITE_BASE=/NomeDoRepo/ npm run build:pages` e depois `npx vite preview`.

## Fotos iniciais

As 91 fotos do portfólio vêm de `public/works` (e miniaturas em `public/thumbs`) e entram no banco na primeira execução. Depois disso gerencie tudo pelo painel.
