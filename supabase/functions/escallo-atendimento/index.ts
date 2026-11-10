// Ellos: mostra, na hora, a conversa do WhatsApp ou toca a gravação da ligação de UM atendimento (auditoria).
// SÓ LÊ. Não grava nada no banco e não guarda conversa nem áudio em lugar nenhum (LGPD): a conversa vai da Escallo
// para a tela de quem audita e o áudio é repassado como som.
//
// Proteção:
//  - exige login (JWT) e que a pessoa seja da equipe (public.is_member());
//  - o token da Escallo fica só no secret ESCALLO_TOKEN. O áudio é buscado AQUI (o endereço da Escallo leva o token)
//    e repassado como som: o token nunca chega ao navegador e nunca vai para log;
//  - só o Ellos oficial (e o alias antigo) pode chamar pelo navegador; pré-visualizações e localhost ficam de fora
//    (o teste usa ORIGENS_EXTRAS, mas lá não há token: a tela usa conversa e áudio inventados).
//
// Pedidos (POST, JSON):
//  { canal: "WhatsApp", protocolo, dia }                       -> { tipo: "conversa", ... }
//  { canal: "Ligação",  protocolo, dia }                       -> { tipo: "ligacao", uniqueid, ... } (acha a ligação no rel002)
//  { canal: "Ligação",  acao: "audio", uniqueid }              -> o som (application/octet-stream)
import { createClient } from "jsr:@supabase/supabase-js@2";

const HOST_ESCALLO = "https://checkuplaboratoriodeanalisesclinicasltda-6b2800.escallo.com.br";
const URL_HISTORICO = `${HOST_ESCALLO}/escallo/api/v1/recurso/relatorio/historicoMensagens/?registros=25&pagina=0`;
const URL_REL002 = `${HOST_ESCALLO}/escallo/api/v1/recurso/relatorio/rel002/?registros=5000&pagina=0`;
const URL_AUDIO = `${HOST_ESCALLO}/escallo/api/Ligacao/FindAudio/`;
const LIMITE_AUDIO_BYTES = 40 * 1024 * 1024;

const ORIGENS_PERMITIDAS = [
  /^https:\/\/ellos\.venturiholding\.com\.br$/,
  /^https:\/\/lumo-lyart\.vercel\.app$/,
];
const ORIGENS_EXTRAS = (Deno.env.get("ORIGENS_EXTRAS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
function origemPermitida(origem: string | null): string | null {
  return origem && (ORIGENS_PERMITIDAS.some((re) => re.test(origem)) || ORIGENS_EXTRAS.includes(origem)) ? origem : null;
}

function cabecalhos(origem: string | null, tipo = "application/json"): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": tipo, "Cache-Control": "no-store", Vary: "Origin" };
  if (origem) {
    h["Access-Control-Allow-Origin"] = origem;
    h["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  return h;
}

const PROTOCOLO_OK = /^[A-Za-z0-9._-]{1,60}$/;
const DIA_OK = /^\d{4}-\d{2}-\d{2}$/;
const UNIQUEID_OK = /^\d{6,15}\.\d{1,3}$/;

type Mensagem = { id?: unknown; dataHora?: unknown; tipo?: unknown; conteudo?: unknown; direcao?: unknown };

/** Só o necessário para a tela. Mídia (imagem, áudio, documento) vira um rótulo: não repassamos endereços de arquivos. */
function limparMensagem(m: Mensagem, etapa: "automatico" | "atendimento") {
  const tipo = String(m.tipo ?? "Texto");
  const texto = tipo.toLowerCase() === "texto" ? String(m.conteudo ?? "").slice(0, 4000) : `[${tipo}]`;
  return { id: String(m.id ?? ""), dataHora: String(m.dataHora ?? ""), direcao: String(m.direcao ?? ""), tipo, conteudo: texto, etapa };
}

Deno.serve(async (req: Request) => {
  const origemHeader = req.headers.get("Origin");
  const origem = origemPermitida(origemHeader);
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: cabecalhos(origem) });

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
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: usuario } = await supabase.auth.getUser(jwt);
  if (!usuario.user) return json({ error: "Sua sessão expirou. Entre de novo." }, 401);
  const { data: daEquipe } = await supabase.rpc("is_member");
  if (daEquipe !== true) return json({ error: "Só a equipe do Ellos pode ver atendimentos da Escallo." }, 403);

  const token = Deno.env.get("ESCALLO_TOKEN");
  if (!token) {
    return json({ error: "O token da Escallo não está cadastrado. No Supabase, abra Edge Functions → Secrets e cadastre ESCALLO_TOKEN." }, 500);
  }
  const esconder = (t: unknown) => String(t ?? "").split(token).join("***");

  // ---- Pedido ----
  let corpo: Record<string, unknown>;
  try {
    const texto = await req.text();
    if (texto.length > 1000) return json({ error: "Pedido grande demais." }, 413);
    corpo = JSON.parse(texto);
  } catch {
    return json({ error: "Pedido inválido: envie um JSON." }, 400);
  }
  const canal = corpo.canal;
  if (canal !== "WhatsApp" && canal !== "Ligação") return json({ error: "Escolha o canal: WhatsApp ou Ligação." }, 400);

  const chamarEscallo = async (url: string, init: RequestInit) => {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    } catch {
      return null;
    }
  };

  // ---- Áudio da ligação: busca na Escallo e repassa o som ----
  if (corpo.acao === "audio") {
    const uniqueid = String(corpo.uniqueid ?? "");
    if (!UNIQUEID_OK.test(uniqueid)) return json({ error: "Identificador da ligação inválido." }, 400);
    const endereco = `${URL_AUDIO}?json=${encodeURIComponent(JSON.stringify({ Ligacao: { uniqueid }, Options: { key: token } }))}`;
    const resposta = await chamarEscallo(endereco, { method: "GET" });
    if (!resposta) return json({ error: "Não consegui falar com a Escallo (sem resposta em 30 segundos). Tente de novo em instantes." }, 502);
    const tipo = (resposta.headers.get("content-type") ?? "").toLowerCase();
    if (!resposta.ok || tipo.includes("json") || tipo.startsWith("text/")) {
      console.log(`escallo-atendimento: áudio HTTP ${resposta.status}`);
      const motivo = esconder(await resposta.text().catch(() => "")).slice(0, 160);
      return json({ error: `A Escallo não devolveu a gravação (HTTP ${resposta.status}${motivo ? `: ${motivo}` : ""}). Ela pode não existir mais.` }, 502);
    }
    const tamanho = Number(resposta.headers.get("content-length") ?? 0);
    if (tamanho > LIMITE_AUDIO_BYTES) return json({ error: "A gravação é grande demais para tocar aqui." }, 413);
    // Repassa o som sem guardar. application/octet-stream para o navegador entregar como arquivo binário.
    return new Response(resposta.body, { status: 200, headers: cabecalhos(origem, "application/octet-stream") });
  }

  const protocolo = String(corpo.protocolo ?? "").trim();
  const dia = String(corpo.dia ?? "");
  if (!PROTOCOLO_OK.test(protocolo)) return json({ error: "Protocolo inválido. Use só letras, números, ponto, hífen ou sublinhado." }, 400);
  if (!DIA_OK.test(dia) || Number.isNaN(new Date(`${dia}T12:00:00Z`).getTime())) return json({ error: "Informe a data do atendimento." }, 400);

  const cabecalhoEscallo = { "Content-Type": "application/json", Authorization: `Partner ${token}` };
  const periodo = { dataInicial: dia, dataFinal: dia, horarioInicial: "00:00:01", horarioFinal: "23:59:59" };

  // ---- WhatsApp: conversa ----
  if (canal === "WhatsApp") {
    // Sem campo "agente": a Escallo recusa agente vazio.
    const resposta = await chamarEscallo(URL_HISTORICO, { method: "POST", headers: cabecalhoEscallo, body: JSON.stringify({ ...periodo, protocolo }) });
    if (!resposta) return json({ error: "Não consegui falar com a Escallo (sem resposta em 30 segundos). Tente de novo em instantes." }, 502);
    const dados = await resposta.json().catch(() => null) as { code?: unknown; message?: unknown; data?: { registros?: unknown } } | null;
    if (!resposta.ok || !dados || (dados.code !== undefined && Number(dados.code) !== 200)) {
      console.log(`escallo-atendimento: histórico HTTP ${resposta.status}`);
      const motivo = esconder(dados?.message).slice(0, 160);
      return json({ error: `A Escallo recusou o pedido (HTTP ${resposta.status}${motivo ? `: ${motivo}` : ""}).` }, 502);
    }
    const registros = Array.isArray(dados.data?.registros) ? (dados.data!.registros as Record<string, unknown>[]) : [];
    if (registros.length === 0) {
      return json({ error: "A Escallo não encontrou esse protocolo nesse dia. Confira o número e a data do atendimento." }, 404);
    }
    const mensagens: ReturnType<typeof limparMensagem>[] = [];
    const agentes = new Set<string>();
    for (const r of registros) {
      for (const m of Array.isArray(r.mensagensContato) ? (r.mensagensContato as Mensagem[]) : []) mensagens.push(limparMensagem(m, "automatico"));
      for (const a of Array.isArray(r.atendimentos) ? (r.atendimentos as Record<string, unknown>[]) : []) {
        const ag = a.agente as { nome?: unknown } | undefined;
        if (ag?.nome) agentes.add(String(ag.nome));
        for (const m of Array.isArray(a.mensagens) ? (a.mensagens as Mensagem[]) : []) mensagens.push(limparMensagem(m, "atendimento"));
      }
    }
    mensagens.sort((a, b) => a.dataHora.localeCompare(b.dataHora) || a.id.localeCompare(b.id));
    return json({ tipo: "conversa", protocolo, dia, agentes: [...agentes], mensagens });
  }

  // ---- Ligação: acha a ligação de entrada pelo protocolo ----
  const resposta = await chamarEscallo(URL_REL002, { method: "POST", headers: cabecalhoEscallo, body: JSON.stringify(periodo) });
  if (!resposta) return json({ error: "Não consegui falar com a Escallo (sem resposta em 30 segundos). Tente de novo em instantes." }, 502);
  const dados = await resposta.json().catch(() => null) as { code?: unknown; message?: unknown; data?: { registros?: unknown } } | null;
  if (!resposta.ok || !dados || (dados.code !== undefined && Number(dados.code) !== 200)) {
    console.log(`escallo-atendimento: rel002 HTTP ${resposta.status}`);
    const motivo = esconder(dados?.message).slice(0, 160);
    return json({ error: `A Escallo recusou o pedido (HTTP ${resposta.status}${motivo ? `: ${motivo}` : ""}).` }, 502);
  }
  const ligacoes = Array.isArray(dados.data?.registros) ? (dados.data!.registros as Record<string, unknown>[]) : [];
  const achada = ligacoes.find((l) => String(l["protocolo.numero"] ?? "").trim() === protocolo);
  if (!achada) {
    return json({ error: "Não encontrei essa ligação entre as ligações de entrada desse dia. Confira o protocolo e a data (ligações feitas pelo agente ainda não aparecem aqui)." }, 404);
  }
  const uniqueid = String(achada["ligacao.uniqueid"] ?? "");
  if (!UNIQUEID_OK.test(uniqueid)) return json({ error: "A Escallo não informou o identificador da gravação dessa ligação." }, 404);
  return json({
    tipo: "ligacao",
    protocolo,
    dia,
    uniqueid,
    inicio: String(achada["ligacao.dataHoraInicial"] ?? ""),
    segundosConversa: Number(achada["ligacao.tempoConversa"] ?? 0) || 0,
    agente: String(achada["ligacao.nomeAgenteDestino"] ?? achada["ligacao.nomeAgenteOrigem"] ?? ""),
  });
});
