"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Save,
  Zap,
  Clock,
  BarChart3,
} from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderOption {
  value: string;
  label: string;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { value: "ollama", label: "Ollama (Lokal)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

const DEFAULT_MODELS: Record<string, string> = {
  ollama: "qwen3.5:35b",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
};

interface UsageSummary {
  period: string;
  totalTokens: number;
  totalTokensIn: number;
  totalTokensOut: number;
  byFunktion: Record<string, { tokensIn: number; tokensOut: number }>;
  byUser: { userId: string; userName: string; total: number }[];
}

interface BudgetInfo {
  used: number;
  limit: number;
  percentage: number;
  paused: boolean;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function KiEinstellungenPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Provider config
  const [provider, setProvider] = useState("ollama");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("qwen3.5:35b");
  const [ollamaUrl, setOllamaUrl] = useState("http://ollama:11434");
  const [monthlyBudget, setMonthlyBudget] = useState("0");

  // Feature toggles
  const [scanEnabled, setScanEnabled] = useState(true);
  const [briefingEnabled, setBriefingEnabled] = useState(false);
  const [briefingTime, setBriefingTime] = useState("07:00");

  // Connection test
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency?: number;
    error?: string;
  } | null>(null);

  // Provider availability (checked on load)
  const [providerAvailable, setProviderAvailable] = useState<boolean | null>(
    null
  );

  // Usage data
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [usagePeriod, setUsagePeriod] = useState<"day" | "week" | "month">(
    "month"
  );

  // Load session and settings
  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/einstellungen/export").then((r) => r.json()),
    ])
      .then(([sessionData, settingsData]) => {
        setSession(sessionData);

        // Redirect non-admin users
        if (sessionData?.user?.role !== "ADMIN") {
          router.push("/einstellungen");
          return;
        }

        // Parse settings
        const settings = settingsData.systemSettings || [];
        const get = (key: string, fallback: string) =>
          settings.find((s: any) => s.key === key)?.value ?? fallback;

        setProvider(get("ai.provider", "ollama"));
        setApiKey(get("ai.provider.apiKey", ""));
        setModel(get("ai.provider.model", "qwen3.5:35b"));
        setOllamaUrl(get("ai.ollama.url", "http://ollama:11434"));
        setMonthlyBudget(get("ai.monthly_budget", "0"));
        setScanEnabled(get("ai.scan_enabled", "true") === "true");
        setBriefingEnabled(get("ai.briefing_enabled", "false") === "true");
        setBriefingTime(get("ai.briefing_time", "07:00"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  // Load usage data
  const loadUsage = useCallback(() => {
    fetch(`/api/ki/usage?period=${usagePeriod}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.usage) setUsage(data.usage);
        if (data.budget) setBudget(data.budget);
        // Check provider availability from the test on load
        if (data.providerAvailable !== undefined) {
          setProviderAvailable(data.providerAvailable);
        }
      })
      .catch(() => {});
  }, [usagePeriod]);

  useEffect(() => {
    if (!loading && session?.user?.role === "ADMIN") {
      loadUsage();
    }
  }, [loading, session, loadUsage]);

  // Auto-update model when provider changes
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setModel(DEFAULT_MODELS[newProvider] || "qwen3.5:35b");
    setTestResult(null);
  };

  // Test connection
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ki/provider-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          model,
          ollamaUrl,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      setProviderAvailable(data.success);
    } catch {
      setTestResult({ success: false, error: "Netzwerkfehler" });
    } finally {
      setTesting(false);
    }
  };

  // Save settings
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/einstellungen/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "1.0",
          systemSettings: [
            {
              key: "ai.provider",
              value: provider,
              type: "string",
              category: "ai",
              label: "KI-Provider",
            },
            {
              key: "ai.provider.apiKey",
              value: apiKey,
              type: "string",
              category: "ai",
              label: "API-Schluessel",
            },
            {
              key: "ai.provider.model",
              value: model,
              type: "string",
              category: "ai",
              label: "KI-Modell",
            },
            {
              key: "ai.ollama.url",
              value: ollamaUrl,
              type: "string",
              category: "ai",
              label: "Ollama-URL",
            },
            {
              key: "ai.monthly_budget",
              value: monthlyBudget,
              type: "number",
              category: "ai",
              label: "Monatliches Token-Budget",
            },
            {
              key: "ai.scan_enabled",
              value: String(scanEnabled),
              type: "boolean",
              category: "ai",
              label: "Proaktive Aktenanalyse",
            },
            {
              key: "ai.briefing_enabled",
              value: String(briefingEnabled),
              type: "boolean",
              category: "ai",
              label: "Tagesbriefing aktiviert",
            },
            {
              key: "ai.briefing_time",
              value: briefingTime,
              type: "string",
              category: "ai",
              label: "Briefing-Uhrzeit",
            },
          ],
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // Fail silently
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Lade KI-Einstellungen...</div>
      </div>
    );
  }

  if (session?.user?.role !== "ADMIN") {
    return null;
  }

  const FUNKTION_LABELS: Record<string, string> = {
    CHAT: "Chat",
    SCAN: "Aktenanalyse",
    ENTWURF: "Entwurf",
    BRIEFING: "Briefing",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          KI-Einstellungen
        </h1>
        <p className="text-muted-foreground mt-1">
          Helena - KI-Assistentin konfigurieren
        </p>
      </div>

      {/* Unavailable banner */}
      {providerAvailable === false && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Helena ist gerade nicht verfuegbar
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Der KI-Provider ist nicht erreichbar. Bitte pruefen Sie die
              Verbindungseinstellungen.
            </p>
          </div>
        </div>
      )}

      {/* Budget warning */}
      {budget && budget.paused && (
        <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3">
          <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
              Token-Budget aufgebraucht
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Das monatliche Token-Budget ist zu {budget.percentage}% verbraucht.
              Helena ist pausiert.
            </p>
          </div>
        </div>
      )}

      {/* Provider Configuration */}
      <GlassPanel elevation="panel" className="p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5" />
          Provider-Konfiguration
        </h2>

        <div className="space-y-4">
          {/* Provider selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              KI-Provider
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="glass-input w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* API Key (cloud providers only) */}
          {(provider === "openai" || provider === "anthropic") && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                API-Schluessel
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  provider === "openai"
                    ? "sk-..."
                    : "sk-ant-..."
                }
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
          )}

          {/* Model name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Modell
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="glass-input w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {provider === "ollama"
                ? "z.B. qwen3.5:35b, llama3:8b, codellama:13b"
                : provider === "openai"
                ? "z.B. gpt-4o, gpt-4o-mini, gpt-3.5-turbo"
                : "z.B. claude-sonnet-4-20250514, claude-3-5-haiku-20241022"}
            </p>
          </div>

          {/* Ollama URL (Ollama only) */}
          {provider === "ollama" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Ollama-URL
              </label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
              />
            </div>
          )}

          {/* Test connection button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Verbindung testen
            </button>

            {testResult && (
              <div className="flex items-center gap-2 text-sm">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Verbunden ({testResult.latency}ms)
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-500" />
                    <span className="text-rose-600 dark:text-rose-400">
                      {testResult.error || "Verbindung fehlgeschlagen"}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </GlassPanel>

      {/* Feature Toggles */}
      <GlassPanel elevation="panel" className="p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Automatisierung
        </h2>

        <div className="space-y-4">
          {/* Monthly budget */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Monatliches Token-Budget
            </label>
            <input
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              min={0}
              className="glass-input w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              0 = unbegrenzt. Bei Erreichen des Budgets wird Helena pausiert.
            </p>
          </div>

          {/* Proactive scanning toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                Proaktive Aktenanalyse
              </p>
              <p className="text-xs text-muted-foreground">
                Helena analysiert Akten regelmaessig auf neue Aufgaben
              </p>
            </div>
            <button
              onClick={() => setScanEnabled(!scanEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                scanEnabled ? "bg-blue-600" : "bg-slate-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  scanEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Daily briefing toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                Tagesbriefing
              </p>
              <p className="text-xs text-muted-foreground">
                Helena erstellt taeglich ein Briefing ueber anstehende Aufgaben
              </p>
            </div>
            <button
              onClick={() => setBriefingEnabled(!briefingEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                briefingEnabled ? "bg-blue-600" : "bg-slate-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  briefingEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Briefing time (only when enabled) */}
          {briefingEnabled && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Briefing-Uhrzeit
              </label>
              <input
                type="time"
                value={briefingTime}
                onChange={(e) => setBriefingTime(e.target.value)}
                className="glass-input w-48 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
              />
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Token Usage */}
      <GlassPanel elevation="panel" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Token-Verbrauch
          </h2>
          <div className="flex gap-1">
            {(["day", "week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setUsagePeriod(p)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  usagePeriod === p
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:bg-white/10"
                }`}
              >
                {p === "day" ? "Heute" : p === "week" ? "Woche" : "Monat"}
              </button>
            ))}
          </div>
        </div>

        {usage ? (
          <div className="space-y-4">
            {/* Total tokens */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xs text-muted-foreground">Eingabe-Tokens</p>
                <p className="text-lg font-medium text-foreground">
                  {usage.totalTokensIn.toLocaleString("de-DE")}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xs text-muted-foreground">Ausgabe-Tokens</p>
                <p className="text-lg font-medium text-foreground">
                  {usage.totalTokensOut.toLocaleString("de-DE")}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xs text-muted-foreground">Gesamt</p>
                <p className="text-lg font-medium text-foreground">
                  {usage.totalTokens.toLocaleString("de-DE")}
                </p>
              </div>
            </div>

            {/* Budget bar */}
            {budget && budget.limit > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Budget-Verbrauch</span>
                  <span>
                    {budget.used.toLocaleString("de-DE")} /{" "}
                    {budget.limit.toLocaleString("de-DE")} ({budget.percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budget.percentage >= 100
                        ? "bg-rose-500"
                        : budget.percentage >= 80
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* By function */}
            {Object.keys(usage.byFunktion).length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">
                  Nach Funktion
                </p>
                <div className="space-y-1">
                  {Object.entries(usage.byFunktion).map(([fn, data]) => (
                    <div
                      key={fn}
                      className="flex justify-between text-sm py-1 border-b border-white/5"
                    >
                      <span className="text-muted-foreground">
                        {FUNKTION_LABELS[fn] || fn}
                      </span>
                      <span className="text-foreground font-medium">
                        {(data.tokensIn + data.tokensOut).toLocaleString(
                          "de-DE"
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By user */}
            {usage.byUser.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">
                  Nach Benutzer
                </p>
                <div className="space-y-1">
                  {usage.byUser.map((u) => (
                    <div
                      key={u.userId}
                      className="flex justify-between text-sm py-1 border-b border-white/5"
                    >
                      <span className="text-muted-foreground">{u.userName}</span>
                      <span className="text-foreground font-medium">
                        {u.total.toLocaleString("de-DE")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {usage.totalTokens === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine Token-Nutzung im gewaehlten Zeitraum.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Lade Verbrauchsdaten...
          </p>
        )}
      </GlassPanel>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Einstellungen speichern
        </button>

        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            Gespeichert
          </span>
        )}
      </div>
    </div>
  );
}
