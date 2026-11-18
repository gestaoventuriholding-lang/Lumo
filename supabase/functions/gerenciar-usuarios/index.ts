// Ellos: gerencia quem pode entrar. Só administradores podem chamar.
// Usa a chave de serviço (disponível só aqui, nunca no navegador) para criar contas com e-mail e senha.
import { createClient } from "jsr:@supabase/supabase-js@2";

// Só as origens oficiais podem chamar pelo navegador. O ambiente de teste acrescenta as suas em ORIGENS_EXTRAS (secret).
const ORIGENS_PERMITIDAS = [
  /^https:\/\/ellos\.venturiholding\.com\.br$/,
  /^https:\/\/lumo-lyart\.vercel\.app$/,
];
const ORIGENS_EXTRAS = (Deno.env.get("ORIGENS_EXTRAS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
function origemPermitida(origem: string | null): string | null {
  return origem && (ORIGENS_PERMITIDAS.some((re) => re.test(origem)) || ORIGENS_EXTRAS.includes(origem)) ? origem : null;
}

function cabecalhosCors(origem: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: "Origin" };
  if (origem) {
    h["Access-Control-Allow-Origin"] = origem;
    h["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  return h;
}

Deno.serve(async (req: Request) => {
  const cors = cabecalhosCors(origemPermitida(req.headers.get("Origin")));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Quem está chamando?
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller.user) return json({ error: "Faça login para continuar." }, 401);
  const { data: isAdmin } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", caller.user.id)
    .maybeSingle();
  if (!isAdmin) return json({ error: "Só administradores podem gerenciar usuários." }, 403);

  let body: { action?: string; email?: string; password?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }

  if (body.action === "list") {
    const { data: members } = await admin.from("members").select("user_id, email, created_at");
    const { data: admins } = await admin.from("admins").select("user_id");
    const adminIds = new Set((admins ?? []).map((a) => a.user_id));
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const byId = new Map((list?.users ?? []).map((u) => [u.id, u]));
    const users = [
      ...(admins ?? []).map((a) => ({ id: a.user_id as string })),
      ...(members ?? []).filter((m) => !adminIds.has(m.user_id)).map((m) => ({ id: m.user_id as string })),
    ].map(({ id }) => {
      const u = byId.get(id);
      return {
        id,
        email: u?.email ?? "",
        isAdmin: adminIds.has(id),
        createdAt: u?.created_at ?? null,
        lastSignInAt: u?.last_sign_in_at ?? null,
      };
    });
    return json({ users });
  }

  if (body.action === "create") {
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400);
    if (password.length < 8) return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);

    let userId: string | null = null;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) {
      // e-mail já existe (ex.: acesso removido antes): reativa e troca a senha
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
      if (!existing) return json({ error: created.error.message }, 400);
      const updated = await admin.auth.admin.updateUserById(existing.id, { password, ban_duration: "none" });
      if (updated.error) return json({ error: updated.error.message }, 400);
      userId = existing.id;
    } else {
      userId = created.data.user.id;
    }
    const { error } = await admin
      .from("members")
      .upsert({ user_id: userId, email, created_by: caller.user.id }, { onConflict: "user_id" });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, userId });
  }

  if (body.action === "set-password") {
    if (!body.userId) return json({ error: "Escolha o usuário." }, 400);
    if ((body.password ?? "").length < 8) return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);
    const { error } = await admin.auth.admin.updateUserById(body.userId, { password: body.password });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === "remove") {
    if (!body.userId) return json({ error: "Escolha o usuário." }, 400);
    if (body.userId === caller.user.id) return json({ error: "Você não pode remover o seu próprio acesso." }, 400);
    const { data: target } = await admin.from("admins").select("user_id").eq("user_id", body.userId).maybeSingle();
    if (target) return json({ error: "Administradores não podem ser removidos por aqui." }, 400);
    // Não apaga a conta (apagaria os dados que a pessoa criou): tira o acesso e bloqueia o login.
    const { error } = await admin.from("members").delete().eq("user_id", body.userId);
    if (error) return json({ error: error.message }, 400);
    await admin.auth.admin.updateUserById(body.userId, { ban_duration: "876000h" });
    return json({ ok: true });
  }

  return json({ error: "Ação desconhecida." }, 400);
});
