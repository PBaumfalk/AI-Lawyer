// ACCEPTANCE TEST — requires live Ollama with qwen3.5:35b.
// Run: npx vitest run tests/pii/ner-filter.acceptance.test.ts --timeout 60000
//
// @tags: acceptance, requires-ollama
//
// Purpose: DSGVO gate proof for Phase 16.
// These tests must pass before Phase 17 (Urteile-RAG) can begin ingestion.
// Validates two success criteria:
//   1. 0 institution names falsely extracted as persons[] (no false positives)
//   2. All real person names (Klaeger, Beklagte, Richter, Anwaelte) are detected

/// <reference types="vitest/globals" />

import { runNerFilter } from "@/lib/pii/ner-filter";

// Set 60s timeout per test (Ollama qwen3.5:35b: up to 45s + buffer)
vi.setConfig({ testTimeout: 60_000 });

// ─── Test corpus ──────────────────────────────────────────────────────────────

interface UrteilExcerpt {
  /** Unique identifier for test reporting */
  id: string;
  /** The German legal text excerpt to analyse */
  text: string;
  /** Whether the excerpt contains natural-person PII */
  expectedHasPii: boolean;
  /** Names that must NOT appear anywhere in result.persons[] */
  forbiddenInPersons: string[];
  /** Names that must appear in result.persons[] (subset match) */
  requiredInPersons?: string[];
}

const URTEIL_EXCERPTS: UrteilExcerpt[] = [
  {
    id: "bgh-institution-only",
    text: "Der Bundesgerichtshof, VI. Zivilsenat, hat die Revision zurueckgewiesen. Die Kosten des Revisionsverfahrens traegt die Beklagte.",
    expectedHasPii: false,
    forbiddenInPersons: ["Bundesgerichtshof", "VI. Zivilsenat", "Zivilsenat"],
    requiredInPersons: [],
  },
  {
    id: "bag-kammer-only",
    text: "Das Bundesarbeitsgericht hat durch die 2. Kammer unter Vorsitz des Praesidenten des Bundesarbeitsgerichts folgende Entscheidung getroffen: Die Klage wird abgewiesen.",
    expectedHasPii: false,
    forbiddenInPersons: ["Bundesarbeitsgericht", "Kammer", "Praesident"],
    requiredInPersons: [],
  },
  {
    id: "ag-klaeger-name",
    text: "Der Klaeger Hans Peter Mueller, wohnhaft in der Hauptstrasse 12, 50668 Koeln, verklagte die Beklagte vor dem Amtsgericht Koeln auf Zahlung rueckstaendiger Miete.",
    expectedHasPii: true,
    forbiddenInPersons: ["Amtsgericht Koeln", "Amtsgericht"],
    requiredInPersons: ["Hans Peter Mueller"],
  },
  {
    id: "lag-richter-und-institution",
    text: "Das Landesarbeitsgericht Hamm, 5. Kammer, hat unter Vorsitz von Richter am LAG Dr. Karl Friedrich Lehmann entschieden, die Berufung des Klaeger zurueckzuweisen.",
    expectedHasPii: true,
    forbiddenInPersons: ["Landesarbeitsgericht Hamm", "Kammer", "LAG"],
    requiredInPersons: ["Dr. Karl Friedrich Lehmann"],
  },
  {
    id: "bgh-anwaelte-beide-seiten",
    text: "Rechtsanwalt Dr. Stefan Bauer vertritt den Klaeger Thomas Andreas Fischer gegen die Beklagte GmbH, die durch Rechtsanwaeltin Anna Maria Schmidt vertreten wird.",
    expectedHasPii: true,
    forbiddenInPersons: [],
    requiredInPersons: ["Dr. Stefan Bauer", "Thomas Andreas Fischer", "Anna Maria Schmidt"],
  },
  {
    id: "bverfg-reine-institution",
    text: "Das Bundesverfassungsgericht, Erster Senat, hat die Verfassungsbeschwerde nicht zur Entscheidung angenommen. Die Staatsanwaltschaft war nicht beteiligt.",
    expectedHasPii: false,
    forbiddenInPersons: ["Bundesverfassungsgericht", "Erster Senat", "Staatsanwaltschaft"],
    requiredInPersons: [],
  },
  {
    id: "olg-rubrum-klaeger-beklagte",
    text: "In dem Rechtsstreit Maria Elisabeth Wagner (Klaegerin, Berufungsbeklagte) gegen die Bundesrepublik Deutschland, vertreten durch das Bundesministerium der Justiz (Beklagte, Berufungsklaegerin), hat das Oberlandesgericht Muenchen entschieden.",
    expectedHasPii: true,
    forbiddenInPersons: ["Bundesrepublik Deutschland", "Bundesministerium", "Oberlandesgericht Muenchen"],
    requiredInPersons: ["Maria Elisabeth Wagner"],
  },
  {
    id: "bg-pure-legal-text-no-persons",
    text: "Gemaess § 626 Abs. 1 BGB kann das Dienstverhaeltnis von jedem Vertragsteil aus wichtigem Grund ohne Einhaltung einer Kuendigungsfrist gekuendigt werden, wenn Tatsachen vorliegen, auf Grund derer dem Kuendigenden unter Beruecksichtigung aller Umstaende des Einzelfalles und unter Abwaegung der Interessen beider Vertragsteile die Fortsetzung des Dienstverhaeltnisses bis zum Ablauf der Kuendigungsfrist nicht zugemutet werden kann.",
    expectedHasPii: false,
    forbiddenInPersons: [],
    requiredInPersons: [],
  },
  {
    id: "bag-multiple-richter-named",
    text: "Der Senat des Bundesarbeitsgerichts in der Besetzung mit dem Vorsitzenden Richter Dr. Josef Wagner sowie den Richtern Dr. Petra Hoffmann und Klaus Dieter Braun hat am 15. Maerz 2022 entschieden.",
    expectedHasPii: true,
    forbiddenInPersons: ["Bundesarbeitsgerichts", "Senat"],
    requiredInPersons: ["Dr. Josef Wagner", "Dr. Petra Hoffmann", "Klaus Dieter Braun"],
  },
  {
    id: "amtsgericht-no-persons-procedural",
    text: "Das Amtsgericht Charlottenburg wies die Klage ab. Die Kosten des Verfahrens traegt der Klaeger. Das Urteil ist vorlaeufig vollstreckbar gegen Sicherheitsleistung in Hoehe von 110 Prozent des zu vollstreckenden Betrages.",
    expectedHasPii: false,
    forbiddenInPersons: ["Amtsgericht Charlottenburg", "Amtsgericht"],
    requiredInPersons: [],
  },
];

// ─── Acceptance tests ─────────────────────────────────────────────────────────

describe("NER Filter Acceptance Test — Phase 16 success criteria", () => {
  test.each(URTEIL_EXCERPTS)(
    "$id",
    async ({ text, expectedHasPii, forbiddenInPersons, requiredInPersons }) => {
      const result = await runNerFilter(text);

      // Success criterion 1: institution names must NOT appear in persons[]
      for (const forbidden of forbiddenInPersons) {
        // Exact match check
        expect(result.persons).not.toContain(forbidden);
        // Partial match check (e.g. "Bundesgerichtshof" within "Bundesgerichtshof VI. Senat")
        const hasPartialMatch = result.persons.some((p) =>
          p.toLowerCase().includes(forbidden.toLowerCase())
        );
        expect(hasPartialMatch).toBe(false);
      }

      // Success criterion 2: hasPii must match expected
      expect(result.hasPii).toBe(expectedHasPii);

      // Bonus: required names must appear (when specified)
      for (const required of requiredInPersons ?? []) {
        const found = result.persons.some((p) =>
          p.toLowerCase().includes(required.toLowerCase())
        );
        expect(found).toBe(true);
      }
    }
  );
});
