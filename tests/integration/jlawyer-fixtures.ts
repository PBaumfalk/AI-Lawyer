/**
 * Recorded-style sample responses of the j-lawyer REST API, shaped exactly
 * like the endpoint catalogue of a live instance (API level 8):
 * RestfulCaseOverviewV1, RestfulCaseV2, RestfulPartyV1, RestfulDueDateV6,
 * RestfulDocumentV1, RestfulDocumentContentV1, RestfulCaseFolderV3,
 * RestfulContactOverviewV1, RestfulContactV2, RestfulUserV6.
 * Synthetic data only.
 */
import { vi } from "vitest";

export const JL_BASE = "https://jl.example.com:8080";
export const REST = "/j-lawyer-io/rest";

const C1 = "c1000000000000000000000000000001";
const C2 = "c2000000000000000000000000000002";
const K1 = "k1000000000000000000000000000001";
const K2 = "k2000000000000000000000000000002";

export const IDS = { C1, C2, K1, K2 };

export function jlawyerFixture() {
  const routes: Record<string, unknown> = {
    "/v1/cases/party/types": [{ id: "p1", name: "Mandant", placeHolder: "MANDANT", color: 0, sequenceNumber: 1 }],
    "/v6/security/users/list": [
      { principalId: "mmueller", email: "m.mueller@kanzlei.example", displayName: "Maria Müller", firstName: "Maria", name: "Müller", lawyer: true },
      { principalId: "sabine", email: "", displayName: "Sabine Sekretariat", firstName: "Sabine", name: "Sekretariat", lawyer: false },
      { principalId: "ghost", email: "ghost@extern.example", displayName: "Unbekannt Person", lawyer: true },
    ],
    "/v1/cases/list": [
      { id: C1, fileNumber: "00012/26", name: "Neu ./. Acme GmbH", reason: "Kündigung", externalId: null, dateChanged: "2026-10-01T08:00:00Z[UTC]" },
      { id: C2, fileNumber: "00013/26", name: "Beratung X", reason: "Vertrag", externalId: null, dateChanged: 1790000000000 },
    ],
    [`/v2/cases/${C1}`]: {
      id: C1, fileNumber: "00012/26", name: "Neu ./. Acme GmbH", reason: "Kündigung", subjectField: "Arbeitsrecht",
      archived: 0, lawyer: "mmueller", assistant: "sabine", claimValue: 12000, notice: "Notiz aus j-lawyer",
      dateCreated: "2026-01-15T09:30:00Z[UTC]", dateUpdated: "2026-10-01T08:00:00Z[UTC]",
    },
    [`/v2/cases/${C2}`]: {
      id: C2, fileNumber: "00013/26", name: "Beratung X", reason: "Vertrag", subjectField: "Zivilrecht",
      archived: 1, lawyer: "ghost", assistant: "", claimValue: 0, notice: "",
      dateCreated: 1767225600000, dateUpdated: "2026-06-01T00:00:00Z[UTC]",
    },
    [`/v1/cases/${C1}/parties`]: [
      { id: "pa1", caseId: C1, contact: K1, addressId: K1, involvementType: "Mandant", reference: "" },
      { id: "pa2", caseId: C1, contact: K2, addressId: K2, involvementType: "Gegner", reference: "AZ-G-7" },
    ],
    [`/v1/cases/${C2}/parties`]: [],
    [`/v4/cases/${C1}/duedates`]: [
      { id: "d1", caseId: C1, type: "Frist", summary: "Klagefrist § 4 KSchG", description: "3 Wochen", beginDate: "2026-12-01T10:00:00Z[UTC]", endDate: null, done: false, assignee: "mmueller" },
      { id: "d2", caseId: C1, type: "Wiedervorlage", summary: "WV Akte", beginDate: "2026-11-25T00:00:00Z[UTC]", done: false, assignee: "ghost" },
    ],
    [`/v4/cases/${C2}/duedates`]: [
      { id: "d3", caseId: C2, type: "Termin", summary: "Besprechung", location: "Büro", beginDate: "2026-12-03T13:00:00Z[UTC]", endDate: "2026-12-03T14:00:00Z[UTC]", done: true, assignee: "" },
    ],
    [`/v1/cases/${C1}/documents`]: [
      { id: "doc1", caseId: C1, name: "Kündigung.pdf", folderId: "f2", size: 11, version: 1, creationDate: "2026-01-20T10:00:00Z[UTC]" },
      { id: "doc2", caseId: C1, name: "Notiz.txt", folderId: null, size: 5, version: 2 },
    ],
    [`/v1/cases/${C2}/documents`]: [],
    [`/v3/cases/${C1}/folders`]: { id: "root", name: "00012/26", parentId: null, children: [{ id: "f2", name: "Schriftsätze", parentId: "root", children: [] }] },
    "/v1/cases/document/doc1/content": { id: "doc1", caseId: C1, fileName: "Kündigung.pdf", base64content: Buffer.from("%PDF-1.4 x").toString("base64"), version: 1 },
    "/v1/cases/document/doc2/content": { id: "doc2", caseId: C1, fileName: "Notiz.txt", base64content: Buffer.from("Hallo").toString("base64"), version: 2 },
    "/v1/contacts/list": [
      { id: K1, firstName: "Eva", name: "Neu", company: "", city: "Köln" },
      { id: K2, firstName: "", name: "", company: "Acme GmbH", city: "Bonn" },
    ],
    [`/v2/contacts/${K1}`]: { id: K1, salutation: "Frau", firstName: "Eva", name: "Neu", street: "Ring", streetNumber: "5", zipCode: "50667", city: "Köln", email: "eva@example.com", phone: "0221 1", birthDate: "01.02.1980", country: "" },
    [`/v2/contacts/${K2}`]: { id: K2, firstName: "", name: "", company: "Acme GmbH", legalForm: "GmbH", city: "Bonn", email: "info@acme.example" },
  };

  const calls: string[] = [];
  const overrides = new Map<string, number>();
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push(url.pathname);
    if (url.origin !== new URL(JL_BASE).origin || !url.pathname.startsWith(REST)) {
      return new Response("not found", { status: 404 });
    }
    const path = url.pathname.slice(REST.length);
    const forced = overrides.get(path);
    if (forced) return new Response("", { status: forced });
    if (!(path in routes)) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(routes[path]), { status: 200, headers: { "content-type": "application/json" } });
  });

  return { routes, calls, fetchMock, failWith: (path: string, status: number) => overrides.set(path, status) };
}
