import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllSettings, updateSetting } from "@/lib/settings/service";
import { DEFAULT_SETTINGS, CATEGORY_LABELS } from "@/lib/settings/defaults";

/**
 * GET /api/settings — Returns all runtime settings grouped by category.
 * Requires ADMIN role.
 */
export async function GET() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  try {
    const settings = await getAllSettings();

    // Group settings by category
    const grouped: Record<
      string,
      { label: string; settings: typeof settings }
    > = {};

    for (const setting of settings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = {
          label:
            CATEGORY_LABELS[setting.category] || setting.category,
          settings: [],
        };
      }
      grouped[setting.category].settings.push(setting);
    }

    // Attach metadata from defaults (options, min, max)
    const enriched = Object.entries(grouped).map(([category, group]) => ({
      category,
      label: group.label,
      settings: group.settings.map((s) => {
        const def = DEFAULT_SETTINGS.find((d) => d.key === s.key);
        return {
          ...s,
          options: def?.options,
          min: def?.min,
          max: def?.max,
        };
      }),
    }));

    return NextResponse.json({ groups: enriched });
  } catch (err) {
    return NextResponse.json(
      { error: "Fehler beim Laden der Einstellungen" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings — Update a single runtime setting.
 * Body: { key: string, value: string }
 * Requires ADMIN role. Only keys defined in DEFAULT_SETTINGS are accepted.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined || value === null) {
      return NextResponse.json(
        { error: "Felder 'key' und 'value' sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate that the key exists in default settings (no arbitrary keys)
    const def = DEFAULT_SETTINGS.find((d) => d.key === key);
    if (!def) {
      return NextResponse.json(
        { error: `Unbekannte Einstellung: ${key}` },
        { status: 400 }
      );
    }

    // Type validation
    if (def.type === "number") {
      const num = parseInt(String(value), 10);
      if (isNaN(num)) {
        return NextResponse.json(
          { error: `Wert fuer '${key}' muss eine Zahl sein` },
          { status: 400 }
        );
      }
      if (def.min !== undefined && num < def.min) {
        return NextResponse.json(
          { error: `Wert fuer '${key}' muss mindestens ${def.min} sein` },
          { status: 400 }
        );
      }
      if (def.max !== undefined && num > def.max) {
        return NextResponse.json(
          { error: `Wert fuer '${key}' darf hoechstens ${def.max} sein` },
          { status: 400 }
        );
      }
    }

    if (def.type === "boolean" && value !== "true" && value !== "false") {
      return NextResponse.json(
        { error: `Wert fuer '${key}' muss 'true' oder 'false' sein` },
        { status: 400 }
      );
    }

    if (def.options && !def.options.includes(String(value))) {
      return NextResponse.json(
        {
          error: `Ungueltiger Wert fuer '${key}'. Erlaubt: ${def.options.join(", ")}`,
        },
        { status: 400 }
      );
    }

    await updateSetting(key, String(value));

    return NextResponse.json({ success: true, key, value: String(value) });
  } catch (err) {
    return NextResponse.json(
      { error: "Fehler beim Speichern der Einstellung" },
      { status: 500 }
    );
  }
}
