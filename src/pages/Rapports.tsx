import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ArrowRight, Eye, Check, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReportStatus = "draft_preparation" | "ready_for_review" | "in_meeting" | "post_meeting_generated" | "validated";

interface Report {
  id: string;
  type: "monthly" | "weekly";
  label: string;
  period: string;
  status: ReportStatus;
  updatedAt: string;
  meetingDate: string | null;
  completion: number;
}

const reports: Report[] = [
  { id: "r1", type: "monthly", label: "Monthly — Mars 2026", period: "1 mars → 31 mars 2026", status: "draft_preparation", updatedAt: "Aujourd'hui, 09h14", meetingDate: "28 mars 2026", completion: 29 },
  { id: "r6", type: "weekly", label: "Weekly — Semaine 13", period: "25 → 31 mars 2026", status: "draft_preparation", updatedAt: "Aujourd'hui, 08h00", meetingDate: null, completion: 14 },
  { id: "r2", type: "weekly", label: "Weekly — Semaine 12", period: "18 → 24 mars 2026", status: "validated", updatedAt: "25 mars 2026", meetingDate: null, completion: 100 },
  { id: "r3", type: "monthly", label: "Monthly — Février 2026", period: "1 fév → 28 fév 2026", status: "validated", updatedAt: "3 mars 2026", meetingDate: "28 fév 2026", completion: 100 },
  { id: "r4", type: "weekly", label: "Weekly — Semaine 11", period: "11 → 17 mars 2026", status: "validated", updatedAt: "18 mars 2026", meetingDate: null, completion: 100 },
  { id: "r5", type: "monthly", label: "Monthly — Janvier 2026", period: "1 jan → 31 jan 2026", status: "validated", updatedAt: "2 fév 2026", meetingDate: "30 jan 2026", completion: 100 },
  { id: "r7", type: "monthly", label: "Monthly — Décembre 2025", period: "1 déc → 31 déc 2025", status: "validated", updatedAt: "3 jan 2026", meetingDate: "30 déc 2025", completion: 100 },
  { id: "r8", type: "weekly", label: "Weekly — Semaine 10", period: "4 → 10 mars 2026", status: "validated", updatedAt: "11 mars 2026", meetingDate: null, completion: 100 },
];

const typeFilters = [
  { key: "all", label: "Tous" },
  { key: "weekly", label: "🟢 Weekly" },
  { key: "monthly", label: "🔵 Monthly" },
] as const;

const statusFilters = [
  { key: "all", label: "Tous" },
  { key: "in_progress", label: "En cours" },
  { key: "validated", label: "Validés" },
  { key: "in_meeting", label: "En réunion" },
] as const;

type TypeFilterKey = (typeof typeFilters)[number]["key"];
type StatusFilterKey = (typeof statusFilters)[number]["key"];

const statusConfig: Record<ReportStatus, { label: string; bg: string; text: string; icon?: boolean }> = {
  draft_preparation: { label: "En préparation", bg: "bg-muted", text: "text-muted-foreground" },
  ready_for_review: { label: "Soumis pour revue", bg: "bg-blue-100", text: "text-blue-800" },
  in_meeting: { label: "En réunion", bg: "bg-orange-100", text: "text-orange-800" },
  post_meeting_generated: { label: "Synthèse prête", bg: "bg-violet-100", text: "text-violet-800" },
  validated: { label: "Validé", bg: "bg-emerald-100", text: "text-emerald-800", icon: true },
};

const PAGE_SIZE = 12;

export default function Rapports() {
  const [typeFilter, setTypeFilter] = useState<TypeFilterKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const navigate = useNavigate();

  const hasActiveReport = reports.some((r) => r.status !== "validated");

  const filtered = useMemo(() => {
    let list = [...reports];

    // Type filter
    if (typeFilter !== "all") list = list.filter((r) => r.type === typeFilter);

    // Status filter
    if (statusFilter === "in_progress") list = list.filter((r) => r.status !== "validated");
    else if (statusFilter === "validated") list = list.filter((r) => r.status === "validated");
    else if (statusFilter === "in_meeting") list = list.filter((r) => r.status === "in_meeting");

    // Period filter
    if (periodFilter === "q1_2026") list = list.filter((r) => r.period.includes("jan") || r.period.includes("fév") || r.period.includes("mars"));
    else if (periodFilter === "q4_2025") list = list.filter((r) => r.period.includes("déc"));

    // Sort: active pinned first, then by date desc (index order as proxy)
    list.sort((a, b) => {
      const aActive = a.status !== "validated" ? 0 : 1;
      const bActive = b.status !== "validated" ? 0 : 1;
      return aActive - bActive;
    });

    return list.slice(0, PAGE_SIZE);
  }, [typeFilter, statusFilter, periodFilter]);

  const getAction = (r: Report) => {
    if (r.status === "post_meeting_generated") {
      return (
        <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white" onClick={() => navigate(`/rapport/${r.id}`)}>
          <Sparkles className="h-4 w-4" /> Valider synthèse
        </Button>
      );
    }
    if (r.status === "validated") {
      return (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/rapport/${r.id}`)}>
          <Eye className="h-4 w-4" /> Voir
        </Button>
      );
    }
    return (
      <Button size="sm" className="gap-1.5" onClick={() => navigate(`/rapport/${r.id}`)}>
        Continuer <ArrowRight className="h-4 w-4" />
      </Button>
    );
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Rapports — Par Gran Canaria</h1>
        {!hasActiveReport && (
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" /> Nouveau rapport
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        {/* Type pills */}
        <div className="flex gap-1.5">
          {typeFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                typeFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Status pills */}
        <div className="flex gap-1.5">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Period dropdown */}
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les périodes</SelectItem>
            <SelectItem value="q1_2026">T1 2026 (jan–mars)</SelectItem>
            <SelectItem value="q4_2025">T4 2025 (oct–déc)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-foreground font-medium">Aucun rapport pour cette période</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Modifiez vos filtres ou créez un nouveau rapport</p>
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" /> Créer un rapport
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => {
            const isActive = r.status !== "validated";
            const sc = statusConfig[r.status];
            return (
              <div
                key={r.id}
                className={`bg-card rounded-xl border border-border shadow-sm p-5 ${
                  isActive ? "border-l-4 border-l-primary" : ""
                }`}
              >
                {/* Desktop row */}
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Period + type */}
                  <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          r.type === "weekly"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {r.type === "weekly" ? "🟢 W" : "🔵 M"}
                      </span>
                      <span className="font-semibold text-foreground text-sm">{r.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.period}</p>
                  </div>

                  {/* Status */}
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${sc.bg} ${sc.text}`}>
                    {sc.icon && <Check className="h-3 w-3" />}
                    {sc.label}
                  </span>

                  {/* Meeting date */}
                  <span className="text-xs text-muted-foreground w-[100px] text-center shrink-0">
                    {r.meetingDate ?? "—"}
                  </span>

                  {/* Completion */}
                  <div className="w-[80px] shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.completion === 100 ? "bg-emerald-500" : "bg-primary"}`}
                          style={{ width: `${r.completion}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">{r.completion}%</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0">{getAction(r)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
