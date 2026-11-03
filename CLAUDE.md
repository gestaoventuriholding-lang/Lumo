# Ellos — contexto para o Claude Code

O produto se chama **Ellos** (antes Lumo, depois Elos): sistema de gestão de central de atendimento (call center) da Venturi Tecnologia.
Identidade visual: neutros quentes + laranja da prancha de marca (#FF6B00; #FF8A00 no modo escuro), fontes Inter
(interface) e Manrope (títulos, KPIs e logo); logo provisório em texto em `client/src/components/EllosLogo.tsx`
(trocar por `client/public/brand/ellos-symbol.svg` e `ellos-logo.svg` quando os arquivos existirem). O nome mudou em todo o código: chaves de armazenamento (`ellos-*`), classes CSS
(`ellos-*`), `EllosDataContext`. No primeiro acesso, `migrateLegacyStorageKeys()` (`storageMigration.ts`) copia as
chaves antigas `lumo-*` para `ellos-*`, então ninguém perde dados nem sessão. **Continuam com o nome antigo** só as peças
externas: repositório GitHub, projeto Vercel, domínio `lumo.venturiholding.com.br` e projeto Supabase `lumo`.
Dona do produto: Amanda Silva (CEO). Fale em português do Brasil.

## Onde tudo está

| Peça | Onde |
|---|---|
| Código | GitHub `gestaoventuriholding-lang/Lumo`, branch `main` |
| Produção | https://lumo.venturiholding.com.br (reserva: https://lumo-lyart.vercel.app) |
| Hospedagem | Vercel, equipe "Venturi Holding", projeto `lumo`. Cada push no `main` publica sozinho |
| DNS | Cloudflare (`venturiholding.com.br`): CNAME `lumo` → Vercel, proxy desligado |
| Banco e login | Supabase, projeto `lumo` (ref `uvhweshxiexbrjcqgvnu`, região São Paulo), conta amanda.silva@venturiholding.com.br |

## Comandos

```bash
pnpm install        # dependências (pnpm 10)
pnpm vite           # front em modo dev (http://localhost:5173) — é o que vai para a Vercel
pnpm vite build     # build de produção em dist/public
pnpm test           # vitest (todos devem passar)
pnpm check          # tsc — está em 0 erros; mantenha assim
```

Não existe servidor próprio: o projeto é só o front em `client/` (o servidor tRPC/Express e o drizzle do
template do Manus foram removidos).

## Arquitetura

- React 19 + Vite + Tailwind 4 + shadcn/ui (Radix) + Recharts + Framer Motion + wouter (rotas).
- Front estático na Vercel. **O app não usa servidor próprio**: fala direto com o Supabase.

### Login e acesso
- `client/src/lib/supabase.ts`: cliente Supabase. A chave ali é a **publicável** (feita para ficar no
  navegador). Pode ser trocada por `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `client/src/contexts/AuthContext.tsx`: sessão, login, recuperação de senha, papel de admin.
- `client/src/components/AuthGate.tsx`: só renderiza o sistema depois do login **e** da carga dos dados.
  Os providers de dados ficam dentro dele porque leem o armazenamento ao montar.
- `client/src/pages/Login.tsx`: tela de login / esqueci a senha / nova senha.
- `client/src/_core/hooks/useAuth.ts`: hook usado pelas telas (`user`, `isAdmin`, `logout`).

### Dados (ponto mais importante)
- As telas leem e gravam pelas funções `load*` / `save*` dos módulos `client/src/lib/*Storage.ts`,
  de forma **síncrona**, como faziam com o localStorage.
- `client/src/lib/cloudStore.ts` decide o destino:
  - sem login (testes): localStorage;
  - com login: cache em memória carregado do Supabase em `hydrateCloud()`; cada `save*` atualiza o
    cache e envia ao banco **só o que mudou** (exclusões antes de inclusões), numa fila em ordem.
- Mapeamento app (camelCase) ↔ banco (snake_case) fica em `COLLECTIONS` dentro de `cloudStore.ts`.
  Ao criar campo novo: migração SQL + `toRow`/`fromRow` + tipo em `client/src/types`.
- IDs: sempre `newId()` de `client/src/lib/ids.ts` (único global). **Nunca** "maior ID + 1".
- Ficam só no navegador (são de cada pessoa): filtro de período (`periodFilterStorage`), alertas lidos
  (`alertStateStorage`) e tema.
- No primeiro login, se o banco estiver vazio e o navegador tiver dados antigos, eles são enviados
  (com IDs novos) — ver `migrateLocalData()`.

### Banco (Supabase)
- Migrações em `supabase/migrations/` (aplicadas manualmente no editor SQL ou pelo MCP do Supabase).
- Tabelas: `attendants`, `performance_records`, `absences`, `calendar_events`, `production_goals`,
  `role_goals`, `structure_layouts` (layout único e compartilhado), `import_logs`, `productivity_reports`,
  `user_preferences` (1 por usuário, inclui `analysis_note`), `admins`, `members`.
- RLS em todas: os dados são **compartilhados pela equipe**. Quem está em `members` (ou `admins`) lê e
  altera tudo (`public.is_member()`); visitante anônimo e conta sem acesso não veem nada. Só o admin
  gerencia usuários, pela Edge Function `gerenciar-usuarios` (aba Usuários).
- `performance_records` e `absences` herdam o `owner_id` do atendente (gatilho `check_attendant_owner`).
- O e-mail amanda.silva@venturiholding.com.br vira admin automaticamente ao criar a conta
  (gatilho `ellos_grant_admin_on_signup`).
- Toda mudança de esquema vira um arquivo novo em `supabase/migrations/` e depois rode os advisors
  de segurança do Supabase.

## Convenções
- Textos da interface em português, voz ativa, botões dizem o que fazem ("Salvar meta").
- Mensagens de erro dizem o que houve e como resolver.
- Commits em português. Rode `pnpm test` e `pnpm vite build` antes de enviar.
- Não reintroduza nada do Manus (login, plugins `vite-plugin-manus-runtime`, `debug-collector`).

## Direção de produto (o que a Amanda pediu)
- Visual: sóbrio, claro e escuro, **sem gradiente, glow, vidro (blur), sombra colorida nem emoji**. Laranja só em
  botão primário, item ativo do menu, link e série principal dos gráficos (menos de 10% da tela). Raio 8px
  (badge 6px), sombra única `0 1px 2px`, ícones lucide com traço 1.5. Números sempre `tabular-nums`.
  Tokens de cor em `client/src/index.css` (usar `success`, `warning`, `danger`, `primary-soft`; nada de
  `blue-600` e similares). Cores de gráfico só em `client/src/lib/chartTheme.ts`.
- O Ellos é **gestão das pessoas com dados de relatórios** (importados, como o REL090). **Não terá nada ao
  vivo**: sem painel em tempo real, filas ou integração com telefonia. O protótipo
  `prototipos/central-operacao.html` não vai ser implementado.
- Canais da central: Ligação e WhatsApp. Contexto: laboratório/clínica.

## Pendências conhecidas
1. Cadastro público no Supabase ainda ligado (qualquer um com o link pode criar conta vazia).
   Sugestão já feita: desligar em Authentication → Sign In / Providers → "Allow new users to sign up".
