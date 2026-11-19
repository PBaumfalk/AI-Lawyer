/**
 * Client flow for "Zuordnen" on a beA message.
 * POST /api/bea/auto-assign files the message only for an unambiguous match
 * (SICHER). A WAHRSCHEINLICH match comes back as a suggestion, which the user
 * must confirm before it is stored via PATCH /api/bea/messages/[id].
 */
export interface AutoAssignAntwort {
  zugeordnet: boolean;
  akteId: string | null;
  confidence: "SICHER" | "WAHRSCHEINLICH" | "UNSICHER";
  reason: string;
}

/** Returns true if the message is now assigned. */
export async function beaAutoZuordnen(
  nachrichtId: string,
  bestaetigen: (frage: string) => boolean = (f) => window.confirm(f)
): Promise<{ zugeordnet: boolean; meldung?: string }> {
  const res = await fetch("/api/bea/auto-assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nachrichtId }),
  });
  const data: AutoAssignAntwort | { error?: string } = await res.json().catch(() => ({}));
  if (!res.ok || !("confidence" in data)) {
    return { zugeordnet: false, meldung: ("error" in data && data.error) || "Zuordnung fehlgeschlagen" };
  }
  if (data.zugeordnet) return { zugeordnet: true };
  if (!data.akteId) return { zugeordnet: false, meldung: data.reason };

  if (!bestaetigen(`Zuordnungsvorschlag (nicht eindeutig): ${data.reason}\n\nNachricht dieser Akte zuordnen?`)) {
    return { zugeordnet: false };
  }
  const patch = await fetch(`/api/bea/messages/${encodeURIComponent(nachrichtId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ akteId: data.akteId }),
  });
  if (!patch.ok) {
    const err = await patch.json().catch(() => ({}));
    return { zugeordnet: false, meldung: err.error || "Zuordnung fehlgeschlagen" };
  }
  return { zugeordnet: true };
}
