"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { X, Search } from "lucide-react";

interface DezernatData {
  id: string;
  name: string;
  beschreibung: string | null;
  mitglieder: { id: string; name: string; email: string; role: string }[];
  akten?: { id: string; aktenzeichen: string; kurzrubrum: string | null; status: string }[];
}

interface DezernatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dezernat: DezernatData | null;
  onSuccess: () => void;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AkteOption {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string | null;
}

export function DezernatDialog({
  open,
  onOpenChange,
  dezernat,
  onSuccess,
}: DezernatDialogProps) {
  const [name, setName] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [selectedAkten, setSelectedAkten] = useState<string[]>([]);
  const [availableAkten, setAvailableAkten] = useState<AkteOption[]>([]);
  const [aktenFilter, setAktenFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track original akten IDs from the full detail fetch for diff computation
  const [originalAktenIds, setOriginalAktenIds] = useState<string[]>([]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(data);
      }
    } catch {
      // Silent fail
    }
  }, []);

  const loadAkten = useCallback(async () => {
    try {
      const res = await fetch("/api/akten?take=100");
      if (res.ok) {
        const data = await res.json();
        const aktenList: AkteOption[] = (data.akten || []).map(
          (a: { id: string; aktenzeichen: string; kurzrubrum: string | null }) => ({
            id: a.id,
            aktenzeichen: a.aktenzeichen,
            kurzrubrum: a.kurzrubrum,
          })
        );
        setAvailableAkten(aktenList);
      }
    } catch {
      // Silent fail
    }
  }, []);

  const loadDezernatDetail = useCallback(async (dezernatId: string) => {
    try {
      const res = await fetch(`/api/admin/dezernate/${dezernatId}`);
      if (res.ok) {
        const data = await res.json();
        const aktenIds = (data.akten || []).map(
          (a: { id: string }) => a.id
        );
        setSelectedAkten(aktenIds);
        setOriginalAktenIds(aktenIds);
      }
    } catch {
      // Silent fail - fallback to empty
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadUsers();
      loadAkten();
      setAktenFilter("");
      if (dezernat) {
        setName(dezernat.name);
        setBeschreibung(dezernat.beschreibung || "");
        setSelectedMembers(dezernat.mitglieder.map((m) => m.id));
        // Fetch full detail to get akten list
        loadDezernatDetail(dezernat.id);
      } else {
        setName("");
        setBeschreibung("");
        setSelectedMembers([]);
        setSelectedAkten([]);
        setOriginalAktenIds([]);
      }
      setError(null);
    }
  }, [open, dezernat, loadUsers, loadAkten, loadDezernatDetail]);

  const filteredAkten = useMemo(() => {
    if (!aktenFilter.trim()) return availableAkten;
    const q = aktenFilter.toLowerCase();
    return availableAkten.filter(
      (a) =>
        a.aktenzeichen.toLowerCase().includes(q) ||
        (a.kurzrubrum && a.kurzrubrum.toLowerCase().includes(q))
    );
  }, [availableAkten, aktenFilter]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name ist erforderlich");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (dezernat) {
        // Update existing
        const currentMemberIds = dezernat.mitglieder.map((m) => m.id);
        const addMitglieder = selectedMembers.filter(
          (id) => !currentMemberIds.includes(id)
        );
        const removeMitglieder = currentMemberIds.filter(
          (id) => !selectedMembers.includes(id)
        );

        // Compute Akten diff using originalAktenIds from detail fetch
        const addAkten = selectedAkten.filter(
          (id) => !originalAktenIds.includes(id)
        );
        const removeAkten = originalAktenIds.filter(
          (id) => !selectedAkten.includes(id)
        );

        const res = await fetch(`/api/admin/dezernate/${dezernat.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            beschreibung: beschreibung.trim() || null,
            addMitglieder: addMitglieder.length > 0 ? addMitglieder : undefined,
            removeMitglieder: removeMitglieder.length > 0 ? removeMitglieder : undefined,
            addAkten: addAkten.length > 0 ? addAkten : undefined,
            removeAkten: removeAkten.length > 0 ? removeAkten : undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Fehler beim Speichern");
          return;
        }
      } else {
        // Create new
        const res = await fetch("/api/admin/dezernate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            beschreibung: beschreibung.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Fehler beim Erstellen");
          return;
        }

        const newDezernat = await res.json();

        // Add members and akten if any selected
        const patchBody: Record<string, string[]> = {};
        if (selectedMembers.length > 0) patchBody.addMitglieder = selectedMembers;
        if (selectedAkten.length > 0) patchBody.addAkten = selectedAkten;

        if (Object.keys(patchBody).length > 0) {
          await fetch(`/api/admin/dezernate/${newDezernat.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchBody),
          });
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleAkte = (akteId: string) => {
    setSelectedAkten((prev) =>
      prev.includes(akteId)
        ? prev.filter((id) => id !== akteId)
        : [...prev, akteId]
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {dezernat ? "Dezernat bearbeiten" : "Neues Dezernat"}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-sm text-rose-700 bg-rose-50 rounded-md border border-rose-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
              placeholder="z.B. Familienrecht-Team"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
              rows={2}
              placeholder="Optionale Beschreibung"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Mitglieder ({selectedMembers.length} ausgewaehlt)
            </label>
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {availableUsers.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(user.id)}
                    onChange={() => toggleMember(user.id)}
                    className="rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {user.email} -- {user.role}
                    </div>
                  </div>
                </label>
              ))}
              {availableUsers.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Keine Benutzer verfuegbar
                </div>
              )}
            </div>
          </div>

          {/* Akten multi-select section */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Zugewiesene Akten ({selectedAkten.length} ausgewaehlt)
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={aktenFilter}
                onChange={(e) => setAktenFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-md bg-background text-sm"
                placeholder="Aktenzeichen oder Kurzrubrum filtern..."
              />
            </div>
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {filteredAkten.map((akte) => (
                <label
                  key={akte.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedAkten.includes(akte.id)}
                    onChange={() => toggleAkte(akte.id)}
                    className="rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {akte.aktenzeichen}
                    </div>
                    {akte.kurzrubrum && (
                      <div className="text-xs text-muted-foreground truncate">
                        {akte.kurzrubrum}
                      </div>
                    )}
                  </div>
                </label>
              ))}
              {filteredAkten.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {aktenFilter
                    ? "Keine Akten gefunden"
                    : "Keine Akten verfuegbar"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-muted transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Speichern..." : dezernat ? "Speichern" : "Erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}
