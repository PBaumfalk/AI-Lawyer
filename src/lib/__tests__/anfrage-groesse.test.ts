import { describe, it, expect } from "vitest";
import { pruefeAnfrageGroesse, jsonMaxBytes, STANDARD_JSON_MAX_BYTES } from "@/lib/anfrage-groesse";

const MAX = 1000;
const json = { "content-type": "application/json" };

describe("pruefeAnfrageGroesse", () => {
  it("lässt kleine JSON-Anfragen durch", () => {
    expect(pruefeAnfrageGroesse("POST", "/api/akten", { ...json, "content-length": "999" }, MAX)).toBeNull();
  });
  it("weist zu große JSON-Anfragen mit 413 ab", () => {
    expect(pruefeAnfrageGroesse("POST", "/api/akten", { ...json, "content-length": "1001" }, MAX)?.status).toBe(413);
    expect(pruefeAnfrageGroesse("PATCH", "/api/x", { "content-type": "application/merge-patch+json", "content-length": "5000" }, MAX)?.status).toBe(413);
  });
  it("weist JSON ohne Längenangabe (chunked) mit 411 ab", () => {
    expect(pruefeAnfrageGroesse("POST", "/api/akten", { ...json, "transfer-encoding": "chunked" }, MAX)?.status).toBe(411);
  });
  it("lässt Uploads, GET und Nicht-API-Pfade unberührt", () => {
    expect(pruefeAnfrageGroesse("POST", "/api/dokumente/upload", { "content-type": "multipart/form-data; boundary=x", "content-length": "99999999" }, MAX)).toBeNull();
    expect(pruefeAnfrageGroesse("GET", "/api/akten", { ...json, "content-length": "99999" }, MAX)).toBeNull();
    expect(pruefeAnfrageGroesse("POST", "/login", { ...json, "content-length": "99999" }, MAX)).toBeNull();
  });
  it("ungültige Längenangabe gilt als zu groß", () => {
    expect(pruefeAnfrageGroesse("POST", "/api/x", { ...json, "content-length": "abc" }, MAX)?.status).toBe(413);
  });
  it("API_JSON_MAX_BYTES, Standard 2 MB", () => {
    expect(jsonMaxBytes({})).toBe(STANDARD_JSON_MAX_BYTES);
    expect(jsonMaxBytes({ API_JSON_MAX_BYTES: "5000000" })).toBe(5000000);
    expect(jsonMaxBytes({ API_JSON_MAX_BYTES: "x" })).toBe(STANDARD_JSON_MAX_BYTES);
  });
});
