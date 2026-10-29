/**
 * Armazenamento do Lumo.
 *
 * As telas continuam lendo e gravando de forma síncrona pelas funções
 * load/save de cada módulo de storage. Este módulo decide para onde isso vai:
 *
 * - Sem login (testes, ou antes de entrar): localStorage, como antes.
 * - Com login: um cache em memória carregado do Supabase em `hydrate()`.
 *   Cada gravação atualiza o cache na hora e envia ao banco só o que mudou
 *   (inclusões, alterações e exclusões), em uma fila que respeita a ordem.
 */
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import { newId } from "@/lib/ids";

// ---------------------------------------------------------------
// Chaves (as mesmas que eram usadas no localStorage)
// ---------------------------------------------------------------
export const KEYS = {
  attendants: "lumo-attendants",
  performance: "lumo-performance-records",
  absences: "lumo-absences",
  calendar: "lumo-calendar-events",
  productionGoals: "lumo-production-goals",
  roleGoals: "lumo-role-goals",
  importLog: "lumo-import-log",
  structure: "lumo-structure-layout",
  preferences: "lumo-user-preferences",
  analysisNote: "lumo-analysis-note",
} as const;

type Row = Record<string, unknown>;
type Item = Record<string, unknown> & { id: string | number };

interface CollectionSpec {
  table: string;
  toRow: (item: Item) => Row;
  fromRow: (row: Row, ctx: { attendantNames: Map<number, string> }) => Item;
  order?: string;
}

const str = (v: unknown) => (v == null ? "" : String(v));
const optStr = (v: unknown) => (v == null || v === "" ? undefined : String(v));
const num = (v: unknown) => (v == null ? 0 : Number(v));
const nullable = (v: unknown) => (v === undefined || v === "" ? null : v);

const COLLECTIONS: Record<string, CollectionSpec> = {
  [KEYS.attendants]: {
    table: "attendants",
    order: "name",
    toRow: (a) => ({
      id: a.id,
      name: a.name,
      role: a.role ?? "Atendente",
      service_channel: a.serviceChannel,
      working_hours: str(a.workingHours),
      jornada_start: str(a.jornadaStart),
      jornada_end: str(a.jornadaEnd),
      observation: str(a.observation),
      registration_date: nullable(a.registrationDate) ?? undefined,
    }),
    fromRow: (r) => ({
      id: num(r.id),
      name: str(r.name),
      role: str(r.role),
      serviceChannel: r.service_channel === "WhatsApp" ? "WhatsApp" : "Ligação",
      workingHours: str(r.working_hours),
      jornadaStart: str(r.jornada_start),
      jornadaEnd: str(r.jornada_end),
      observation: str(r.observation),
      registrationDate: str(r.registration_date),
    }),
  },
  [KEYS.performance]: {
    table: "performance_records",
    order: "date",
    toRow: (p) => ({
      id: p.id,
      attendant_id: p.attendantId,
      date: p.date,
      channel: p.channel,
      attendances_count: num(p.attendancesCount),
      average_time_minutes: num(p.averageTimeMinutes),
      created_at: nullable(p.createdAt) ?? undefined,
      updated_at: nullable(p.updatedAt) ?? undefined,
    }),
    fromRow: (r, ctx) => ({
      id: num(r.id),
      attendantId: num(r.attendant_id),
      attendantName: ctx.attendantNames.get(num(r.attendant_id)) ?? "Colaborador",
      date: str(r.date),
      channel: str(r.channel),
      attendancesCount: num(r.attendances_count),
      averageTimeMinutes: num(r.average_time_minutes),
      createdAt: str(r.created_at),
      updatedAt: str(r.updated_at),
    }),
  },
  [KEYS.absences]: {
    table: "absences",
    order: "start_date",
    toRow: (a) => ({
      id: a.id,
      attendant_id: a.attendantId,
      type: a.type,
      start_date: a.startDate,
      end_date: a.endDate,
      reason: str(a.reason),
      status: a.status ?? "approved",
      created_at: nullable(a.createdAt) ?? undefined,
      updated_at: nullable(a.updatedAt) ?? undefined,
    }),
    fromRow: (r, ctx) => ({
      id: num(r.id),
      attendantId: num(r.attendant_id),
      attendantName: ctx.attendantNames.get(num(r.attendant_id)) ?? "Colaborador",
      type: str(r.type),
      startDate: str(r.start_date),
      endDate: str(r.end_date),
      reason: str(r.reason),
      status: str(r.status),
      createdAt: str(r.created_at),
      updatedAt: str(r.updated_at),
    }),
  },
  [KEYS.calendar]: {
    table: "calendar_events",
    order: "date",
    toRow: (e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      date: e.date,
      end_date: nullable(e.endDate),
      start_time: nullable(e.startTime),
      end_time: nullable(e.endTime),
      location: nullable(e.location),
      description: nullable(e.description),
      created_at: nullable(e.createdAt) ?? undefined,
      updated_at: nullable(e.updatedAt) ?? undefined,
    }),
    fromRow: (r) => ({
      id: num(r.id),
      title: str(r.title),
      type: str(r.type),
      date: str(r.date),
      endDate: optStr(r.end_date),
      startTime: optStr(r.start_time),
      endTime: optStr(r.end_time),
      location: optStr(r.location),
      description: optStr(r.description),
      createdAt: str(r.created_at),
      updatedAt: str(r.updated_at),
    }),
  },
  [KEYS.productionGoals]: {
    table: "production_goals",
    order: "created_at",
    toRow: (g) => ({
      id: g.id,
      channel: g.channel,
      daily_target: num(g.dailyTarget),
      status: g.status ?? "Ativo",
    }),
    fromRow: (r) => ({
      id: num(r.id),
      channel: str(r.channel),
      dailyTarget: num(r.daily_target),
      status: str(r.status),
      createdAt: str(r.created_at).slice(0, 10),
      updatedAt: str(r.updated_at).slice(0, 10),
    }),
  },
  [KEYS.roleGoals]: {
    table: "role_goals",
    order: "created_at",
    toRow: (g) => ({
      id: g.id,
      role: g.role ?? "Atendente",
      daily_target: num(g.dailyTarget),
      description: nullable(g.description),
      status: g.status ?? "Ativo",
    }),
    fromRow: (r) => ({
      id: num(r.id),
      role: str(r.role),
      dailyTarget: num(r.daily_target),
      description: optStr(r.description),
      status: str(r.status),
      createdAt: str(r.created_at).slice(0, 10),
      updatedAt: str(r.updated_at).slice(0, 10),
    }),
  },
  [KEYS.importLog]: {
    table: "import_logs",
    order: "created_at",
    toRow: (l) => ({
      id: l.id,
      file_name: nullable(l.fileName),
      message: str(l.message),
      imported: num(l.imported),
      updated: num(l.updated),
      skipped: num(l.skipped),
      unique_attendants: num(l.uniqueAttendants),
      new_days: Array.isArray(l.newDays) ? l.newDays : [],
      created_at: nullable(l.timestamp) ?? undefined,
    }),
    fromRow: (r) => ({
      id: str(r.id),
      timestamp: str(r.created_at),
      fileName: optStr(r.file_name),
      message: str(r.message),
      imported: num(r.imported),
      updated: num(r.updated),
      skipped: num(r.skipped),
      uniqueAttendants: num(r.unique_attendants),
      newDays: Array.isArray(r.new_days) ? (r.new_days as string[]) : [],
    }),
  },
};

// ---------------------------------------------------------------
// Estado
// ---------------------------------------------------------------
let cloudUserId: string | null = null;
const cache = new Map<string, unknown>();
const synced = new Map<string, unknown>();
let queue: Promise<void> = Promise.resolve();
let errorShown = false;

export function isCloudEnabled(): boolean {
  return cloudUserId !== null;
}

// ---------------------------------------------------------------
// Leitura e escrita usadas pelos módulos de storage
// ---------------------------------------------------------------
export function readJSON<T>(key: string): T | null {
  if (cloudUserId) {
    return cache.has(key) ? (structuredCloneSafe(cache.get(key)) as T) : null;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown): void {
  if (cloudUserId) {
    cache.set(key, value);
    scheduleSync(key, value);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export function readText(key: string): string | null {
  if (cloudUserId) {
    const value = cache.get(key);
    return typeof value === "string" ? value : null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeText(key: string, value: string): void {
  if (cloudUserId) {
    cache.set(key, value);
    scheduleSync(key, value);
    return;
  }
  localStorage.setItem(key, value);
}

export function removeKey(key: string): void {
  if (cloudUserId) {
    const empty = COLLECTIONS[key] ? [] : key === KEYS.analysisNote ? "" : null;
    if (empty === null) {
      cache.delete(key);
      if (key === KEYS.structure) {
        enqueue(async () => {
          const { error } = await getSupabase()
            .from("structure_layouts")
            .delete()
            .eq("owner_id", cloudUserId!);
          if (error) throw error;
        });
      }
      return;
    }
    cache.set(key, empty);
    scheduleSync(key, empty);
    return;
  }
  localStorage.removeItem(key);
}

function structuredCloneSafe<T>(value: T): T {
  return value == null ? value : (JSON.parse(JSON.stringify(value)) as T);
}

// ---------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------
function enqueue(task: () => Promise<void>) {
  queue = queue.then(task).catch((error: unknown) => {
    console.error("[Elos] Falha ao salvar no banco", error);
    if (!errorShown) {
      errorShown = true;
      toast.error(
        "Não foi possível salvar uma alteração no servidor. Verifique a conexão e recarregue a página.",
        { duration: 10000 }
      );
      window.setTimeout(() => (errorShown = false), 10000);
    }
  });
}

/** Espera todas as gravações pendentes terminarem. */
export function flushCloud(): Promise<void> {
  return queue;
}

function scheduleSync(key: string, next: unknown) {
  const prev = synced.get(key);
  synced.set(key, structuredCloneSafe(next));
  const userId = cloudUserId!;
  const nextCopy = structuredCloneSafe(next);

  const spec = COLLECTIONS[key];
  if (spec) {
    enqueue(() => syncCollection(spec, (prev as Item[]) ?? [], (nextCopy as Item[]) ?? []));
    return;
  }

  if (key === KEYS.structure) {
    const layout = (nextCopy ?? {}) as { elements?: unknown; history?: unknown };
    enqueue(async () => {
      const { error } = await getSupabase()
        .from("structure_layouts")
        .upsert(
          { owner_id: userId, elements: layout.elements ?? [], history: layout.history ?? [] },
          { onConflict: "owner_id" }
        );
      if (error) throw error;
    });
    return;
  }

  if (key === KEYS.preferences) {
    const p = (nextCopy ?? {}) as Record<string, unknown>;
    enqueue(async () => {
      const { error } = await getSupabase()
        .from("user_preferences")
        .upsert(
          {
            owner_id: userId,
            notifications: p.notifications ?? true,
            email_reports: p.emailReports ?? true,
            language: p.language ?? "pt-BR",
            timezone: p.timezone ?? "America/Sao_Paulo",
          },
          { onConflict: "owner_id" }
        );
      if (error) throw error;
    });
    return;
  }

  if (key === KEYS.analysisNote) {
    enqueue(async () => {
      const { error } = await getSupabase()
        .from("user_preferences")
        .upsert({ owner_id: userId, analysis_note: String(nextCopy ?? "") }, { onConflict: "owner_id" });
      if (error) throw error;
    });
  }
}

async function syncCollection(spec: CollectionSpec, prev: Item[], next: Item[]) {
  const supabase = getSupabase();
  const prevRows = new Map(prev.map((item) => [String(item.id), JSON.stringify(spec.toRow(item))]));
  const nextIds = new Set(next.map((item) => String(item.id)));

  const removed = prev.filter((item) => !nextIds.has(String(item.id))).map((item) => item.id);
  const changed = next
    .map((item) => spec.toRow(item))
    .filter((row) => prevRows.get(String(row.id)) !== JSON.stringify(row));

  // Exclusões antes das inclusões, para não esbarrar em chaves únicas.
  for (const ids of chunk(removed, 200)) {
    const { error } = await supabase.from(spec.table).delete().in("id", ids);
    if (error) throw error;
  }
  for (const rows of chunk(changed, 500)) {
    const { error } = await supabase.from(spec.table).upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------
// Carga inicial depois do login
// ---------------------------------------------------------------
async function fetchAll(table: string, order?: string): Promise<Row[]> {
  const supabase = getSupabase();
  const pageSize = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (order) query = query.order(order, { ascending: true }).order("id", { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function hydrateCloud(userId: string): Promise<{ migrated: boolean }> {
  const supabase = getSupabase();
  cache.clear();
  synced.clear();

  const [attendantRows, ...otherRows] = await Promise.all([
    fetchAll("attendants", "name"),
    fetchAll("performance_records", "date"),
    fetchAll("absences", "start_date"),
    fetchAll("calendar_events", "date"),
    fetchAll("production_goals", "created_at"),
    fetchAll("role_goals", "created_at"),
    fetchAll("import_logs", "created_at"),
  ]);
  const attendantNames = new Map(attendantRows.map((r) => [num(r.id), str(r.name)]));
  const ctx = { attendantNames };

  const keysInOrder = [
    KEYS.attendants,
    KEYS.performance,
    KEYS.absences,
    KEYS.calendar,
    KEYS.productionGoals,
    KEYS.roleGoals,
    KEYS.importLog,
  ];
  const allRows = [attendantRows, ...otherRows];
  keysInOrder.forEach((key, index) => {
    let items = allRows[index].map((row) => COLLECTIONS[key].fromRow(row, ctx));
    if (key === KEYS.importLog) items = items.reverse(); // mais recentes primeiro
    cache.set(key, items);
    synced.set(key, structuredCloneSafe(items));
  });

  const [{ data: layout }, { data: prefs }] = await Promise.all([
    supabase.from("structure_layouts").select("*").eq("owner_id", userId).maybeSingle(),
    supabase.from("user_preferences").select("*").eq("owner_id", userId).maybeSingle(),
  ]);
  if (layout) {
    const value = {
      elements: layout.elements ?? [],
      history: layout.history ?? [],
      updatedAt: layout.updated_at,
    };
    cache.set(KEYS.structure, value);
    synced.set(KEYS.structure, structuredCloneSafe(value));
  }
  if (prefs) {
    const value = {
      notifications: prefs.notifications,
      emailReports: prefs.email_reports,
      language: prefs.language,
      timezone: prefs.timezone,
    };
    cache.set(KEYS.preferences, value);
    synced.set(KEYS.preferences, structuredCloneSafe(value));
    cache.set(KEYS.analysisNote, prefs.analysis_note ?? "");
    synced.set(KEYS.analysisNote, prefs.analysis_note ?? "");
  }

  cloudUserId = userId;

  // Primeiro acesso: se o banco está vazio e este navegador tem dados antigos,
  // envia esses dados para o banco (com IDs novos, para não colidir).
  const migrated = migrateLocalData();
  return { migrated };
}

function migrateLocalData(): boolean {
  const remoteEmpty = (cache.get(KEYS.attendants) as Item[]).length === 0;
  if (!remoteEmpty) return false;

  const localAttendants = readLocal<Item[]>(KEYS.attendants) ?? [];
  const localCalendar = readLocal<Item[]>(KEYS.calendar) ?? [];
  const localGoals = readLocal<Item[]>(KEYS.productionGoals) ?? [];
  const localLayout = readLocal<Record<string, unknown>>(KEYS.structure);
  if (
    localAttendants.length === 0 &&
    localCalendar.length === 0 &&
    localGoals.length === 0 &&
    !localLayout
  ) {
    return false;
  }

  const attendantIdMap = new Map<string, number>();
  const remap = (list: Item[]) =>
    list.map((item) => {
      const id = newId();
      return { item, id };
    });

  const attendants = remap(localAttendants).map(({ item, id }) => {
    attendantIdMap.set(String(item.id), id);
    return { ...item, id };
  });
  const withAttendant = (list: Item[]) =>
    remap(list)
      .filter(({ item }) => attendantIdMap.has(String(item.attendantId)))
      .map(({ item, id }) => ({
        ...item,
        id,
        attendantId: attendantIdMap.get(String(item.attendantId))!,
      }));

  writeJSON(KEYS.attendants, attendants);
  writeJSON(KEYS.performance, withAttendant(readLocal<Item[]>(KEYS.performance) ?? []));
  writeJSON(KEYS.absences, withAttendant(readLocal<Item[]>(KEYS.absences) ?? []));
  writeJSON(KEYS.calendar, remap(localCalendar).map(({ item, id }) => ({ ...item, id })));
  writeJSON(KEYS.productionGoals, remap(localGoals).map(({ item, id }) => ({ ...item, id })));
  writeJSON(
    KEYS.roleGoals,
    remap(readLocal<Item[]>(KEYS.roleGoals) ?? []).map(({ item, id }) => ({ ...item, id }))
  );
  if (localLayout) writeJSON(KEYS.structure, localLayout);
  return true;
}

/** Volta ao modo sem login (usado ao sair). */
export function disableCloud(): void {
  cloudUserId = null;
  cache.clear();
  synced.clear();
}
