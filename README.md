# Lumo

Sistema de gestão da central de atendimento da Venturi Tecnologia: atendentes, desempenho por canal
(Ligação e WhatsApp), ausências, metas, calendário, mapa de posições e importação de planilhas.

- Produção: https://lumo.venturiholding.com.br
- Hospedagem: Vercel (publica sozinho a cada push no `main`)
- Banco e login: Supabase (projeto `lumo`, São Paulo)

## Rodar no seu computador

Pré-requisitos: [Node.js 20+](https://nodejs.org) e pnpm (`npm install -g pnpm`).

```bash
git clone https://github.com/gestaoventuriholding-lang/Lumo.git
cd Lumo
pnpm install
pnpm vite
```

Abra http://localhost:5173 e entre com seu e-mail e senha. Os dados vêm do mesmo banco da produção,
então tudo que você alterar localmente vale para o sistema publicado.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm vite` | Sobe o sistema em modo de desenvolvimento |
| `pnpm vite build` | Gera a versão de produção em `dist/public` |
| `pnpm test` | Roda os testes |
| `pnpm check` | Verifica os tipos do TypeScript |

## Estrutura

```
client/src/
  pages/        telas (Dashboard, Atendentes, Desempenho, Ausências, Calendário, Estruturas, Configurações, Login)
  components/   componentes e ui/ (shadcn)
  contexts/     AuthContext (login), LumoDataContext (dados), preferências, filtro de período
  lib/          cloudStore.ts (sincronização com o Supabase), *Storage.ts, importação, relatórios
supabase/migrations/   esquema do banco (SQL)
prototipos/            protótipos de telas futuras
```

Detalhes de arquitetura, regras do banco e pendências estão em [`CLAUDE.md`](./CLAUDE.md).
