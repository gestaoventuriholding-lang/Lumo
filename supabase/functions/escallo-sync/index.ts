// Ellos: sincronização automática com a Escallo (rel025 ligação + rel090 WhatsApp), por dia.
//
// Quem pode chamar (verify_jwt desligado: esta função confere a autorização por conta própria):
//  1) o agendador do Supabase, com a chave secreta guardada no Vault (cabeçalho x-sync-key). Só modos "hoje" e "fechamento".
//  2) um ADMINISTRADOR logado (JWT), para "simulacao" e "manual" (e também hoje/fechamento);
//  3) qualquer pessoa da EQUIPE logada, só para "agora" (botão "Atualizar agora": hoje, no máximo 1 vez a cada 5 minutos).
//  Qualquer outra chamada recebe 401, sem detalhes.
//
// Proteção:
//  - a chave do agendador nunca está no código: o banco a compara (public.sync_chave_valida) e ela nunca volta numa resposta;
//  - o token da Escallo (ESCALLO_TOKEN) fica só no secret e é tirado de qualquer mensagem, registro ou log;
//  - os logs têm só contagens; nenhum dado de pessoa.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { hojeSaoPaulo, LOGIN_LIMITE_PADRAO_SEGUNDOS, type Colaborador, type RegistroEscallo } from "./mapeamento.ts";
import {
  MODOS_DO_AGENDADOR,
  limiteAtualizarAgora,
  modoRegistrado,
  sincronizar,
  textoSeguro,
  validarPedidoSync,
  type Deps,
  type ResultadoSync,
} from "./sincronizar.ts";

const URL_BASE = "https://checkuplaboratoriodeanalisesclinicasltda-6b2800.escallo.com.br/escallo/api/v1/recurso/relatorio";
const ORIGEM_PERMITIDA = [
  /^https:\/\/ellos\.venturiholding\.com\.br$/,
  /^https:\/\/lumo-lyart\.vercel\.app$/,
];
// Endereços extras permitidos (separados por vírgula), definidos no secret ORIGENS_EXTRAS do projeto. Só o projeto de teste usa (teste.venturiholding.com.br e a pré-visualização da branch teste).
const ORIGENS_EXTRAS = (Deno.env.get("ORIGENS_EXTRAS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const SEM_RESPOSTA_APOS_MIN = 10;

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  const origemHeader = req.headers.get("Origin");
  const origem = origemHeader && (ORIGEM_PERMITIDA.some((re) => re.test(origemHeader)) || ORIGENS_EXTRAS.includes(origemHeader)) ? origemHeader : null;
  const cab: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" };
  if (origem) {
    cab["Access-Control-Allow-Origin"] = origem;
    cab["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    cab["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: cab });

  if (origemHeader && !origem) return json({ error: "Este endereço não pode usar esta função." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cab });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const tokenEscallo = Deno.env.get("ESCALLO_TOKEN");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "A função está sem configuração do Supabase." }, 500);

  // Cliente de serviço: só para ler e gravar o que a sincronização precisa. Nunca é entregue a ninguém.
  const servico = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---- Quem está chamando? ----
  let origemDaChamada: "agendador" | "pessoa";
  let ehAdmin = false;
  const chave = req.headers.get("x-sync-key");
  if (chave) {
    const { data: valida } = await servico.rpc("sync_chave_valida", { p_chave: chave });
    if (valida !== true) {
      console.log("escallo-sync: chave do agendador recusada");
      return json({ error: "Não autorizado." }, 401);
    }
    origemDaChamada = "agendador";
  } else {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!jwt) return json({ error: "Não autorizado." }, 401);
    const comoPessoa = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: usuario } = await comoPessoa.auth.getUser(jwt);
    if (!usuario.user) return json({ error: "Não autorizado." }, 401);
    const { data: admin } = await comoPessoa.rpc("is_admin");
    const { data: daEquipe } = await comoPessoa.rpc("is_member");
    if (admin !== true && daEquipe !== true) return json({ error: "Só a equipe do Ellos pode usar a sincronização." }, 403);
    ehAdmin = admin === true;
    origemDaChamada = "pessoa";
  }

  // ---- Pedido ----
  let texto = "";
  try {
    texto = await req.text();
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }
  if (texto.length > 1000) return json({ error: "Pedido grande demais." }, 413);
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return json({ error: "Pedido inválido: envie um JSON." }, 400);
  }
  const hoje = hojeSaoPaulo();
  const validado = validarPedidoSync(corpo, hoje);
  if ("erro" in validado) return json({ error: validado.erro }, 400);
  const pedido = validado.pedido;
  if (origemDaChamada === "agendador" && !(MODOS_DO_AGENDADOR as readonly string[]).includes(pedido.modo)) {
    return json({ error: "O agendador só pode pedir hoje ou fechamento." }, 403);
  }
  // Quem não é administrador só pode usar o botão "Atualizar agora"
  if (origemDaChamada === "pessoa" && !ehAdmin && pedido.modo !== "agora") {
    return json({ error: "Só administrador pode usar esta ação." }, 403);
  }
  if (!tokenEscallo) {
    return json({ error: "O token da Escallo não está cadastrado. No Supabase, abra Edge Functions, Secrets, e cadastre ESCALLO_TOKEN." }, 500);
  }

  // ---- Liga/desliga geral (só vale para o agendador; uma pessoa pode simular e rodar à mão) ----
  if (origemDaChamada === "agendador") {
    const { data: config } = await servico.from("sync_config").select("enabled").maybeSingle();
    if (!config?.enabled) return json({ pulado: "sincronização desligada" });
  }

  // ---- "Atualizar agora": no máximo 1 atualização a cada 5 minutos (conta qualquer execução que gravou, inclusive a do agendador) ----
  if (pedido.modo === "agora") {
    const { data: ultima } = await servico
      .from("sync_runs")
      .select("finished_at")
      .eq("status", "ok")
      .neq("mode", "simulacao")
      .order("finished_at", { ascending: false })
      .limit(1);
    const fim = ultima && ultima[0]?.finished_at ? new Date(ultima[0].finished_at as string) : null;
    const limite = limiteAtualizarAgora(fim, new Date());
    if (limite) return json({ error: limite.mensagem, atualizadoHaMin: limite.atualizadoHaMin, tenteEmMin: limite.tenteEmMin }, 429);
  }

  // ---- Registro da execução; sem execuções sobrepostas ----
  const inicio = Date.now();
  const limiteParado = new Date(inicio - SEM_RESPOSTA_APOS_MIN * 60_000).toISOString();
  await servico
    .from("sync_runs")
    .update({ status: "erro", error: "execução interrompida (sem resposta em 10 minutos)", finished_at: new Date().toISOString() })
    .eq("status", "executando")
    .lt("started_at", limiteParado);
  const { data: emAndamento } = await servico.from("sync_runs").select("id").eq("status", "executando").limit(1);
  const dias = pedido.modo === "agora" ? [hoje] : (pedido.dias ?? []);
  if (emAndamento && emAndamento.length > 0) {
    await servico.from("sync_runs").insert({
      mode: modoRegistrado(pedido.modo), triggered_by: origemDaChamada, days: dias, status: "pulado",
      finished_at: new Date().toISOString(), error: "execução anterior ainda em andamento", duration_ms: 0,
    });
    return json({ pulado: "execução anterior ainda em andamento" }, 409);
  }
  const { data: corrida, error: erroRegistro } = await servico
    .from("sync_runs")
    .insert({ mode: modoRegistrado(pedido.modo), triggered_by: origemDaChamada, days: dias })
    .select("id")
    .single();
  if (erroRegistro || !corrida) return json({ error: "Não consegui registrar a execução." }, 500);

  const deps: Deps = {
    esperar,
    async buscarRelatorio(rel, dia) {
      return await buscarEscallo(tokenEscallo, rel, dia);
    },
    async lerColaboradores() {
      const { data, error } = await servico.from("attendants").select("id, name, escallo_codigo, terminated_on");
      if (error) throw new Error("não consegui ler os colaboradores");
      return data as Colaborador[];
    },
    async lerLimiteLogin() {
      const { data } = await servico.from("productivity_limits").select("limit_value, status").eq("metric", "login_max_hours").maybeSingle();
      if (!data) return LOGIN_LIMITE_PADRAO_SEGUNDOS;
      const horas = Number(data.limit_value);
      return data.status === "Ativo" ? (horas > 0 ? Math.round(horas * 3600) : LOGIN_LIMITE_PADRAO_SEGUNDOS) : null;
    },
    async aplicarDia(plano) {
      const { data, error } = await servico.rpc("aplicar_sync_dia", { p: { dia: plano.dia, linhas: plano.linhas, alertas: plano.alertas } });
      if (error) throw new Error(`não consegui gravar o dia ${plano.dia}`);
      return data;
    },
  };

  let resultado: ResultadoSync | null = null;
  try {
    resultado = await sincronizar(deps, pedido, hoje);
    await servico.from("sync_runs").update({
      status: "ok", finished_at: new Date().toISOString(), days: resultado.dias,
      rel025_agents: resultado.totais.rel025Agentes, rel090_agents: resultado.totais.rel090Agentes,
      rows_inserted: resultado.gravacao.inseridas, rows_updated: resultado.gravacao.atualizadas,
      rows_skipped_manual: resultado.gravacao.puladas_manuais, login_blanked: resultado.totais.loginEsvaziado,
      alerts_created: resultado.gravacao.alertas_novos, unlinked_with_activity: resultado.totais.semVinculoComAtendimento,
      ignored_terminated: resultado.totais.ignoradosDesligados, warnings: resultado.avisos.slice(0, 50),
      duration_ms: Date.now() - inicio,
    }).eq("id", corrida.id);
    console.log(`escallo-sync: ${pedido.modo} ${resultado.dias.join(",")} ok (${resultado.gravacao.inseridas} novas, ${resultado.gravacao.atualizadas} atualizadas)`);
    return json({ ok: true, modo: pedido.modo, gravou: resultado.gravou, dias: resultado.dias, gravacao: resultado.gravacao, totais: resultado.totais, planos: resultado.planos });
  } catch (e) {
    const mensagem = textoSeguro(e, tokenEscallo);
    await servico.from("sync_runs").update({
      status: "erro", finished_at: new Date().toISOString(), error: mensagem, duration_ms: Date.now() - inicio,
    }).eq("id", corrida.id);
    console.log(`escallo-sync: ${pedido.modo} erro: ${mensagem}`);
    return json({ ok: false, error: mensagem }, 502);
  }
});

/** Uma chamada por dia (a paginação da Escallo não funciona): confere a quantidade e tenta de novo se falhar. */
async function buscarEscallo(token: string, rel: "rel025" | "rel090", dia: string): Promise<RegistroEscallo[]> {
  let ultimoErro = "";
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const resposta = await fetch(`${URL_BASE}/${rel}/?registros=100&pagina=0`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Partner ${token}` },
        body: JSON.stringify({ dataInicial: dia, dataFinal: dia, horarioInicial: "00:00:01", horarioFinal: "23:59:59", exibirUsuarioSistema: "1" }),
        signal: AbortSignal.timeout(30_000),
      });
      const j = await resposta.json().catch(() => null);
      const registros = j?.data?.registros;
      if (resposta.ok && Array.isArray(registros)) {
        const quantidade = Number(j.data.quantidade);
        if (!Number.isFinite(quantidade) || quantidade === registros.length) return registros as RegistroEscallo[];
        ultimoErro = `a Escallo informou ${quantidade} registros e enviou ${registros.length}`;
      } else if (resposta.ok && j && (registros === null || registros === undefined)) {
        return []; // dia sem movimento
      } else {
        ultimoErro = `HTTP ${resposta.status}`;
      }
    } catch (e) {
      ultimoErro = textoSeguro(e, token, 120);
    }
    if (tentativa < 3) await esperar(3000 * tentativa);
  }
  throw new Error(`${rel} ${dia}: ${textoSeguro(ultimoErro, token, 200)}`);
}
