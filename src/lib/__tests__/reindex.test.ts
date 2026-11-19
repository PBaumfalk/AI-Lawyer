import { describe, it, expect, vi } from "vitest";
vi.mock("meilisearch", () => ({ MeiliSearch: class { index() { return {}; } } }));
import type { MeiliSearch } from "meilisearch";
import { reindexDokumente, zuSuchDatensatz, type ReindexZeile } from "@/lib/search/reindex";

function zeile(id: string): ReindexZeile {
  return {
    id,
    akteId: "akte1",
    name: `Dokument ${id}.pdf`,
    mimeType: "application/pdf",
    ordner: null,
    tags: ["t"],
    ocrText: `Text ${id}`,
    createdById: "u1",
    createdAt: new Date("2026-01-02T03:04:05Z"),
    ocrStatus: "ABGESCHLOSSEN",
    status: "FREIGEGEBEN",
    akte: { aktenzeichen: "1/26", kurzrubrum: "A ./. B" },
    createdBy: { name: "Erika Muster" },
  };
}

type Ergebnis = { status: string; error?: { code: string; message: string } };

/** Minimal in-memory stand-in for the Meilisearch client. */
function fakeMeili(opts: { indexVorhanden?: boolean; addFehler?: boolean; statsOffset?: number } = {}) {
  let vorhanden = opts.indexVorhanden ?? true;
  const docs = new Map<string, unknown>();
  const aufrufe: string[] = [];
  const task = (r: Ergebnis) =>
    Object.assign(Promise.resolve({}), {
      waitTask: async () => ({ uid: 1, ...r, error: r.error ?? null }),
    });
  const client = {
    deleteIndex: () => {
      aufrufe.push("deleteIndex");
      const r: Ergebnis = vorhanden
        ? { status: "succeeded" }
        : { status: "failed", error: { code: "index_not_found", message: "nicht da" } };
      vorhanden = false;
      docs.clear();
      return task(r);
    },
    createIndex: () => {
      aufrufe.push("createIndex");
      vorhanden = true;
      return task({ status: "succeeded" });
    },
    index: () => ({
      updateSettings: () => {
        aufrufe.push("updateSettings");
        return task({ status: "succeeded" });
      },
      addDocuments: (d: { id: string }[]) => {
        aufrufe.push(`add:${d.length}`);
        if (opts.addFehler) return task({ status: "failed", error: { code: "x", message: "kaputt" } });
        for (const x of d) docs.set(x.id, x);
        return task({ status: "succeeded" });
      },
      getStats: async () => ({ numberOfDocuments: docs.size + (opts.statsOffset ?? 0) }),
    }),
  };
  return { client: client as unknown as MeiliSearch, docs, aufrufe };
}

function lader(anzahl: number) {
  const alle = Array.from({ length: anzahl }, (_, i) => zeile(`d${String(i).padStart(4, "0")}`));
  return vi.fn(async (nachId: string | undefined, take: number) => {
    const start = nachId ? alle.findIndex((z) => z.id === nachId) + 1 : 0;
    return alle.slice(start, start + take);
  });
}

describe("Suchindex-Neuaufbau", () => {
  it("bildet eine Datenbankzeile auf den Suchdatensatz ab", () => {
    const r = zuSuchDatensatz(zeile("a"));
    expect(r).toMatchObject({
      id: "a",
      createdByName: "Erika Muster",
      aktenzeichen: "1/26",
      kurzrubrum: "A ./. B",
      ocrStatus: "ABGESCHLOSSEN",
      dokumentStatus: "FREIGEGEBEN",
      createdAt: Date.UTC(2026, 0, 2, 3, 4, 5) / 1000,
    });
  });

  it("indexiert alle Seiten und meldet die Anzahl", async () => {
    const m = fakeMeili();
    const laden = lader(5);
    const fortschritt = vi.fn();
    const r = await reindexDokumente({ client: m.client, ladeSeite: laden, seitenGroesse: 2, fortschritt });
    expect(r).toEqual({ indexiert: 5, imIndex: 5 });
    expect(m.aufrufe).toEqual(["deleteIndex", "createIndex", "updateSettings", "add:2", "add:2", "add:1"]);
    expect(laden.mock.calls.map((c) => c[0])).toEqual([undefined, "d0001", "d0003"]);
    expect(fortschritt).toHaveBeenLastCalledWith(5);
  });

  it("ist wiederholbar und kommt ohne vorhandenen Index aus", async () => {
    const m = fakeMeili({ indexVorhanden: false });
    await reindexDokumente({ client: m.client, ladeSeite: lader(3) });
    const r = await reindexDokumente({ client: m.client, ladeSeite: lader(3) });
    expect(r.imIndex).toBe(3);
  });

  it("leere Datenbank ergibt leeren Index", async () => {
    const m = fakeMeili();
    expect(await reindexDokumente({ client: m.client, ladeSeite: lader(0) })).toEqual({ indexiert: 0, imIndex: 0 });
  });

  it("wirft bei fehlgeschlagenem Meilisearch-Task", async () => {
    const m = fakeMeili({ addFehler: true });
    await expect(reindexDokumente({ client: m.client, ladeSeite: lader(1) })).rejects.toThrow(/kaputt/);
  });

  it("wirft, wenn Meilisearch weniger Dokumente meldet", async () => {
    const m = fakeMeili({ statsOffset: -1 });
    await expect(reindexDokumente({ client: m.client, ladeSeite: lader(2) })).rejects.toThrow(/unvollständig/);
  });
});
