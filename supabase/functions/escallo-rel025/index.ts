// Ellos: busca o relatório rel025 (produtividade dos agentes de voz) da Escallo para UM dia.
// FASE A: só lê e devolve a prévia do que seria gravado. NÃO grava nada no banco.
//
// Proteção:
//  - exige login (JWT) e confere se a pessoa é da equipe (public.is_member());
//  - o token da Escallo fica só no secret ESCALLO_TOKEN e nunca volta na resposta nem vai para os logs;
//  - só o Ellos oficial, o localhost e as pré-visualizações da Vercel podem chamar pelo navegador.
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  ligarColaboradores,
  totaisDoPreview,
  validarPedido,
  hojeSaoPaulo,
  LOGIN_LIMITE_PADRAO_SEGUNDOS,
  type Colaborador,
  type RegistroEscallo,
} from "./mapeamento.ts";

const URL_ESCALLO =
  "https://checkuplaboratoriodeanalisesclinicasltda-6b2800.escallo.com.br/escallo/api/v1/recurso/relatorio/rel025/?registros=100&pagina=0";

const ORIGENS_PERMITIDAS = [
  /^https:\/\/ellos\.venturiholding\.com\.br$/,
  /^https:\/\/lumo-lyart\.vercel\.app$/,
  // Pré-visualizações da Vercel. "lumo-" é o nome atual do projeto; "ellos-" vale depois que ele for renomeado.
  // Os dois ficam aceitos durante a troca de nome.
  /^https:\/\/lumo-git-[a-z0-9-]+-venturi-holding\.vercel\.app$/,
  /^https:\/\/ellos-git-[a-z0-9-]+-venturi-holding\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
];

function origemPermitida(origem: string | null): string | null {
  return origem && ORIGENS_PERMITIDAS.some((re) => re.test(origem)) ? origem : null;
}

function cabecalhos(origem: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (origem) {
    h["Access-Control-Allow-Origin"] = origem;
    h["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  return h;
}

Deno.serve(async (req: Request) => {
  const origemHeader = req.headers.get("Origin");
  const origem = origemPermitida(origemHeader);
  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: cabecalhos(origem) });

  // Chamadas de navegador de outro site são recusadas. Chamadas sem Origin (servidor, curl) passam,
  // mas continuam precisando de login e de ser da equipe.
  if (origemHeader && !origem) return json({ error: "Este endereço não pode usar esta função." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhos(origem) });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  // ---- Quem está chamando? ----
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jwt) return json({ error: "Faça login para continuar." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "A função está sem configuração do Supabase." }, 500);

  // Cliente com a identidade de quem chamou: as regras de acesso (RLS) valem, não usamos a chave de serviço.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: usuario } = await supabase.auth.getUser(jwt);
  if (!usuario.user) return json({ error: "Sua sessão expirou. Entre de novo." }, 401);
  const { data: daEquipe } = await supabase.rpc("is_member");
  if (daEquipe !== true) return json({ error: "Só a equipe do Ellos pode buscar dados da Escallo." }, 403);

  // ---- Pedido ----
  const token = Deno.env.get("ESCALLO_TOKEN");
  if (!token) {
    return json(
      { error: "O token da Escallo não está cadastrado. No Supabase, abra Edge Functions → Secrets e cadastre ESCALLO_TOKEN." },
      500
    );
  }
  const esconder = (t: unknown) => String(t ?? "").split(token).join("***");

  let texto: string;
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
  const validado = validarPedido(corpo, hojeSaoPaulo());
  if ("erro" in validado) return json({ error: validado.erro }, 400);
  const { dia, exibirUsuarioSistema } = validado.pedido;

  // ---- Escallo (uma chamada só; a paginação deles não funciona, então conferimos a quantidade) ----
  let resposta: Response;
  try {
    resposta = await fetch(URL_ESCALLO, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Partner ${token}` },
      // Sem campos de agente: a Escallo recusa agente vazio ("Agente não encontrado").
      body: JSON.stringify({
        dataInicial: dia,
        dataFinal: dia,
        horarioInicial: "00:00:01",
        horarioFinal: "23:59:59",
        exibirUsuarioSistema,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return json({ error: "Não consegui falar com a Escallo (sem resposta em 30 segundos). Tente de novo em instantes." }, 502);
  }

  let dadosEscallo: { code?: unknown; message?: unknown; data?: { quantidade?: unknown; registros?: unknown } } | null = null;
  try {
    dadosEscallo = await resposta.json();
  } catch {
    /* tratado abaixo */
  }
  if (!resposta.ok || !dadosEscallo || (dadosEscallo.code !== undefined && Number(dadosEscallo.code) !== 200)) {
    const motivo = esconder(dadosEscallo?.message).slice(0, 200);
    console.log(`escallo-rel025: Escallo respondeu HTTP ${resposta.status}`);
    return json(
      { error: `A Escallo recusou o pedido (HTTP ${resposta.status}${motivo ? `: ${motivo}` : ""}). Se o erro continuar, confira o token.` },
      502
    );
  }

  const registros = Array.isArray(dadosEscallo.data?.registros) ? (dadosEscallo.data!.registros as RegistroEscallo[]) : null;
  if (!registros) return json({ error: "A resposta da Escallo veio em um formato diferente do esperado." }, 502);
  const quantidade = Number(dadosEscallo.data?.quantidade);
  if (Number.isFinite(quantidade) && quantidade !== registros.length) {
    return json(
      { error: `A Escallo informou ${quantidade} registros, mas enviou ${registros.length}. Não vou usar um relatório incompleto.` },
      502
    );
  }

  // ---- Colaboradores (só leitura, com as regras de acesso de quem chamou) ----
  let migracaoPendente = false;
  let colaboradores: Colaborador[] = [];
  const comCodigo = await supabase.from("attendants").select("id, name, escallo_codigo");
  if (comCodigo.error) {
    if (comCodigo.error.code === "42703") {
      // A coluna escallo_codigo ainda não existe (migração não aplicada): segue sem códigos.
      migracaoPendente = true;
      const semCodigo = await supabase.from("attendants").select("id, name");
      if (semCodigo.error) return json({ error: "Não consegui ler os colaboradores. Tente de novo." }, 500);
      colaboradores = semCodigo.data as Colaborador[];
    } else {
      return json({ error: "Não consegui ler os colaboradores. Tente de novo." }, 500);
    }
  } else {
    colaboradores = comCodigo.data as Colaborador[];
  }

  // Limite de login por dia (Configurações → limites; padrão 12 h; limite desligado = regra desligada)
  let limiteLogin: number | null = LOGIN_LIMITE_PADRAO_SEGUNDOS;
  const limite = await supabase.from("productivity_limits").select("limit_value, status").eq("metric", "login_max_hours").maybeSingle();
  if (!limite.error && limite.data) {
    const horas = Number(limite.data.limit_value);
    limiteLogin = limite.data.status === "Ativo" ? (horas > 0 ? Math.round(horas * 3600) : LOGIN_LIMITE_PADRAO_SEGUNDOS) : null;
  }

  const { vinculados, sobras } = ligarColaboradores(registros, colaboradores, dia, limiteLogin);
  const comLoginDesconsiderado = vinculados.filter((v) => v.loginDesconsiderado);
  console.log(
    `escallo-rel025: dia ${dia}, ${registros.length} registros, ${vinculados.length} ligados, ${sobras.length} sobras, ${comLoginDesconsiderado.length} com login desconsiderado`
  );

  return json({
    fase: "A",
    gravou: false,
    dia,
    migracaoPendente,
    escallo: { registros: registros.length },
    resumo: {
      vinculados: vinculados.length,
      semVinculo: sobras.filter((s) => s.motivo === "sem_vinculo").length,
      paraRevisar: sobras.filter((s) => s.motivo === "revisar").length,
      comSugestaoPorNome: sobras.filter((s) => s.sugestao).length,
      comLoginDesconsiderado: comLoginDesconsiderado.length,
    },
    limiteLoginSegundos: limiteLogin,
    // Quem passou do limite de login: grava os atendimentos, deixa login/pausa/ocupação vazios e gera alerta para o gestor
    loginDesconsiderado: comLoginDesconsiderado.map((v) => ({
      attendantId: v.attendantId,
      escalloCodigo: v.escalloCodigo,
      loginSegundos: v.loginDesconsiderado!.loginSegundos,
      limiteSegundos: v.loginDesconsiderado!.limiteSegundos,
    })),
    totaisDoQueSeriaGravado: totaisDoPreview(vinculados),
    vinculados,
    sobras,
  });
});
