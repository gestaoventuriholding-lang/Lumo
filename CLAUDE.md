# Lumo — contexto para o Claude Code

O produto se chama **Elos** (antes Lumo): sistema de gestão de central de atendimento (call center) da Venturi Tecnologia.
Identidade visual: marinho #0B1F44, azul #3366FF, azul claro #7BA7FF, gelo #E6EDF7, branco; fonte Inter; logo em
`client/src/components/ElosLogo.tsx`. Só o texto visível mudou: chaves de armazenamento (`lumo-*`), classes CSS
(`lumo-*`), `LumoDataContext`, o repositório e o projeto Supabase continuam com o nome antigo de propósito
(renomear apagaria os dados já salvos nos navegadores).
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
pnpm test           # vitest (60 testes, todos devem passar)
pnpm check          # tsc — ainda há ~56 erros ANTIGOS (ver "Pendências"); não aumente esse número
```

Não use `pnpm dev`: ele sobe o servidor Express/tRPC herdado do template, que não é usado em produção.

## Arquitetura

- React 19 + Vite + Tailwind 4 + shadcn/ui (Radix) + Recharts + Framer Motion + wouter (rotas).
- Front estático na Vercel. **O app não usa servidor próprio**: fala direto com o Supabase.
- `server/`, `drizzle/`, `shared/` e o tRPC em `client/src/lib/trpc.ts` são sobras do template do Manus.
  Ainda compilam, mas nada em produção depende deles. Podem ser removidos com cuidado.

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
  `role_goals`, `structure_layouts` (1 por usuário), `import_logs`, `user_preferences` (1 por usuário,
  inclui `analysis_note`), `admins`.
- RLS em todas: cada usuário só vê/altera linhas com `owner_id = auth.uid()`; quem está em `admins`
  vê e altera tudo (`public.is_admin()`). Visitante anônimo não acessa nada.
- `performance_records` e `absences` herdam o `owner_id` do atendente (gatilho `check_attendant_owner`).
- O e-mail amanda.silva@venturiholding.com.br vira admin automaticamente ao criar a conta
  (gatilho `lumo_grant_admin_on_signup`).
- Toda mudança de esquema vira um arquivo novo em `supabase/migrations/` e depois rode os advisors
  de segurança do Supabase.

## Convenções
- Textos da interface em português, voz ativa, botões dizem o que fazem ("Salvar meta").
- Mensagens de erro dizem o que houve e como resolver.
- Commits em português. Rode `pnpm test` e `pnpm vite build` antes de enviar.
- Não reintroduza nada do Manus (login, plugins `vite-plugin-manus-runtime`, `debug-collector`).

## Direção de produto (o que a Amanda pediu)
- Visual novo: **azul claro, estilo glassmorfismo** (vidro translúcido com desfoque sobre fundo
  azul-céu, com tema escuro também). Hoje o app ainda está no visual antigo (azul royal, Inter).
  Os tokens de cor ficam em `client/src/index.css`.
- Trazer telas de **operação ao vivo**, a partir do protótipo `prototipos/central-operacao.html`
  (painel com KPIs do momento, atendimentos em andamento com ficha do paciente, status dos agentes,
  filas com nível de serviço, consulta rápida com ramais e procedimentos).
- Canais da central: Ligação e WhatsApp. Contexto: laboratório/clínica.

## Pendências conhecidas
1. Decidir o modelo de acesso: hoje cada usuário vê só o que é dele e o admin vê tudo. A Amanda vai
   decidir depois se a equipe terá conta própria ou uma conta compartilhada da central.
2. Cadastro público no Supabase ainda ligado (qualquer um com o link pode criar conta vazia).
   Sugestão já feita: desligar em Authentication → Sign In / Providers → "Allow new users to sign up".
3. ~56 erros de TypeScript antigos (variantes do framer-motion em `Attendants.tsx`, `GoalsManagement.tsx`,
   `NotificationCenter.tsx` etc., e `baseUrl`/target no `tsconfig.json`). O build passa mesmo assim.
4. Tela `client/src/pages/Home.tsx` (painel com assistente de importação) existe mas não tem rota.
5. Como admin, "Limpar todos os dados" em Configurações apaga os dados de **todos** os usuários.
6. Remover sobras do template (servidor tRPC, drizzle, `netlify.toml`, docs antigos).
