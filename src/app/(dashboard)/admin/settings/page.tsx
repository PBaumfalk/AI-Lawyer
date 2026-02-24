"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Info } from "lucide-react";

interface SettingItem {
  id: string;
  key: string;
  value: string;
  type: string;
  category: string;
  label: string | null;
  options?: string[];
  min?: number;
  max?: number;
}

interface SettingGroup {
  category: string;
  label: string;
  settings: SettingItem[];
}

export default function AdminSettingsPage() {
  const [groups, setGroups] = useState<SettingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setGroups(data.groups);

      // Initialize local values
      const vals: Record<string, string> = {};
      for (const group of data.groups) {
        for (const setting of group.settings) {
          vals[setting.key] = setting.value;
        }
      }
      setValues(vals);
    } catch {
      toast.error("Einstellungen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (key: string) => {
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: values[key] }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Speichern");
        return;
      }

      toast.success("Einstellung gespeichert");
    } catch {
      toast.error("Fehler beim Speichern der Einstellung");
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleValueChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-heading font-bold">Einstellungen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Laufzeit-Konfiguration ohne Neustart aendern
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3 text-blue-800">
        <Info className="w-5 h-5 mt-0.5 shrink-0" />
        <p className="text-sm">
          Aenderungen werden sofort wirksam, kein Neustart erforderlich.
          Der Worker uebernimmt neue Werte automatisch innerhalb weniger Sekunden.
        </p>
      </div>

      {/* Settings groups */}
      {groups.map((group) => (
        <Card key={group.category}>
          <CardHeader>
            <CardTitle className="text-lg">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {group.settings.map((setting) => (
              <SettingField
                key={setting.key}
                setting={setting}
                value={values[setting.key] ?? setting.value}
                onChange={(val) => handleValueChange(setting.key, val)}
                onSave={() => handleSave(setting.key)}
                isSaving={saving[setting.key] || false}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Keine Einstellungen gefunden
        </p>
      )}
    </div>
  );
}

function SettingField({
  setting,
  value,
  onChange,
  onSave,
  isSaving,
}: {
  setting: SettingItem;
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const isDirty = value !== setting.value;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">
          {setting.label || setting.key}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          {setting.key}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Render input based on type */}
        {setting.type === "boolean" ? (
          <Switch
            checked={value === "true"}
            onCheckedChange={(checked) => {
              onChange(checked ? "true" : "false");
              // Auto-save for boolean toggles
              setTimeout(() => {
                // Trigger save with new value
                fetch("/api/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    key: setting.key,
                    value: checked ? "true" : "false",
                  }),
                })
                  .then((res) => {
                    if (res.ok) {
                      toast.success("Einstellung gespeichert");
                      setting.value = checked ? "true" : "false";
                    } else {
                      return res.json().then((d) => {
                        toast.error(d.error || "Fehler beim Speichern");
                      });
                    }
                  })
                  .catch(() => toast.error("Fehler beim Speichern"));
              }, 0);
            }}
          />
        ) : setting.options && setting.options.length > 0 ? (
          <>
            <Select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-36"
            >
              {setting.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
            </Button>
          </>
        ) : setting.type === "number" ? (
          <>
            <Input
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              min={setting.min}
              max={setting.max}
              className="w-28"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
            </Button>
          </>
        ) : (
          <>
            <Input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-48"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
