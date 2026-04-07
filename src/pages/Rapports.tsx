import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ArrowRight, Eye, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReportStatus = "draft_preparation" | "ready_for_review" | "in_meeting" | "post_meeting_generated" | "validated";

interface Report {
  id: string;
  type: "monthly" | "weekly";
  label: string;
  period: string;
  status: ReportStatus;
  updatedAt: string;
}

const reports: Report[] = [
  { id: "r1", type: "monthly", label: "Monthly — Mars 2026", period: "1 mars → 31 mars 2026", status: "draft_preparation", updatedAt: "Aujourd'hui, 09h14" },
  { id: "r2", type: "weekly", label: "Weekly — Semaine 12", period: "18 → 24 mars 2026", status: "validated", updatedAt: "25 mars 2026" },
  { id: "r3", type: "monthly", label: "Monthly — Février 2026", period: "1 fév → 28 fév 2026", status: "validated", updatedAt: "3 mars 2026" },
  { id: "r4", type: "weekly", label: "Weekly — Semaine 11", period: "11 → 17 mars 2026", status: "validated", updatedAt: "18 mars 2026" },
  { id: "r5", type: "monthly", label: "Monthly — Janvier 2026", period: "1 jan → 31 jan 2026", status: "validated", updatedAt: "2 fév 2026" },
];

const filters = [
  { key: "all", label: "Tous" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "validated", label: "Validés" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

const statusConfig: Record<ReportStatus, { label: string; bg: string; text: string; icon?: boolean }> = {
  draft_preparation: { label: "En préparation", bg: "bg-muted", text: "text-muted-foreground" },
  ready_for_review: { label: "Prêt pour réunion", bg: "bg-amber-50", text: "text-warning" },
  in_meeting: { label: "En réunion", bg: "bg-orange-50", text: "text-orange-700" },
  post_meeting_generated: { label: "Post-réunion", bg: "bg-blue-50", text: "text-blue-700" },
  validated: { label: "Validé", bg: "bg-emerald-50", text: "text-success", icon: true },
};

export default function Rapports() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const navigate = useNavigate();

  const filtered = reports.filter((r) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "weekly") return r.type === "weekly";
    if (activeFilter === "monthly") return r.type === "monthly";
    if (activeFilter === "validated") return r.status === "validated";
    return true;
  });

  return (
    <>
      <AppHeader title="Mes rapports" />

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              activeFilter === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-foreground font-medium">Aucun rapport trouvé</p>
          <p className="text-sm text-muted-foreground mt-1">Modifiez vos filtres ou créez un nouveau rapport</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => {
            const isDraft = r.status === "draft_preparation";
            const sc = statusConfig[r.status];
            return (
              <div
                key={r.id}
                className={`flex items-center gap-4 bg-card rounded-lg border border-border shadow-sm p-5 flex-wrap ${
                  isDraft ? "border-l-4 border-l-primary" : ""
                }`}
              >
                {/* Left */}
                <div className="flex flex-col gap-1.5 min-w-[220px] flex-1">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
                      r.type === "weekly"
                        ? "bg-emerald-50 text-success"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {r.type === "weekly" ? "🟢 Weekly" : "🔵 Monthly"}
                  </span>
                  <p className="font-semibold text-foreground">{r.label}</p>
                  <p className="text-sm text-muted-foreground">{r.period}</p>
                </div>

                {/* Middle */}
                <div className="flex items-center">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                    {sc.icon && <Check className="h-3 w-3" />}
                    {sc.label}
                  </span>
                </div>

                {/* Right */}
                <div className="flex items-center gap-4 ml-auto">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{r.updatedAt}</span>
                  {isDraft ? (
                    <Button size="sm" className="gap-1.5" onClick={() => navigate(`/rapport/${r.id}`)}>
                      Continuer <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/rapport/${r.id}`)}>
                      <Eye className="h-4 w-4" /> Voir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
