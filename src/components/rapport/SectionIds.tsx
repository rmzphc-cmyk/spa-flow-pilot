import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lightbulb, Plus, Check, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useIdsItems,
  useAddIdsItem,
  useIdsItemsForMonthlyPeriod,
  type DbIdsItem,
} from "@/hooks/useIdsItems";

interface Props {
  reportId: string;
  reportType: "monthly" | "weekly";
  periodStart?: string;
  periodEnd?: string;
}

export function SectionIds({ reportId, reportType, periodStart, periodEnd }: Props) {
  const { spaId } = useAuth();
  const { data: issues = [] } = useIdsItems(reportId);
  const { data: monthlyPreviewItems, isLoading: isLoadingPreview } = useIdsItemsForMonthlyPeriod(
    reportType === "monthly" ? spaId ?? undefined : undefined,
    periodStart,
    periodEnd,
  );
  const addItem = useAddIdsItem(reportId, reportType);
  const [newIssue, setNewIssue] = useState("");

  const addIssue = () => {
    const text = newIssue.trim();
    if (!text) return;
    addItem.mutate(text);
    setNewIssue("");
  };

  const renderIssueRowWeekly = (item: DbIdsItem) => (
    <div key={item.id} className="bg-card border border-border rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm text-foreground flex-1">{item.capture_text}</span>
      </div>
    </div>
  );

  if (reportType === "monthly") {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">IDS — Problèmes du mois</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Récapitulatif des problèmes remontés lors des réunions weekly — lecture seule
        </p>

        {isLoadingPreview ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : monthlyPreviewItems.length === 0 ? (
          <div className="bg-muted/50 border border-border rounded-xl p-8 text-center">
            <Lightbulb className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-foreground font-medium">Aucun problème signalé ce mois</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les problèmes remontés lors des weekly apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {monthlyPreviewItems.map((item) => {
              const hasTodo = item.converted_to_todo_id !== null;
              const hasObj = item.converted_to_objective_id !== null;
              const isUnresolved = !hasTodo && !hasObj;
              return (
                <div key={item.id} className="bg-card border border-border rounded-xl p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {item.report_cycle_label}
                        </span>
                        {hasTodo && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Check className="h-3 w-3" /> Todo créé
                          </span>
                        )}
                        {hasObj && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Check className="h-3 w-3" /> Objectif créé
                          </span>
                        )}
                        {isUnresolved && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            <AlertCircle className="h-3 w-3" /> À traiter en réunion
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">{item.capture_text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // Weekly fallback
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">IDS — Problèmes à remonter</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Capture seule — traitement lors de la prochaine réunion Monthly
      </p>

      <div className="space-y-2 mb-4">{issues.map(renderIssueRowWeekly)}</div>

      <div className="flex gap-2">
        <Input
          placeholder="Signaler un problème (max 150 car.)"
          maxLength={150}
          value={newIssue}
          onChange={(e) => setNewIssue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addIssue()}
          className="flex-1"
        />
        <Button size="sm" onClick={addIssue} className="gap-1.5">
          <Plus className="h-4 w-4" /> Signaler
        </Button>
      </div>
    </section>
  );
}
