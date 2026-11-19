import { prisma } from "@/lib/db";
import { Prisma, Sachgebiet, type UserRole } from "@prisma/client";
import { buildAkteAccessFilter } from "@/lib/rbac";
import { cachedQuery } from "@/lib/bi/cache";
import type { BiFilterParams, KpiTile, TrendSeries, TrendPoint } from "@/lib/bi/types";
import { createLogger } from "@/lib/logger";
import crypto from "crypto";

const log = createLogger("bi-kpi");

// ─── Filter Helpers ─────────────────────────────────────────────────────────

interface DateRange {
  von: Date;
  bis: Date;
}

interface ParsedFilters {
  current: DateRange;
  previous: DateRange;
  params: BiFilterParams;
}

/** Parse query string into BiFilterParams and compute current + previous date ranges */
/** Invalid filter input from the query string (→ HTTP 400). */
export class BiFilterError extends Error {}

const ZEITRAEUME: readonly BiFilterParams["zeitraum"][] = ["monat", "quartal", "jahr", "custom"];

function parseDateParam(value: string | null, name: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new BiFilterError(`Ungueltiges Datum fuer ${name}`);
  return d;
}

export function parseBiFilters(searchParams: URLSearchParams): ParsedFilters {
  const zeitraumRaw = searchParams.get("zeitraum") || "monat";
  if (!ZEITRAEUME.includes(zeitraumRaw as BiFilterParams["zeitraum"])) {
    throw new BiFilterError("Ungueltiger Zeitraum");
  }
  const zeitraum = zeitraumRaw as BiFilterParams["zeitraum"];
  const anwaltId = searchParams.get("anwaltId") || undefined;
  const sachgebiet = searchParams.get("sachgebiet") || undefined;
  if (sachgebiet && !(sachgebiet in Sachgebiet)) {
    throw new BiFilterError("Ungueltiges Sachgebiet");
  }

  const now = new Date();
  let von: Date;
  let bis: Date;
  let prevVon: Date;
  let prevBis: Date;

  switch (zeitraum) {
    case "quartal": {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      von = new Date(now.getFullYear(), quarterMonth, 1);
      bis = new Date(now.getFullYear(), quarterMonth + 3, 0, 23, 59, 59, 999);
      prevVon = new Date(now.getFullYear(), quarterMonth - 3, 1);
      prevBis = new Date(now.getFullYear(), quarterMonth, 0, 23, 59, 59, 999);
      break;
    }
    case "jahr": {
      von = new Date(now.getFullYear(), 0, 1);
      bis = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      prevVon = new Date(now.getFullYear() - 1, 0, 1);
      prevBis = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      break;
    }
    case "custom": {
      von = parseDateParam(searchParams.get("von"), "von") ?? new Date(now.getFullYear(), now.getMonth(), 1);
      bis = parseDateParam(searchParams.get("bis"), "bis") ?? new Date(now);
      // Set bis to end of day
      bis.setHours(23, 59, 59, 999);
      const durationMs = bis.getTime() - von.getTime();
      prevBis = new Date(von.getTime() - 1);
      prevBis.setHours(23, 59, 59, 999);
      prevVon = new Date(prevBis.getTime() - durationMs);
      break;
    }
    case "monat":
    default: {
      von = new Date(now.getFullYear(), now.getMonth(), 1);
      bis = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      prevVon = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevBis = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
  }

  return {
    current: { von, bis },
    previous: { von: prevVon, bis: prevBis },
    params: {
      zeitraum,
      von: von.toISOString(),
      bis: bis.toISOString(),
      anwaltId,
      sachgebiet,
    },
  };
}

/** Compute percentage delta, handling division by zero */
function computeDelta(current: number, previous: number): number {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

// ─── Scope ──────────────────────────────────────────────────────────────────

/**
 * Which data a BI request may aggregate: the Akten the user may access
 * (buildAkteAccessFilter) narrowed by the Anwalt/Sachgebiet filters. Every
 * query below derives its WHERE clause from this one object, so a filter or an
 * access rule cannot be forgotten in a single KPI.
 */
export interface BiScope {
  /** WHERE for Akte itself; {} = no restriction (ADMIN without filters). */
  akte: Prisma.AkteWhereInput;
  /** WHERE fragment for models with an `akte` relation. */
  viaAkte: { akte?: Prisma.AkteWhereInput };
  /** Token usage is per user: non-admins only see their own consumption. */
  tokenUsage: Prisma.TokenUsageWhereInput;
}

export function buildBiScope(
  user: { id: string; role: UserRole },
  params: Pick<BiFilterParams, "anwaltId" | "sachgebiet">
): BiScope {
  const parts: Prisma.AkteWhereInput[] = [];
  const access = buildAkteAccessFilter(user.id, user.role);
  if (Object.keys(access).length > 0) parts.push(access);
  if (params.anwaltId) parts.push({ anwaltId: params.anwaltId });
  if (params.sachgebiet) parts.push({ sachgebiet: params.sachgebiet as Sachgebiet });

  const akte: Prisma.AkteWhereInput = parts.length > 0 ? { AND: parts } : {};
  const viaAkte = parts.length > 0 ? { akte } : {};

  const tokenUsage: Prisma.TokenUsageWhereInput = {
    ...(user.role === "ADMIN" ? {} : { userId: user.id }),
    ...(params.anwaltId || params.sachgebiet
      ? { akte: { ...(params.anwaltId ? { anwaltId: params.anwaltId } : {}), ...(params.sachgebiet ? { sachgebiet: params.sachgebiet as Sachgebiet } : {}) } }
      : {}),
  };

  return { akte, viaAkte, tokenUsage };
}

/** Generate a stable hash for cache key from filter params + userId */
function filterHash(filters: ParsedFilters, userId: string): string {
  const data = JSON.stringify({
    ...filters.params,
    cv: filters.current.von.toISOString(),
    cb: filters.current.bis.toISOString(),
    u: userId,
  });
  return crypto.createHash("md5").update(data).digest("hex").slice(0, 12);
}

const CACHE_TTL = 300; // 5 minutes

// ─── Akten KPIs ─────────────────────────────────────────────────────────────

export async function getAktenKpis(
  filters: ParsedFilters,
  scope: BiScope,
  userId: string
): Promise<KpiTile[]> {
  const cacheKey = `aktenKpis:${filterHash(filters, userId)}`;

  const { data } = await cachedQuery(cacheKey, CACHE_TTL, async () => {
    const baseWhere = scope.akte;

    // akten-offen: count Akte with status OFFEN
    const [offenCurrent, offenPrevious] = await Promise.all([
      prisma.akte.count({
        where: { ...baseWhere, status: "OFFEN" },
      }),
      prisma.akte.count({
        where: {
          ...baseWhere,
          status: "OFFEN",
          angelegt: { lte: filters.previous.bis },
        },
      }),
    ]);

    // akten-neuzugang: count Akte created in period
    const [neuzugangCurrent, neuzugangPrevious] = await Promise.all([
      prisma.akte.count({
        where: {
          ...baseWhere,
          angelegt: { gte: filters.current.von, lte: filters.current.bis },
        },
      }),
      prisma.akte.count({
        where: {
          ...baseWhere,
          angelegt: { gte: filters.previous.von, lte: filters.previous.bis },
        },
      }),
    ]);

    return [
      {
        id: "akten-offen",
        label: "Offene Akten",
        value: offenCurrent,
        previousValue: offenPrevious,
        delta: computeDelta(offenCurrent, offenPrevious),
        domain: "akten" as const,
      },
      {
        id: "akten-neuzugang",
        label: "Neuzugang",
        value: neuzugangCurrent,
        previousValue: neuzugangPrevious,
        delta: computeDelta(neuzugangCurrent, neuzugangPrevious),
        domain: "akten" as const,
      },
    ];
  });

  return data;
}

// ─── Finanzen KPIs ──────────────────────────────────────────────────────────

export async function getFinanzenKpis(
  filters: ParsedFilters,
  scope: BiScope,
  userId: string
): Promise<KpiTile[]> {
  const cacheKey = `finanzenKpis:${filterHash(filters, userId)}`;

  const { data } = await cachedQuery(cacheKey, CACHE_TTL, async () => {
    const anwaltFilter = scope.viaAkte;

    // finanzen-umsatz: Sum betragBrutto where rechnungsdatum in period
    const [umsatzCurrent, umsatzPrevious] = await Promise.all([
      prisma.rechnung.aggregate({
        _sum: { betragBrutto: true },
        where: {
          ...anwaltFilter,
          rechnungsdatum: { gte: filters.current.von, lte: filters.current.bis },
          status: { not: "STORNIERT" },
        },
      }),
      prisma.rechnung.aggregate({
        _sum: { betragBrutto: true },
        where: {
          ...anwaltFilter,
          rechnungsdatum: { gte: filters.previous.von, lte: filters.previous.bis },
          status: { not: "STORNIERT" },
        },
      }),
    ]);

    const currentUmsatz = Number(umsatzCurrent._sum.betragBrutto ?? 0);
    const previousUmsatz = Number(umsatzPrevious._sum.betragBrutto ?? 0);

    // finanzen-offene-rechnungen: Count where bezahltAm is null and status != STORNIERT
    const [offenCurrent, offenPrevious] = await Promise.all([
      prisma.rechnung.count({
        where: {
          ...anwaltFilter,
          bezahltAm: null,
          status: { notIn: ["STORNIERT", "BEZAHLT"] },
        },
      }),
      prisma.rechnung.count({
        where: {
          ...anwaltFilter,
          bezahltAm: null,
          status: { notIn: ["STORNIERT", "BEZAHLT"] },
          rechnungsdatum: { lte: filters.previous.bis },
        },
      }),
    ]);

    return [
      {
        id: "finanzen-umsatz",
        label: "Umsatz",
        value: currentUmsatz,
        previousValue: previousUmsatz,
        delta: computeDelta(currentUmsatz, previousUmsatz),
        unit: "EUR",
        domain: "finanzen" as const,
      },
      {
        id: "finanzen-offene-rechnungen",
        label: "Offene Rechnungen",
        value: offenCurrent,
        previousValue: offenPrevious,
        delta: computeDelta(offenCurrent, offenPrevious),
        domain: "finanzen" as const,
      },
    ];
  });

  return data;
}

// ─── Fristen KPIs ───────────────────────────────────────────────────────────

export async function getFristenKpis(
  filters: ParsedFilters,
  scope: BiScope,
  userId: string
): Promise<KpiTile[]> {
  const cacheKey = `fristenKpis:${filterHash(filters, userId)}`;

  const { data } = await cachedQuery(cacheKey, CACHE_TTL, async () => {
    const akteFilter = scope.viaAkte;

    // fristen-compliance: Percentage of FRIST entries completed on time
    // Use raw query for field-to-field comparison (erledigtAm <= datum)
    const totalFristen = await prisma.kalenderEintrag.count({
      where: {
        ...akteFilter,
        typ: "FRIST",
        datum: { gte: filters.current.von, lte: filters.current.bis },
      },
    });

    // Count fristen completed on time (erledigtAm <= datum): field-to-field
    // comparison via Prisma field reference, so the access and Anwalt/
    // Sachgebiet scope applies exactly as for the total above.
    let complianceCount = 0;
    if (totalFristen > 0) {
      complianceCount = await prisma.kalenderEintrag.count({
        where: {
          ...akteFilter,
          typ: "FRIST",
          datum: { gte: filters.current.von, lte: filters.current.bis },
          erledigt: true,
          erledigtAm: { not: null, lte: prisma.kalenderEintrag.fields.datum },
        },
      });
    }

    const complianceRate = totalFristen > 0
      ? Math.round((complianceCount / totalFristen) * 100 * 10) / 10
      : 100;

    // Previous period compliance
    const [prevTotal, prevCompleted] = await Promise.all([
      prisma.kalenderEintrag.count({
        where: {
          ...akteFilter,
          typ: "FRIST",
          datum: { gte: filters.previous.von, lte: filters.previous.bis },
        },
      }),
      prisma.kalenderEintrag.count({
        where: {
          ...akteFilter,
          typ: "FRIST",
          datum: { gte: filters.previous.von, lte: filters.previous.bis },
          erledigt: true,
        },
      }),
    ]);
    const prevRate = prevTotal > 0
      ? Math.round((prevCompleted / prevTotal) * 100 * 10) / 10
      : 100;

    // fristen-ueberfaellig: Count overdue (not erledigt, datum < now)
    const now = new Date();
    const [ueberfaelligCurrent, ueberfaelligPrevious] = await Promise.all([
      prisma.kalenderEintrag.count({
        where: {
          ...akteFilter,
          typ: "FRIST",
          erledigt: false,
          datum: { lt: now },
        },
      }),
      prisma.kalenderEintrag.count({
        where: {
          ...akteFilter,
          typ: "FRIST",
          erledigt: false,
          datum: { lt: filters.previous.bis },
        },
      }),
    ]);

    return [
      {
        id: "fristen-compliance",
        label: "Fristen-Compliance",
        value: complianceRate,
        previousValue: prevRate,
        delta: computeDelta(complianceRate, prevRate),
        unit: "%",
        domain: "fristen" as const,
      },
      {
        id: "fristen-ueberfaellig",
        label: "Ueberfaellige Fristen",
        value: ueberfaelligCurrent,
        previousValue: ueberfaelligPrevious,
        delta: computeDelta(ueberfaelligCurrent, ueberfaelligPrevious),
        domain: "fristen" as const,
      },
    ];
  });

  return data;
}

// ─── Helena KPIs ────────────────────────────────────────────────────────────

export async function getHelenaKpis(
  filters: ParsedFilters,
  scope: BiScope,
  userId: string
): Promise<KpiTile[]> {
  const cacheKey = `helenaKpis:${filterHash(filters, userId)}`;

  const { data } = await cachedQuery(cacheKey, CACHE_TTL, async () => {
    const akteFilter = scope.viaAkte;

    // helena-gespraeche: Count HelenaTask in period
    const [gespraecheCurrent, gespraechePrevious] = await Promise.all([
      prisma.helenaTask.count({
        where: {
          ...akteFilter,
          createdAt: { gte: filters.current.von, lte: filters.current.bis },
        },
      }),
      prisma.helenaTask.count({
        where: {
          ...akteFilter,
          createdAt: { gte: filters.previous.von, lte: filters.previous.bis },
        },
      }),
    ]);

    // helena-entwuerfe: Count HelenaDraft in period
    const [entwuerfeCurrent, entwuerfePrevious] = await Promise.all([
      prisma.helenaDraft.count({
        where: {
          ...akteFilter,
          createdAt: { gte: filters.current.von, lte: filters.current.bis },
        },
      }),
      prisma.helenaDraft.count({
        where: {
          ...akteFilter,
          createdAt: { gte: filters.previous.von, lte: filters.previous.bis },
        },
      }),
    ]);

    // helena-akzeptanzrate: Percentage of HelenaDraft with status ACCEPTED vs completed
    const [totalDrafts, acceptedDrafts] = await Promise.all([
      prisma.helenaDraft.count({
        where: {
          ...akteFilter,
          createdAt: { gte: filters.current.von, lte: filters.current.bis },
          status: { in: ["ACCEPTED", "REJECTED"] },
        },
      }),
      prisma.helenaDraft.count({
        where: {
          ...akteFilter,
          createdAt: { gte: filters.current.von, lte: filters.current.bis },
          status: "ACCEPTED",
        },
      }),
    ]);
    const akzeptanzrate = totalDrafts > 0
      ? Math.round((acceptedDrafts / totalDrafts) * 100 * 10) / 10
      : 0;

    const [prevTotalDrafts, prevAcceptedDrafts] = await Promise.all([
      prisma.helenaDraft.count({
        where: {
          ...akteFilter,
          createdAt: { gte: filters.previous.von, lte: filters.previous.bis },
          status: { in: ["ACCEPTED", "REJECTED"] },
        },
      }),
      prisma.helenaDraft.count({
        where: {
          ...akteFilter,
          createdAt: { gte: filters.previous.von, lte: filters.previous.bis },
          status: "ACCEPTED",
        },
      }),
    ]);
    const prevAkzeptanzrate = prevTotalDrafts > 0
      ? Math.round((prevAcceptedDrafts / prevTotalDrafts) * 100 * 10) / 10
      : 0;

    // helena-token: Sum tokensIn + tokensOut from TokenUsage in period
    const [tokenCurrent, tokenPrevious] = await Promise.all([
      prisma.tokenUsage.aggregate({
        _sum: { tokensIn: true, tokensOut: true },
        where: {
          ...scope.tokenUsage,
          createdAt: { gte: filters.current.von, lte: filters.current.bis },
        },
      }),
      prisma.tokenUsage.aggregate({
        _sum: { tokensIn: true, tokensOut: true },
        where: {
          ...scope.tokenUsage,
          createdAt: { gte: filters.previous.von, lte: filters.previous.bis },
        },
      }),
    ]);

    const currentTokens = (tokenCurrent._sum.tokensIn ?? 0) + (tokenCurrent._sum.tokensOut ?? 0);
    const previousTokens = (tokenPrevious._sum.tokensIn ?? 0) + (tokenPrevious._sum.tokensOut ?? 0);

    return [
      {
        id: "helena-gespraeche",
        label: "Helena-Gespraeche",
        value: gespraecheCurrent,
        previousValue: gespraechePrevious,
        delta: computeDelta(gespraecheCurrent, gespraechePrevious),
        domain: "helena" as const,
      },
      {
        id: "helena-entwuerfe",
        label: "Helena-Entwuerfe",
        value: entwuerfeCurrent,
        previousValue: entwuerfePrevious,
        delta: computeDelta(entwuerfeCurrent, entwuerfePrevious),
        domain: "helena" as const,
      },
      {
        id: "helena-akzeptanzrate",
        label: "Akzeptanzrate",
        value: akzeptanzrate,
        previousValue: prevAkzeptanzrate,
        delta: computeDelta(akzeptanzrate, prevAkzeptanzrate),
        unit: "%",
        domain: "helena" as const,
      },
      {
        id: "helena-token",
        label: "Token-Verbrauch",
        value: currentTokens,
        previousValue: previousTokens,
        delta: computeDelta(currentTokens, previousTokens),
        domain: "helena" as const,
      },
    ];
  });

  return data;
}

// ─── Trend Data ─────────────────────────────────────────────────────────────

export async function getTrendData(
  filters: ParsedFilters,
  scope: BiScope,
  userId: string
): Promise<TrendSeries[]> {
  const cacheKey = `trendData:${filterHash(filters, userId)}`;

  const { data } = await cachedQuery(cacheKey, CACHE_TTL, async () => {
    // Generate last 12 months of date ranges
    const now = new Date();
    const months: { von: Date; bis: Date; label: string; date: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthNames = ["Jan", "Feb", "Marz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      months.push({
        von: d,
        bis: monthEnd,
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        date: d.toISOString(),
      });
    }

    const akteFilter = scope.viaAkte;

    // Akten-Neuzugang trend
    const aktenTrend: TrendPoint[] = await Promise.all(
      months.map(async (m) => {
        const count = await prisma.akte.count({
          where: {
            ...scope.akte,
            angelegt: { gte: m.von, lte: m.bis },
          },
        });
        return { label: m.label, date: m.date, value: count };
      })
    );

    // Umsatz pro Monat trend
    const umsatzTrend: TrendPoint[] = await Promise.all(
      months.map(async (m) => {
        const result = await prisma.rechnung.aggregate({
          _sum: { betragBrutto: true },
          where: {
            ...scope.viaAkte,
            rechnungsdatum: { gte: m.von, lte: m.bis },
            status: { not: "STORNIERT" },
          },
        });
        return {
          label: m.label,
          date: m.date,
          value: Number(result._sum.betragBrutto ?? 0),
        };
      })
    );

    // Fristen-Compliance trend
    const fristenTrend: TrendPoint[] = await Promise.all(
      months.map(async (m) => {
        const [total, completed] = await Promise.all([
          prisma.kalenderEintrag.count({
            where: {
              ...akteFilter,
              typ: "FRIST",
              datum: { gte: m.von, lte: m.bis },
            },
          }),
          prisma.kalenderEintrag.count({
            where: {
              ...akteFilter,
              typ: "FRIST",
              datum: { gte: m.von, lte: m.bis },
              erledigt: true,
            },
          }),
        ]);
        const rate = total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 100;
        return { label: m.label, date: m.date, value: rate };
      })
    );

    return [
      {
        id: "akten-neuzugang",
        label: "Akten-Neuzugang",
        data: aktenTrend,
        type: "line" as const,
      },
      {
        id: "umsatz-monat",
        label: "Umsatz pro Monat",
        data: umsatzTrend,
        type: "area" as const,
      },
      {
        id: "fristen-compliance",
        label: "Fristen-Compliance",
        data: fristenTrend,
        type: "line" as const,
      },
    ];
  });

  return data;
}
