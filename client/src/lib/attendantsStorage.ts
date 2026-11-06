import { readJSON, writeJSON } from "@/lib/cloudStore";
import type { Attendant, AttendantInput, AttendantRecordChannel, AttendantServiceChannel } from "@/types/attendant";
import { CANAL_LIGACAO_E_WHATSAPP } from "@/types/attendant";
import type { AttendanceChannel } from "@/types/goals";
import { getLocalDateString } from "@/lib/performanceStorage";
import { newId } from "@/lib/ids";

const STORAGE_KEY = "ellos-attendants";

export function loadAttendants(): Attendant[] {
  try {
    const stored = readJSON<Attendant[]>(STORAGE_KEY);
    if (stored) {
      return stored.map(normalizeAttendant);
    }
  } catch {
    // ignore
  }
  return [];
}

function normalizeAttendant(raw: Attendant): Attendant {
  const channel = raw.serviceChannel;
  const serviceChannel: AttendantServiceChannel =
    channel === "WhatsApp" ? "WhatsApp" : channel === CANAL_LIGACAO_E_WHATSAPP ? CANAL_LIGACAO_E_WHATSAPP : "Ligação";

  return {
    ...raw,
    serviceChannel,
    jornadaStart: raw.jornadaStart ?? "",
    jornadaEnd: raw.jornadaEnd ?? "",
  };
}

export function saveAttendants(attendants: Attendant[]): void {
  writeJSON(STORAGE_KEY, attendants);
}

export function toAttendantServiceChannel(
  channel: AttendanceChannel
): AttendantRecordChannel | null {
  if (channel === "Ligação" || channel === "WhatsApp") return channel;
  return null;
}

export function pickDominantServiceChannel(
  counts: Map<AttendantRecordChannel, number>
): AttendantRecordChannel {
  let dominant: AttendantRecordChannel = "Ligação";
  let bestCount = 0;

  for (const [channel, count] of counts) {
    if (count > bestCount) {
      dominant = channel;
      bestCount = count;
    }
  }

  return dominant;
}

export function createAttendant(input: AttendantInput, existing: Attendant[]): Attendant {
  return {
    id: newId(),
    ...input,
    registrationDate: getLocalDateString(),
  };
}

export type { AttendantInput };
