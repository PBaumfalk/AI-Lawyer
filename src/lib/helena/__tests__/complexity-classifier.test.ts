import { describe, it, expect } from "vitest";
import { classifyComplexity } from "../complexity-classifier";

describe("classifyComplexity", () => {
  it.each([
    ["Erstelle einen Entwurf der Kündigungsschutzklage für unsere Mandantin.", 3],
    ["Entwirf eine Klageerwiderung", 3],
    ["Verfasse die Klageerwiderung zum Schriftsatz der Gegenseite", 3],
    ["Erstelle einen Schriftsatz mit Antrag auf Fristverlängerung", 3],
    ["Prüfe die Erfolgsaussichten einer Kündigungsschutzklage", 3],
    ["Wie ist die Rechtslage bei einer Kündigung ohne Anhörung des Betriebsrats?", 3],
    ["Ist die Kündigung wirksam?", 3],
    ["Erstelle einen Vermerk zum Telefonat", 2],
    ["Wann läuft die Frist ab?", 1],
    ["Wie ist der Sachstand in dieser Akte?", 2],
  ] as const)("%s -> Stufe %i", (frage, stufe) => {
    expect(classifyComplexity(frage).tier).toBe(stufe);
  });

  it("Umlaute und Umschreibungen werden gleich behandelt", () => {
    expect(classifyComplexity("Prüfe vollständig alle Fristen").tier).toBe(classifyComplexity("Pruefe vollstaendig alle Fristen").tier);
    expect(classifyComplexity("Prüfe vollständig alle Fristen").mode).toBe("background");
  });
});
