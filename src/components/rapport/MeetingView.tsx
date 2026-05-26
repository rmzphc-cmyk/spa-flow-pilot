import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Target, BarChart3, MessageSquare, Lightbulb, Users, CheckSquare, Lock, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReportRecord } from "@/lib/reportsStore";
import { useAuth } from "@/contexts/AuthContext";
import { useKpiEntries } from "@/hooks/useKpiEntries";
import { useKpiDefinitions } from "@/hooks/useKpiDefinitions";
import { useCheckin, parseKeyContext } from "@/hooks/useCheckin";
import { useTodos, parseTodoDescription } from "@/hooks/useTodos";
import { useObjectives, parseObjectiveDescription } from "@/hooks/useObjectives";
import { useIdsItems, useAddIdsItem } from "@/hooks/useIdsItems";

interface SectionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}

function SectionCard({ icon: Icon, title, children }: SectionCardProps) {
  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm p-8 md:p-10">
      <header className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      </header>
      {children}
    </section>
  );
}

const statusDotClass = (status: string) => {
  if (status === "green") return "bg-emerald-500";
  if (status === "amber") return "bg-amber-500";
  if (status === "red") return "bg-red-500";
  return "bg-muted-foreground/40";
};

const objectiveStatusBadge = (s: "on_track" | "at_risk" | "behind") => {
  if (s === "on_track") return { label: "En bonne voie", cls: "bg-emerald-100 text-emerald-800" };
  if (s === "at_risk") return { label: "À risque", cls: "bg-amber-100 text-amber-800" };
  return { label: "En retard", cls: "bg-red-100 text-red-800" };
};

function formatDelta(current: number | null, n1: number | null): string {
  if (current === null || n1 === null || n1 === 0) return "—";
  const diff = ((current - n1) / Math.abs(n1)) * 100;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)} %`;
}

export function MeetingView({ report }: { report: ReportRecord }) {
  const navigate = useNavigate();
  const { spaId } = useAuth();
  const [captureText, setCaptureText] = useState("");

  const kpiEntriesQ = useKpiEntries(report.id);
  const kpiDefsQ = useKpiDefinitions(spaId);
  const checkinQ = useCheckin(report.id);
  const todosQ = useTodos(report.id, spaId);
  const objectivesQ = useObjectives(spaId);
  const idsQ = useIdsItems(report.id);
  const addIds = useAddIdsItem(report.id, report.type);

  const isLoading =
    kpiEntriesQ.isLoading ||
    kpiDefsQ.isLoading ||
    checkinQ.isLoading ||
    (report.type === "monthly" && (todosQ.isLoading || objectivesQ.isLoading)) ||
    idsQ.isLoading;

  const defsById = new Map((kpiDefsQ.data ?? []).map((d) => [d.id, d]));
  const kpiRows = (kpiEntriesQ.data ?? [])
    .map((e) => ({ entry: e, def: defsById.get(e.kpi_definition_id) }))
    .filter((r) => r.def)
    .sort((a, b) => (a.def!.display_order ?? 0) - (b.def!.display_order ?? 0));

  const checkin = checkinQ.data;
  const checkinKc = parseKeyContext(checkin?.key_context);

  const reportTodos = (todosQ.data ?? []).filter(
    (t) => t.report_id === report.id && t.status !== "done",
  );

  const handleAddIds = () => {
    const text = captureText.trim();
    if (!text) return;
    addIds.mutate(text, { onSuccess: () => setCaptureText("") });
  };

  return (
    <div className="fixed inset-0 bg-background z-40 overflow-y-auto">
      {/* Fixed top bar */}
      <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="max-w-[1200px] mx-auto px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                report.type === "weekly"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {report.type === "weekly" ? "🟢 Weekly" : "🔵 Monthly"}
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">{report.label}</h1>
              <p className="text-xs text-muted-foreground">
                Réunion · {report.meetingDate ?? report.period}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => navigate("/rapports")}>
            <X className="h-4 w-4" />
            Quitter la présentation
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-32 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement des données…
        </div>
      ) : (
        <main className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 space-y-8">
          {/* KPI */}
          <SectionCard icon={BarChart3} title="KPI — Performance du cycle">
            {kpiRows.length === 0 ? (
              <p className="text-muted-foreground">Aucun KPI renseigné.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="pb-3 pr-4">Indicateur</th>
                      <th className="pb-3 px-4 text-right">N-1</th>
                      <th className="pb-3 px-4 text-right">Réel</th>
                      <th className="pb-3 pl-4 text-right">Évolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {kpiRows.map(({ entry, def }) => (
                      <tr key={entry.id}>
                        <td className="py-4 pr-4 font-medium text-foreground">
                          <span className="inline-flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(entry.status)}`} />
                            {def!.name}
                            {def!.unit && <span className="text-muted-foreground text-sm">({def!.unit})</span>}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right text-muted-foreground tabular-nums">
                          {entry.value_n1 ?? "—"}
                        </td>
                        <td className="py-4 px-4 text-right font-semibold text-foreground tabular-nums text-lg">
                          {entry.value_current ?? "—"}
                        </td>
                        <td className="py-4 pl-4 text-right font-semibold tabular-nums text-muted-foreground">
                          {formatDelta(entry.value_current, entry.value_n1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Check-in */}
          <SectionCard icon={MessageSquare} title="Check-in équipe">
            {!checkin ? (
              <p className="text-muted-foreground">Pas de check-in renseigné.</p>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="rounded-xl border border-border p-5 bg-muted/30">
                    <p className="text-sm text-muted-foreground">Humeur équipe</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{checkin.mood_score} / 5</p>
                  </div>
                  <div className="rounded-xl border border-border p-5 bg-muted/30">
                    <p className="text-sm text-muted-foreground">Niveau de focus</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{checkin.focus_level} / 5</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {checkinKc.situation && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">Situation</h3>
                      <p className="text-foreground whitespace-pre-line">{checkinKc.situation}</p>
                    </div>
                  )}
                  {checkinKc.equipeComment && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">Équipe</h3>
                      <p className="text-foreground whitespace-pre-line">{checkinKc.equipeComment}</p>
                    </div>
                  )}
                  {checkinKc.managerComment && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">Manager</h3>
                      <p className="text-foreground whitespace-pre-line">{checkinKc.managerComment}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </SectionCard>

          {/* To-do (monthly) */}
          {report.type === "monthly" && (
            <SectionCard icon={CheckSquare} title="To-do du cycle">
              {reportTodos.length === 0 ? (
                <p className="text-muted-foreground">Aucune to-do active.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {reportTodos.map((t) => {
                    const meta = parseTodoDescription(t.description);
                    return (
                      <li key={t.id} className="py-3 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{t.title}</p>
                          <p className="text-sm text-muted-foreground">
                            👤 {meta.responsible || "—"}
                            {t.due_date && <> · 📅 {t.due_date}</>}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          )}

          {/* Objectifs (monthly) */}
          {report.type === "monthly" && (
            <SectionCard icon={Target} title="Objectifs actifs">
              {(objectivesQ.data ?? []).length === 0 ? (
                <p className="text-muted-foreground">Aucun objectif actif.</p>
              ) : (
                <div className="space-y-4">
                  {(objectivesQ.data ?? []).map((o) => {
                    const parsed = parseObjectiveDescription(o.description);
                    const badge = objectiveStatusBadge(parsed.status_ui);
                    const progress = parsed.target > 0 ? Math.min(100, Math.round((parsed.current / parsed.target) * 100)) : 0;
                    return (
                      <div key={o.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-foreground">{o.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="h-2 bg-border rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}

          {/* Responsabilités placeholder (monthly only, kept minimal) */}
          {report.type === "monthly" && (
            <SectionCard icon={Users} title="Responsabilités manager">
              <p className="text-muted-foreground text-sm">
                Synthèse détaillée disponible dans la préparation du rapport.
              </p>
            </SectionCard>
          )}

          {/* IDS — interactive capture */}
          <SectionCard icon={Lightbulb} title="IDS — Capture en direct">
            <div className="flex gap-2 mb-5">
              <Input
                value={captureText}
                onChange={(e) => setCaptureText(e.target.value)}
                placeholder="Noter un point soulevé en réunion…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddIds();
                }}
              />
              <Button onClick={handleAddIds} disabled={addIds.isPending || !captureText.trim()} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
            {(idsQ.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">Aucun point capturé.</p>
            ) : (
              <div className="space-y-3">
                {(idsQ.data ?? []).map((item, i) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-muted/20 p-5 flex gap-4 items-start"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                      {i + 1}
                    </div>
                    <p className="flex-1 text-foreground">{item.capture_text}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Clôture (monthly only) */}
          {report.type === "monthly" && (
            <SectionCard icon={Lock} title="Clôture">
              <p className="text-foreground leading-relaxed">
                La synthèse sera générée à la clôture de la réunion et soumise pour validation.
              </p>
            </SectionCard>
          )}
        </main>
      )}
    </div>
  );
}
