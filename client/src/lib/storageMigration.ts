const VERSION_KEY = "ellos-storage-version";
const CURRENT_VERSION = "3-empty-baseline";

const DATA_KEYS = [
  "ellos-attendants",
  "ellos-performance-records",
  "ellos-production-goals",
  "ellos-role-goals",
  "ellos-absences",
];

const LEGACY_PREFIX = "lumo-";
const NEW_PREFIX = "ellos-";

/**
 * O produto se chamava Lumo e as chaves do navegador começavam com "lumo-".
 * Copia cada chave antiga para o nome novo ("ellos-") e apaga a antiga, para
 * ninguém perder dados salvos nem a sessão de login. Pode rodar várias vezes.
 */
export function migrateLegacyStorageKeys(): void {
  try {
    const legacyKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_PREFIX)) legacyKeys.push(key);
    }
    for (const key of legacyKeys) {
      const newKey = NEW_PREFIX + key.slice(LEGACY_PREFIX.length);
      const value = localStorage.getItem(key);
      if (value !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value);
      }
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.error("[Ellos] Não foi possível migrar os dados salvos no navegador", e);
  }
}

export function ensureEmptyDataBaseline(): void {
  if (localStorage.getItem(VERSION_KEY) === CURRENT_VERSION) {
    return;
  }

  for (const key of DATA_KEYS) {
    localStorage.removeItem(key);
  }

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith("ellos-alert-state-")) {
      localStorage.removeItem(key);
    }
  }

  localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
}
