# Ellos — contexto para o Claude Code

O produto se chama **Ellos** (antes Lumo, depois Elos): sistema de gestão de central de atendimento (call center) da Venturi Tecnologia.
Identidade visual: neutros quentes + laranja da prancha de marca (#FF6B00; #FF8A00 no modo escuro), fontes Inter
(interface) e Manrope (títulos, KPIs e logo). O símbolo (dois elos entrelaçados, laranja + branco/escuro) é um SVG
redesenhado a partir da prancha de marca, em `client/src/components/EllosLogo.tsx` (menu aberto: símbolo + "Ellos";
fechado: só o símbolo); favicon em `client/public/brand/ellos-favicon.svg`. Os arquivos oficiais
(`ellos-symbol.svg`, `ellos-logo.svg`) ainda não foram entregues: trocar quando existirem. O nome mudou em todo o código: chaves de armazenamento (`ellos-*`), classes CSS
(`ellos-*`), `EllosDataContext`. No primeiro acesso, `migrateLegacyStorageKeys()` (`storageMigration.ts`) copia as
chaves antigas `lumo-*` para `ellos-*`, então ninguém perde dados nem sessão. Os projetos da Vercel e do Supabase já se
chamam `ellos` (a URL e o ref do banco não mudam). **Continua com o nome antigo** só o repositório GitHub (`Lumo`); o domínio
`lumo.venturiholding.com.br` e o alias `lumo-lyart.vercel.app` ainda respondem, sem redirecionamento para o `ellos`.
Dona do produto: Amanda Silva (CEO). Fale em português do Brasil.

## Onde tudo está

| Peça | Onde |
|---|---|
| Código | GitHub `gestaoventuriholding-lang/Lumo`, branch `main` |
| Produção | https://ellos.venturiholding.com.br (o antigo https://lumo.venturiholding.com.br e https://lumo-lyart.vercel.app ainda respondem) |
| Hospedagem | Vercel, equipe "Venturi Holding", projeto `ellos`. Cada push no `main` publica sozinho; cada branch ganha uma pré-visualização `ellos-git-<branch>-venturi-holding.vercel.app` **que usa o MESMO banco da produção** |
| DNS | Cloudflare (`venturiholding.com.br`): CNAMEs `ellos` e `lumo` → Vercel, proxy desligado |
| Banco e login | Supabase, projeto `ellos` (ref `uvhweshxiexbrjcqgvnu`, região São Paulo), conta amanda.silva@venturiholding.com.br |

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
  `user_preferences` (1 por usuário, inclui `analysis_note`), `admins`, `members`, `productivity_limits` (limites de pausa,
  ocupação e tempo logado), `incidents` (ocorrências;
  chave `ellos-incidents`; `attendant_id` vira nulo se a pessoa for excluída, e `attendant_name` guarda o nome) e
  `login_alerts` (alertas de tempo logado desconsiderado; ver "Integração com a Escallo"). `attendants` tem a coluna
  `escallo_codigo` (código do agente na Escallo; único; vazio = não vinculado).
- RLS em todas: os dados são **compartilhados pela equipe**. Quem está em `members` (ou `admins`) lê e
  altera tudo (`public.is_member()`); visitante anônimo e conta sem acesso não veem nada. Só o admin
  gerencia usuários, pela Edge Function `gerenciar-usuarios` (aba Usuários).
- `performance_records`, `productivity_reports`, `absences` e `login_alerts` herdam o `owner_id` do atendente (gatilho `check_attendant_owner`).
- O e-mail amanda.silva@venturiholding.com.br vira admin automaticamente ao criar a conta. O gatilho no banco ainda se
  chama `lumo_grant_admin_on_signup`: a migração que o renomeia para `ellos_grant_admin_on_signup`
  (`20261031120000`) **ainda não foi aplicada**.
- Backups pontuais de dados ficam no schema `backup_fase_b` (fora da API; não apagar sem a Amanda pedir).
- A versão gravada pelo Supabase numa migração aplicada pelo MCP tem a data/hora da aplicação; o arquivo no repositório usa
  a mesma versão (renomeie o arquivo depois de aplicar). Desfazeres ficam em `supabase/desfazer/` (não são migrações).
- Toda mudança de esquema vira um arquivo novo em `supabase/migrations/` e depois rode os advisors
  de segurança do Supabase.

## Convenções
- Textos da interface em português, voz ativa, botões dizem o que fazem ("Salvar meta").
- Nada vai para o ar sem a Amanda aprovar: migração, publicação de função, merge na `main` e gravação de dados reais
  (sempre com backup antes e simulação primeiro).
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
- **Ocorrências** (rota `/incidents`, `pages/Incidents.tsx`, `lib/incidentStorage.ts`, tabela `incidents`): registro
  de reclamações, erros de agendamento e agendamentos incorretos. Identifica o atendimento pelo **protocolo da
  Escallo**, nunca por nome ou CPF do paciente (LGPD): o formulário avisa, sem bloquear, se o texto parece ter CPF
  ou e-mail. Situação: aberta → em tratamento → resolvida; resolver exige a ação tomada. O Ellos só guarda e copia o
  protocolo: **não puxa conversa nem gravação da Escallo** (sem integração).

## Integração com a Escallo (relatórios do dia, nunca ao vivo)
A API da Escallo é lida **por dia fechado**, para trazer os relatórios sem baixar planilha. Continua valendo: nada em tempo real.
- **Função** `supabase/functions/escallo-rel025` (Edge Function, `verify_jwt` ligado, só lê): exige login e que a pessoa seja da
  equipe (`is_member`), chama o rel025 (ligação) de **um dia**, liga cada agente ao colaborador pelo **código** e devolve a prévia
  (`vinculados`, `sobras`, `loginDesconsiderado`). Não grava nada. O token fica só no secret `ESCALLO_TOKEN` do Supabase (nunca no
  código, no chat ou em log). A lista de origens permitidas está em `ORIGENS_PERMITIDAS` (aceita `lumo-` e `ellos-`).
  Lógica pura e testável em `mapeamento.ts` (testes em `client/src/lib/escalloRel025.test.tsx`). Para rodar local: `npx deno`.
- **Vínculo** (rota `/escallo-vinculos`, botão em Atendentes): sugere o colaborador pelo nome, mas **só vincula o que a pessoa confirma**; nunca
  cria colaborador. O campo "Código Escallo" também se edita no cadastro. `?demo=1` abre uma demonstração com dados inventados e
  **só existe em pré-visualização** (`demoPermitida`); nunca no oficial.
- **rel025** (ligação) e **rel090** (WhatsApp): o `codigo` do agente é o mesmo nos dois. Ligação = entrada + saída atendidas
  (`ligacoesOferecidasAtendidas` + `ligacoesRealizadasAtendidas`). Tempos em segundos. TO3/TO4 vêm 0 (jornada não configurada na Escallo) e viram vazio.
  Ignore a linha `_media` do rel090 e importe só agentes **vinculados a colaboradores** (os demais são supervisores, campanha de confirmação etc.).
  A paginação da Escallo não funciona: chame uma vez por dia e confira `quantidade`.
- **Login e pausa são do agente**, iguais nos dois canais. Por isso só se grava Ligação para quem teve atendimento de ligação.
- **Regra do tempo logado acima do limite** (padrão **12 h por dia**, configurável em Configurações → limites, métrica `login_max_hours`;
  limite desligado = regra desligada): os atendimentos são gravados, mas login, pausa (todas), ocupação 1–4 e chamadas por hora do dia
  ficam **vazios nos dois canais** e gera-se um alerta. Lógica em `client/src/lib/loginLimit.ts` (usada pela importação de planilhas
  e pela função). Só vale para relatório de **um dia**; relatório de período não passa pela regra.
- **Alertas** (`login_alerts`, um por colaborador e dia): aparecem no sininho com "Tempo logado desconsiderado — verificar se a
  pessoa deslogou"; o gestor marca **visto** (continua na lista) ou **resolvido** (sai). A situação é compartilhada pela equipe
  (diferente dos outros alertas do sino, que guardam "lido" só no navegador e zeram todo dia). Pré-visualização: `?demoalerta=1`.
- **Colaborador desligado** (`attendants.active` + `terminated_on`, o ÚLTIMO DIA TRABALHADO): a pessoa continua nos históricos dos dias em que trabalhou e some das listas de escolha (desempenho, faltas, ocorrências) a partir do dia seguinte. A sincronização com a Escallo não grava nada dela depois dessa data e registra um aviso em `sync_runs.warnings` (`ignored_terminated`). Quem não está cadastrado segue ignorado.
- **Canal "Ligação e WhatsApp"** (cadastro do colaborador): a pessoa aparece nos dois canais (`attendsChannel` em `lib/attendantStatus.ts`). Os registros de desempenho continuam sempre em um canal só.
- **Função do colaborador** (`attendants.role`: Atendente ou Confirmação de agenda, separada do canal): quem é de Confirmação de agenda fica FORA de rankings, médias, metas e contagens do atendimento (hook `useAtendimentoData`, regra em `lib/attendantRole.ts`) e aparece à parte (cartão "Confirmação de agenda", sem meta: "—"). Continua no mapa de ocupação (com selo), nos lançamentos, nos alertas de login e na sincronização. A meta própria será definida em Configurações (`role_goals`, ainda não usada).
- **Regras do setor** (rota `/rules`, `pages/Rules.tsx`, `lib/ruleLogic.ts`, tabelas `rules` e `rule_signatures`): gestores cadastram regras e marcam quem assinou e quando ("marcar todos" com a data do treinamento + ajuste individual). Depois da primeira assinatura o texto trava (gatilho `rules_travar_texto`): muda-se criando uma NOVA VERSÃO (a antiga fica arquivada com as assinaturas). Desligado só deixa de contar como pendente depois do último dia trabalhado; quem entrou depois aparece como pendente. Anexos (lista de presença) ficam para depois.
- **Ambientes**: o app só usa o banco de produção nos endereços oficiais; `teste.venturiholding.com.br` (branch `teste`) e todos os previews usam o banco `ellos-teste` (variáveis `VITE_SUPABASE_*` da Vercel no escopo Preview). Migração nova roda primeiro no `ellos-teste` e só vai para a produção com o "pode publicar". Estrutura e dados inventados do teste: `supabase/ambiente-teste/`.
- **Gravação de dados da Escallo** ainda não é um botão no app: foi feita em scripts locais (pasta `scripts/`, não versionada),
  sempre com simulação, backup e desfazer. A Fase B de 29/10 gravou só Ligação (8 colaboradores) com origem `API Escallo`.

## Pendências conhecidas
1. Cadastro público no Supabase ainda ligado (qualquer um com o link pode criar conta vazia).
   Sugestão já feita: desligar em Authentication → Sign In / Providers → "Allow new users to sign up".
2. Troca de nome Lumo → Ellos: faltam renomear o repositório GitHub, redirecionar `lumo.venturiholding.com.br`, conferir "Site URL"
   e "Redirect URLs" do Supabase Auth e depois remover os padrões `lumo-` do código (`ORIGENS_PERMITIDAS`, `demoPermitida`).
3. Importar de 01/10 em diante os dados da API (ligação e WhatsApp): depende de aprovação, simulação e backup.
4. Aviso do Supabase: `rls_auto_enable()` executável por visitante e por logado (verificar se é intencional).
