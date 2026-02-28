import { useEffect, useMemo, useState } from "react";
import { apiGet, apiFetch } from "../lib/api";
import { useAuth } from "../state/auth";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Brain, CalendarDays, Database, Flame, ShieldCheck } from "lucide-react";

type Summary = {
  total_events: number;
  labeled_events: number;
  label1_events: number;
  label0_events: number;
  last_7d_events: number;
  last_7d_label1_rate: number;
};

type TsPoint = {
  date: string;
  count: number;
  labeled: number;
};

type Term = { term: string; count: number };
type Insight = { title: string; severity: "info" | "warning" | "critical"; recommendation: string; rationale: string };

function fmtPct(x: number) {
  if (!Number.isFinite(x)) return "-";
  return `${Math.round(x * 100)}%`;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-white/60">{title}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
          {subtitle ? <div className="mt-1 text-xs text-white/50">{subtitle}</div> : null}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/80">{icon}</div>
      </div>
    </div>
  );
}

function SeverityPill({ level }: { level: Insight["severity"] }) {
  const cls =
    level === "critical"
      ? "bg-red-500/15 text-red-200 border-red-400/20"
      : level === "warning"
        ? "bg-amber-500/15 text-amber-200 border-amber-400/20"
        : "bg-cyan-500/15 text-cyan-200 border-cyan-400/20";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>{level}</span>;
}

export default function Dashboard() {
  const { token, user } = useAuth();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<TsPoint[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [ingestTab, setIngestTab] = useState<"manual" | "db">("manual");
  const [manualText, setManualText] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dbUrl, setDbUrl] = useState("");
  const [dbQuery, setDbQuery] = useState("SELECT descripcion AS text, criticidad AS label\nFROM incidencias\nLIMIT 1000");
  const [dbTextCol, setDbTextCol] = useState("text");
  const [dbLabelCol, setDbLabelCol] = useState("label");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [s, ts, t, i] = await Promise.all([
          apiGet<Summary>("/analytics/summary"),
          apiGet<TsPoint[]>(`/analytics/timeseries?days=${days}`),
          apiGet<Term[]>("/analytics/top_terms?limit=12"),
          apiGet<Insight[]>("/ai/insights"),
        ]);
        if (cancelled) return;
        setSummary(s);
        setSeries(ts);
        setTerms(t);
        setInsights(i);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Error cargando el dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, days, refresh]);

  const labelRate = useMemo(() => {
    if (!summary || summary.total_events === 0) return 0;
    return summary.labeled_events / summary.total_events;
  }, [summary]);

  const label1Rate = useMemo(() => {
    if (!summary || summary.labeled_events === 0) return 0;
    return summary.label1_events / summary.labeled_events;
  }, [summary]);

  async function sendManual() {
    if (!manualText.trim()) return;
    setIngestLoading(true);
    setIngestMsg(null);
    try {
      const res = await apiFetch("/events", {
        method: "POST",
        body: JSON.stringify({
          text: manualText.trim(),
          ...(manualLabel !== "" && { label: parseInt(manualLabel) }),
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setIngestMsg({ ok: false, text: e.detail || "Error enviando evento" });
        return;
      }
      setManualText("");
      setManualLabel("");
      setIngestMsg({ ok: true, text: "Evento añadido. Actualizando KPIs..." });
      setRefresh((r) => r + 1);
    } catch (e: any) {
      setIngestMsg({ ok: false, text: e.message || "Error de red" });
    } finally {
      setIngestLoading(false);
    }
  }

  async function importFromDb() {
    if (!dbUrl.trim() || !dbQuery.trim()) return;
    setIngestLoading(true);
    setIngestMsg(null);
    try {
      const res = await apiFetch("/ingest/db_query", {
        method: "POST",
        body: JSON.stringify({
          connection_url: dbUrl.trim(),
          query: dbQuery.trim(),
          text_column: dbTextCol.trim() || "text",
          label_column: dbLabelCol.trim() || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setIngestMsg({ ok: false, text: e.detail || "Error importando" });
        return;
      }
      const data = await res.json();
      setIngestMsg({ ok: true, text: `${data.inserted} eventos importados. Actualizando KPIs...` });
      setRefresh((r) => r + 1);
    } catch (e: any) {
      setIngestMsg({ ok: false, text: e.message || "Error de red" });
    } finally {
      setIngestLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full overflow-y-auto px-6 py-6 text-white" style={{ background: "radial-gradient(1200px 700px at 20% 0%, rgba(114,78,255,.25), transparent 60%), radial-gradient(900px 600px at 90% 10%, rgba(0,229,255,.18), transparent 55%), #070A12" }}>
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Centro de Operaciones</div>
          <div className="mt-1 text-sm text-white/60">KPIs en tiempo real, tendencias y recomendaciones accionables de IA.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            <span className="mr-2 text-white/50">Conectado como</span>
            <span className="font-medium text-white/90">{user?.email ?? "-"}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <CalendarDays className="h-4 w-4 text-white/70" />
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-transparent text-sm text-white/80 outline-none"
              aria-label="Rango de días"
            >
              <option value={7}>7 días</option>
              <option value={14}>14 días</option>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
            </select>
          </div>
        </div>
      </div>

      {err ? (
        <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{err}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <StatCard title="Eventos" value={summary ? String(summary.total_events) : loading ? "..." : "0"} subtitle="Total ingerido" icon={<Database className="h-5 w-5" />} />
        <StatCard title="Etiquetado" value={summary ? fmtPct(labelRate) : loading ? "..." : "-"} subtitle="Porcentaje con etiqueta (0/1)" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard title="Riesgo" value={summary ? fmtPct(label1Rate) : loading ? "..." : "-"} subtitle="Ratio label=1 sobre etiquetados" icon={<Flame className="h-5 w-5" />} />
        <StatCard title="Últimos 7 días" value={summary ? String(summary.last_7d_events) : loading ? "..." : "0"} subtitle="Actividad reciente" icon={<Brain className="h-5 w-5" />} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Tendencia de ingestión</div>
              <div className="mt-1 text-xs text-white/55">Eventos diarios (y volumen etiquetado). Útil para ver picos y caídas.</div>
            </div>
          </div>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12 }}
                  labelStyle={{ color: "rgba(255,255,255,0.75)" }}
                />
                <Area type="monotone" dataKey="count" stroke="rgba(255,255,255,0.7)" fill="rgba(255,255,255,0.12)" />
                <Area type="monotone" dataKey="labeled" stroke="rgba(0,255,255,0.55)" fill="rgba(0,255,255,0.10)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm font-medium">Cajón IA</div>
          <div className="mt-1 text-xs text-white/55">Recomendaciones para decidir qué hacer ahora (basado en tu ingesta reciente).</div>
          <div className="mt-3 space-y-3">
            {loading ? (
              <div className="text-sm text-white/60">Cargando recomendaciones...</div>
            ) : insights.length ? (
              insights.map((it, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{it.title}</div>
                    <SeverityPill level={it.severity} />
                  </div>
                  <div className="mt-1 text-xs text-white/60">{it.recommendation}</div>
                  <div className="mt-2 text-[11px] text-white/40">{it.rationale}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/60">Sin insights todavía. Ingresa más eventos y añade etiquetas (0/1).</div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
            <div className="font-medium text-white/80">Tip operativo</div>
            <div className="mt-1">Etiqueta 10–20 eventos (0/1). La IA aprende online y mejora la predicción para tu contexto.</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm font-medium">Temas más frecuentes</div>
          <div className="mt-1 text-xs text-white/55">Ranking rápido para descubrir patrones (keywords de tu ingesta).</div>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={terms} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
                <YAxis type="category" dataKey="term" width={90} tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12 }}
                  labelStyle={{ color: "rgba(255,255,255,0.75)" }}
                />
                <Bar dataKey="count" fill="rgba(255,255,255,0.22)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur lg:col-span-2">
          <div className="text-sm font-medium">Conectar Datos</div>
          <div className="mt-1 text-xs text-white/55">Ingesta manual o desde tu base de datos. Los KPIs se actualizan automáticamente.</div>

          {/* Tabs */}
          <div className="mt-3 flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
            {(["manual", "db"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setIngestTab(tab); setIngestMsg(null); }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${ingestTab === tab ? "bg-white/15 text-white" : "text-white/50 hover:text-white/70"}`}
              >
                {tab === "manual" ? "Manual" : "Base de datos"}
              </button>
            ))}
          </div>

          {ingestTab === "manual" ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Describe el evento, incidencia o entrada de datos..."
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20"
                rows={3}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-white/50">Etiqueta:</span>
                {(["", "0", "1"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setManualLabel(v)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${manualLabel === v ? "border-white/30 bg-white/15 text-white" : "border-white/10 text-white/40 hover:text-white/70"}`}
                  >
                    {v === "" ? "Sin etiqueta" : v === "0" ? "Normal (0)" : "Crítico (1)"}
                  </button>
                ))}
              </div>
              <button
                disabled={!manualText.trim() || ingestLoading}
                onClick={sendManual}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ingestLoading ? "Enviando..." : "Enviar evento"}
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <input
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                placeholder="postgresql+psycopg://user:pass@host:5432/db"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none placeholder:text-white/30 focus:border-white/20"
              />
              <textarea
                value={dbQuery}
                onChange={(e) => setDbQuery(e.target.value)}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none placeholder:text-white/30 focus:border-white/20"
                rows={3}
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="mb-1 text-xs text-white/50">Columna de texto</div>
                  <input
                    value={dbTextCol}
                    onChange={(e) => setDbTextCol(e.target.value)}
                    placeholder="text"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:border-white/20"
                  />
                </div>
                <div className="flex-1">
                  <div className="mb-1 text-xs text-white/50">Columna etiqueta (opcional)</div>
                  <input
                    value={dbLabelCol}
                    onChange={(e) => setDbLabelCol(e.target.value)}
                    placeholder="label"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:border-white/20"
                  />
                </div>
              </div>
              <button
                disabled={!dbUrl.trim() || !dbQuery.trim() || ingestLoading}
                onClick={importFromDb}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ingestLoading ? "Importando..." : "Importar desde BD"}
              </button>
            </div>
          )}

          {ingestMsg ? (
            <div className={`mt-2 rounded-xl border p-3 text-xs ${ingestMsg.ok ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-red-400/20 bg-red-500/10 text-red-200"}`}>
              {ingestMsg.text}
            </div>
          ) : null}
        </div>
      </div>
    </div>
    </div>
  );
}
