import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { BenutzerFehler } from "./service";

export function validierungsFehler(err: ZodError) {
  const erste = err.issues[0];
  return NextResponse.json(
    { error: erste?.message ?? "Ungültige Eingabe", feld: erste?.path.join("."), details: err.flatten() },
    { status: 400 }
  );
}

export function fehlerAntwort(e: unknown) {
  if (e instanceof BenutzerFehler) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e;
}
