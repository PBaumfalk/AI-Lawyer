import { z } from "zod";

// Field key: alphanumeric + underscore, starts with letter
const FIELD_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export const FALLDATEN_FELD_TYPEN = [
  "text", "textarea", "number", "date", "select", "boolean", "currency", "multiselect",
] as const;

export type FalldatenFeldTypDB = (typeof FALLDATEN_FELD_TYPEN)[number];

const optionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const falldatenFeldSchema = z.object({
  key: z.string().min(1).max(64).regex(FIELD_KEY_REGEX, "Key must start with a letter and contain only alphanumeric characters and underscores"),
  label: z.string().min(1).max(128),
  typ: z.enum(FALLDATEN_FELD_TYPEN),
  placeholder: z.string().max(256).optional().nullable(),
  optionen: z.array(optionSchema).max(50).optional().nullable(),
  required: z.boolean().optional(),
  gruppe: z.string().max(64).optional().nullable(),
}).refine(
  (data) => {
    // optionen required for select and multiselect
    if (data.typ === "select" || data.typ === "multiselect") {
      return data.optionen && data.optionen.length > 0;
    }
    return true;
  },
  { message: "Optionen sind erforderlich fuer Select und Mehrfachauswahl Felder" }
);

export const templateSchemaSchema = z.object({
  felder: z.array(falldatenFeldSchema).min(1).max(100),
}).refine(
  (data) => {
    // Ensure unique keys within template
    const keys = data.felder.map((f) => f.key);
    return new Set(keys).size === keys.length;
  },
  { message: "Feld-Keys muessen innerhalb eines Templates eindeutig sein" }
);

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  beschreibung: z.string().max(2000).optional().nullable(),
  sachgebiet: z.string().optional().nullable(), // Sachgebiet enum value or null
  schema: templateSchemaSchema,
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const rejectTemplateSchema = z.object({
  ablehnungsgrund: z.string().min(1).max(2000).trim(),
});
