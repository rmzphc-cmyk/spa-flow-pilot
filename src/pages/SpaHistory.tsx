import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ChevronLeft, Download, ChevronRight, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, Legend } from "recharts";

// --- Types & Mock Data ---

type CycleType = "monthly" | "weekly";
type KpiStatus = "green" | "amber" | "red";

interface HistoryReport {
  id: string;
  period: string;
  type: CycleType;
  status: "validated" | "post_meeting_generated";
  meteoEquipe: number;
  energieManager: number;
  respCompletion: number;
  summary: string;
  kpis: { label: string; unit: string; value: number; target: number; status: KpiStatus }[];
}

const spaData: Record<string, { name: string; reports: HistoryReport[] }> = {
  "par-gran-canaria": {
    name: "Par Gran Canaria",
    reports: [
      {
        id: "r-jan", period: "Janvier 2026", type: "monthly", status: "validated",
        meteoEquipe: 6, energieManager: 5, respCompletion: 65,
        summary: "Mois de reprise difficile après les fêtes. L'équipe a mis du temps à retrouver son rythme.",
        kpis: [
          { label: "CA du mois", unit: "€", value: 38000, target: 45000, status: "red" },
          { label: "Taux d'occupation", unit: "%", value: 68, target: 80, status: "red" },
          { label: "Panier moyen", unit: "€", value: 115, target: 120, status: "amber" },
          { label: "NPS clients", unit: "/10", value: 7.8, target: 8.5, status: "amber" },
          { label: "Ventes produits", unit: "€", value: 6500, target: 8000, status: "red" },
          { label: "Absentéisme", unit: "j", value: 6, target: 2, status: "red" },
        ],
      },
      {
        id: "r-w4jan", period: "25-31 Jan 2026", type: "weekly", status: "validated",
        meteoEquipe: 7, energieManager: 6, respCompletion: 70,
        summary: "Semaine de fin de mois en amélioration. Le rythme reprend progressivement.",
        kpis: [
          { label: "CA hebdo", unit: "€", value: 10200, target: 11000, status: "amber" },
          { label: "Taux d'occupation", unit: "%", value: 72, target: 80, status: "amber" },
          { label: "Panier moyen", unit: "€", value: 117, target: 120, status: "amber" },
          { label: "NPS clients", unit: "/10", value: 8.0, target: 8.5, status: "amber" },
        ],
      },
      {
        id: "r-feb", period: "Février 2026", type: "monthly", status: "validated",
        meteoEquipe: 7, energieManager: 7, respCompletion: 72,
        summary: "Le spa retrouve sa dynamique. Les vacances d'hiver ont boosté l'occupation.",
        kpis: [
          { label: "CA du mois", unit: "€", value: 44000, target: 45000, status: "amber" },
          { label: "Taux d'occupation", unit: "%", value: 79, target: 80, status: "amber" },
          { label: "Panier moyen", unit: "€", value: 122, target: 120, status: "green" },
          { label: "NPS clients", unit: "/10", value: 8.3, target: 8.5, status: "amber" },
          { label: "Ventes produits", unit: "€", value: 8200, target: 8000, status: "green" },
          { label: "Absentéisme", unit: "j", value: 3, target: 2, status: "amber" },
        ],
      },
      {
        id: "r-w2feb", period: "8-14 Fév 2026", type: "weekly", status: "validated",
        meteoEquipe: 7, energieManager: 7, respCompletion: 75,
        summary: "Semaine solide portée par les vacances d'hiver.",
        kpis: [
          { label: "CA hebdo", unit: "€", value: 11500, target: 11000, status: "green" },
          { label: "Taux d'occupation", unit: "%", value: 84, target: 80, status: "green" },
          { label: "Panier moyen", unit: "€", value: 124, target: 120, status: "green" },
          { label: "NPS clients", unit: "/10", value: 8.4, target: 8.5, status: "amber" },
        ],
      },
      {
        id: "r-mar", period: "Mars 2026", type: "monthly", status: "validated",
        meteoEquipe: 7, energieManager: 6, respCompletion: 73,
        summary: "Mois correct malgré deux arrêts maladie. Les ventes produits dépassent l'objectif.",
        kpis: [
          { label: "CA du mois", unit: "€", value: 42000, target: 45000, status: "amber" },
          { label: "Taux d'occupation", unit: "%", value: 78, target: 80, status: "amber" },
          { label: "Panier moyen", unit: "€", value: 125, target: 120, status: "green" },
          { label: "NPS clients", unit: "/10", value: 8.2, target: 8.5, status: "amber" },
          { label: "Ventes produits", unit: "€", value: 9200, target: 8000, status: "green" },
          { label: "Absentéisme", unit: "j", value: 4, target: 2, status: "red" },
        ],
      },
      {
        id: "r-w3mar", period: "18-24 Mar 2026", type: "weekly", status: "validated",
        meteoEquipe: 8, energieManager: 7, respCompletion: 88,
        summary: "Semaine stable, bonne dynamique commerciale.",
        kpis: [
          { label: "CA hebdo", unit: "€", value: 11200, target: 11000, status: "green" },
          { label: "Taux d'occupation", unit: "%", value: 82, target: 80, status: "green" },
          { label: "Panier moyen", unit: "€", value: 118, target: 120, status: "amber" },
          { label: "NPS clients", unit: "/10", value: 8.6, target: 8.5, status: "green" },
        ],
      },
    ],
  },
};

// --- Helpers ---

const meteoColor = (v: number) => (v >= 7 ? "bg-emerald-500" : v >= 5 ? "bg-amber-500" : "bg-red-500");
const statusDot: Record<KpiStatus, string> = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };
const typeBadge = (t: CycleType) =>
  t === "monthly"
    ? "bg-blue-100 text-blue-800"
    : "bg-emerald-100 text-emerald-800";

// --- Components ---

function TimelinePoint({
  report,
  isSelected,
  onClick,
}: {
  report: HistoryReport;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`flex flex-col items-center gap-1.5 min-w-[100px] px-2 py-3 rounded-xl transition-colors cursor-pointer ${
            isSelected ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted"
          }`}
        >
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${typeBadge(report.type)}`}>
            {report.type === "monthly" ? "🔵 M" : "🟢 W"}
          </span>
          <span className="text-xs font-medium text-foreground text-center leading-tight">{report.period}</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${meteoColor(report.meteoEquipe)}`} />
            <span className="text-[10px] text-muted-foreground">{report.respCompletion}%</span>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Météo : {report.meteoEquipe}/10 · Resp : {report.respCompletion}%</p>
      </TooltipContent>
    </Tooltip>
  );
}

function SidePanel({ report, onClose }: { report: HistoryReport; onClose: () => void }) {
  return (
    <div className="fixed inset-y-0 right-0 w-[380px] max-w-full bg-card border-l border-border shadow-xl z-50 overflow-y-auto animate-in slide-in-from-right duration-200">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge(report.type)}`}>
              {report.type === "monthly" ? "🔵 Monthly" : "🟢 Weekly"}
            </span>
            <h3 className="text-base font-semibold text-foreground mt-1">{report.period}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-foreground leading-relaxed mb-4">{report.summary}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-foreground">{report.meteoEquipe}<span className="text-xs text-muted-foreground">/10</span></p>
            <p className="text-[10px] text-muted-foreground">Météo équipe</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-foreground">{report.energieManager}<span className="text-xs text-muted-foreground">/10</span></p>
            <p className="text-[10px] text-muted-foreground">Énergie manager</p>
          </div>
        </div>
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">KPIs</h4>
        <div className="space-y-2">
          {report.kpis.map((kpi, i) => {
            const ecart = ((kpi.value - kpi.target) / kpi.target * 100).toFixed(1);
            return (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusDot[kpi.status]}`} />
                  <span className="text-foreground">{kpi.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{kpi.value.toLocaleString("fr-FR")}{kpi.unit}</span>
                  <span className={`text-xs ${Number(ecart) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {Number(ecart) >= 0 ? "+" : ""}{ecart}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Main ---

export default function SpaHistory() {
  const { spa } = useParams<{ spa: string }>();
  const navigate = useNavigate();

  const data = spaData[spa ?? ""];
  const [periodFilter, setPeriodFilter] = useState<"3" | "6" | "12">("6");
  const [cycleFilter, setCycleFilter] = useState<"all" | "weekly" | "monthly">("all");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<string>("");
  const [showTable, setShowTable] = useState(false);

  const filteredReports = useMemo(() => {
    if (!data) return [];
    let reports = data.reports;
    if (cycleFilter !== "all") reports = reports.filter((r) => r.type === cycleFilter);
    // Period filter would use real dates; with mock data we just slice
    const maxItems = periodFilter === "3" ? 3 : periodFilter === "6" ? 6 : 12;
    return reports.slice(-maxItems);
  }, [data, cycleFilter, periodFilter]);

  const allKpiLabels = useMemo(() => {
    if (!data) return [];
    const labels = new Set<string>();
    data.reports.forEach((r) => r.kpis.forEach((k) => labels.add(k.label)));
    return Array.from(labels);
  }, [data]);

  // Set default KPI selection
  const activeKpi = selectedKpi || allKpiLabels[0] || "";

  const kpiChartData = useMemo(() => {
    return filteredReports.map((r) => {
      const kpi = r.kpis.find((k) => k.label === activeKpi);
      return {
        period: r.period.length > 12 ? r.period.slice(0, 12) + "…" : r.period,
        value: kpi?.value ?? null,
        target: kpi?.target ?? null,
      };
    });
  }, [filteredReports, activeKpi]);

  const kpiTarget = kpiChartData.find((d) => d.target !== null)?.target ?? 0;

  const humanChartData = useMemo(() => {
    return filteredReports.map((r) => ({
      period: r.period.length > 12 ? r.period.slice(0, 12) + "…" : r.period,
      meteo: r.meteoEquipe,
      energie: r.energieManager,
    }));
  }, [filteredReports]);

  const selectedReport = filteredReports.find((r) => r.id === selectedReportId) ?? null;

  if (!data) {
    return (
      <div className="max-w-[860px] mx-auto px-6 py-12 text-center">
        <p className="text-foreground font-medium">Spa introuvable</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/rapports")}>
          Retour aux rapports
        </Button>
      </div>
    );
  }

  if (data.reports.length < 2) {
    return (
      <div className="max-w-[860px] mx-auto px-6 py-20 text-center">
        <p className="text-lg text-muted-foreground">
          Moins de 2 rapports validés — l'historique sera disponible dès le 2e rapport validé.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => navigate("/rapports")}>
          Retour aux rapports
        </Button>
      </div>
    );
  }

  const exportCSV = () => {
    const headers = ["Période", "Type", ...allKpiLabels, "Météo équipe", "Énergie manager", "Resp %"];
    const rows = filteredReports.map((r) => {
      const kpiValues = allKpiLabels.map((label) => {
        const k = r.kpis.find((kk) => kk.label === label);
        return k ? `${k.value}` : "";
      });
      return [r.period, r.type, ...kpiValues, `${r.meteoEquipe}`, `${r.energieManager}`, `${r.respCompletion}`];
    });
    const csv = [headers, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historique-${spa}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[860px] mx-auto px-6 py-6 pb-20">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1 mb-1 -ml-2" onClick={() => navigate("/rapports")}>
            <ChevronLeft className="h-4 w-4" /> Rapports
          </Button>
          <h1 className="text-xl font-bold text-foreground">Historique — {data.name}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as "3" | "6" | "12")}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 mois</SelectItem>
              <SelectItem value="6">6 mois</SelectItem>
              <SelectItem value="12">12 mois</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["all", "weekly", "monthly"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCycleFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  cycleFilter === f ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {f === "all" ? "Tous" : f === "weekly" ? "🟢 Weekly" : "🔵 Monthly"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* BLOC 1 — Timeline */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Timeline des rapports</h2>
        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-max pb-2">
            {filteredReports.map((r) => (
              <TimelinePoint
                key={r.id}
                report={r}
                isSelected={selectedReportId === r.id}
                onClick={() => setSelectedReportId(selectedReportId === r.id ? null : r.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* BLOC 2 — Évolution KPI */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Évolution métriques clés</h2>
          <Select value={activeKpi} onValueChange={setSelectedKpi}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {allKpiLabels.map((label) => (
                <SelectItem key={label} value={label}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={kpiChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <RTooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              {kpiTarget > 0 && (
                <ReferenceLine y={kpiTarget} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4" label={{ value: "Cible", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              )}
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Valeur" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* BLOC 3 — Signaux humains */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Évolution signaux humains</h2>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={humanChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <RTooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="meteo" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} name="Météo équipe" />
              <Line type="monotone" dataKey="energie" stroke="#6366F1" strokeWidth={2} dot={{ r: 4 }} name="Énergie manager" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* BLOC 4 — Tableau synthèse */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setShowTable(!showTable)} className="text-sm font-semibold text-primary hover:underline cursor-pointer">
            {showTable ? "Masquer le tableau synthèse" : "Afficher le tableau synthèse"}
          </button>
          {showTable && (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={exportCSV}>
              <Download className="h-3 w-3" /> CSV
            </Button>
          )}
        </div>
        {showTable && (
          <div className="overflow-x-auto border border-border rounded-xl shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left py-2 px-3 font-semibold text-foreground sticky left-0 bg-muted z-10">Métrique</th>
                  {filteredReports.map((r) => (
                    <th key={r.id} className="py-2 px-3 font-medium text-foreground text-center whitespace-nowrap">
                      {r.period.length > 10 ? r.period.slice(0, 10) + "…" : r.period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allKpiLabels.map((label) => (
                  <tr key={label} className="border-t border-border">
                    <td className="py-2 px-3 font-medium text-foreground sticky left-0 bg-card z-10">{label}</td>
                    {filteredReports.map((r) => {
                      const kpi = r.kpis.find((k) => k.label === label);
                      if (!kpi) return <td key={r.id} className="py-2 px-3 text-center text-muted-foreground">—</td>;
                      const cellColor = kpi.status === "green" ? "text-emerald-700 bg-emerald-50" : kpi.status === "amber" ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
                      return (
                        <td key={r.id} className={`py-2 px-3 text-center font-medium ${cellColor}`}>
                          {kpi.value.toLocaleString("fr-FR")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t border-border">
                  <td className="py-2 px-3 font-medium text-foreground sticky left-0 bg-card z-10">Météo équipe</td>
                  {filteredReports.map((r) => (
                    <td key={r.id} className="py-2 px-3 text-center font-medium text-foreground">{r.meteoEquipe}/10</td>
                  ))}
                </tr>
                <tr className="border-t border-border">
                  <td className="py-2 px-3 font-medium text-foreground sticky left-0 bg-card z-10">Énergie manager</td>
                  {filteredReports.map((r) => (
                    <td key={r.id} className="py-2 px-3 text-center font-medium text-foreground">{r.energieManager}/10</td>
                  ))}
                </tr>
                <tr className="border-t border-border">
                  <td className="py-2 px-3 font-medium text-foreground sticky left-0 bg-card z-10">Resp. %</td>
                  {filteredReports.map((r) => (
                    <td key={r.id} className="py-2 px-3 text-center font-medium text-foreground">{r.respCompletion}%</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Side panel */}
      {selectedReport && (
        <SidePanel report={selectedReport} onClose={() => setSelectedReportId(null)} />
      )}
    </div>
  );
}
