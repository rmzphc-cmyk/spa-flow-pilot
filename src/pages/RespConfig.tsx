import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  loadSchedule,
  saveScheduleToDb,
  describeSchedule,
  DAY_LABELS_FR,
  WEEK_LABELS_FR,
  type MeetingSchedule,
} from "@/lib/meetingSchedule";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useAllRespTemplates,
  useAddRespTemplate,
  useUpdateRespTemplate,
  useSoftDeleteRespTemplate,
  calcMonthlyExpected,
  type RespTemplateFullRow,
} from "@/hooks/useResponsabilites";

const CATEGORIES = [
  "RH",
  "Commercial",
  "Opérationnel",
  "Qualité",
  "Formation",
  "Administratif",
] as const;
type Category = (typeof CATEGORIES)[number];

type TabKey = "templates" | "calendrier";

interface EditingTemplate {
  id: string | null;
  title: string;
  description: string;
  category: Category;
  is_active: boolean;
  frequency: string;
  expected_count: number;
}

const EMPTY_EDIT: EditingTemplate = {
  id: null,
  title: "",
  description: "",
  category: "Opérationnel",
  is_active: true,
  frequency: "monthly",
  expected_count: 1,
};

export default function RespConfig() {
  const { user, userRole, spaId: authSpaId } = useAuth();
  const { toast: showToast } = useToast();
  const [tab, setTab] = useState<TabKey>("templates");
  const [adminSpaId, setAdminSpaId] = useState<string | null>(null);
  const spaId = userRole === "admin" ? adminSpaId : authSpaId;

  const { data: spas } = useQuery({
    queryKey: ["spas_list_admin"],
    enabled: userRole === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spas")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ----- Templates state -----
  const { data: templates = [], isLoading } = useAllRespTemplates(spaId);
  const addMut = useAddRespTemplate();
  const updateMut = useUpdateRespTemplate();
  const deleteMut = useSoftDeleteRespTemplate();

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.display_order - b.display_order),
    [templates],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EditingTemplate>(EMPTY_EDIT);
  const [deleteTarget, setDeleteTarget] = useState<RespTemplateFullRow | null>(null);

  const openCreate = () => {
    setEditing(EMPTY_EDIT);
    setSheetOpen(true);
  };

  const openEdit = (t: RespTemplateFullRow) => {
    setEditing({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      category: (CATEGORIES.includes(t.category as Category) ? t.category : "Opérationnel") as Category,
      is_active: t.is_active,
      frequency: t.frequency ?? "monthly",
      expected_count: t.expected_count ?? 1,
    });
    setSheetOpen(true);
  };

  const handleSave = () => {
    if (!spaId || !editing.title.trim()) return;
    const payload = {
      title: editing.title.trim(),
      description: editing.description.trim() || null,
      category: editing.category,
      frequency: editing.frequency,
      expected_count: editing.expected_count,
    };
    if (editing.id) {
      updateMut.mutate(
        { id: editing.id, spaId, ...payload, is_active: editing.is_active },
        {
          onSuccess: () => {
            toast.success("Template modifié ✓");
            setSheetOpen(false);
          },
          onError: (e: any) => toast.error(e?.message ?? "Erreur"),
        },
      );
    } else {
      addMut.mutate(
        { spaId, ...payload, display_order: sortedTemplates.length },
        {
          onSuccess: () => {
            toast.success("Template ajouté ✓");
            setSheetOpen(false);
          },
          onError: (e: any) => toast.error(e?.message ?? "Erreur"),
        },
      );
    }
  };

  const handleSwap = (idx: number, dir: -1 | 1) => {
    const a = sortedTemplates[idx];
    const b = sortedTemplates[idx + dir];
    if (!a || !b || !spaId) return;
    updateMut.mutate({ id: a.id, spaId, display_order: b.display_order });
    updateMut.mutate({ id: b.id, spaId, display_order: a.display_order });
  };

  const confirmDelete = () => {
    if (!deleteTarget || !spaId) return;
    deleteMut.mutate(
      { id: deleteTarget.id, spaId },
      {
        onSuccess: () => {
          toast.success("Template désactivé");
          setDeleteTarget(null);
        },
        onError: (e: any) => toast.error(e?.message ?? "Erreur"),
      },
    );
  };

  // ----- Schedule (calendrier) -----
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<MeetingSchedule>(() => loadSchedule());
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Initial load from DB once spaId is available
  useEffect(() => {
    let cancelled = false;
    if (!spaId) return;
    (async () => {
      const { data } = await supabase
        .from("spas")
        .select("meeting_schedule")
        .eq("id", spaId)
        .maybeSingle();
      if (cancelled) return;
      const dbSched = data?.meeting_schedule as Partial<MeetingSchedule> | null | undefined;
      if (dbSched) {
        setSchedule((prev) => ({ ...prev, ...dbSched }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaId]);

  // Auto-save (debounced) when schedule changes
  useEffect(() => {
    if (!spaId) return;
    const t = setTimeout(async () => {
      setIsSavingSchedule(true);
      try {
        await saveScheduleToDb(schedule);
        await queryClient.invalidateQueries({ queryKey: ["spa-schedule", spaId] });
        showToast({ title: "Calendrier sauvegardé", description: "Synchronisé sur tous vos appareils." });
      } catch (e: any) {
        showToast({ title: "Erreur", description: e?.message ?? "Erreur de sauvegarde", variant: "destructive" });
      } finally {
        setIsSavingSchedule(false);
      }
    }, 600);
    return () => clearTimeout(t);
     
  }, [schedule.weekly_day, schedule.monthly_mode, schedule.monthly_week, schedule.monthly_day, schedule.monthly_date, spaId]);

  const scheduleDesc = describeSchedule(schedule);
  void isSavingSchedule;

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 pb-20">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Responsabilités managériales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gérer les templates et la récurrence des réunions
          </p>
        </div>
        {userRole === "admin" && (
          <Select value={adminSpaId ?? ""} onValueChange={(v) => setAdminSpaId(v || null)}>
            <SelectTrigger className="w-56 h-9">
              <SelectValue placeholder="Sélectionner un spa" />
            </SelectTrigger>
            <SelectContent>
              {(spas ?? []).map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      {/* Tabs */}
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5 mb-5">
        {([
          { v: "templates" as const, label: "Templates" },
          { v: "calendrier" as const, label: "Calendrier des réunions" },
        ]).map((opt) => (
          <button
            key={opt.v}
            onClick={() => setTab(opt.v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === opt.v
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* TAB 1 — Templates */}
      {tab === "templates" && (
        <section>
          {!spaId ? (
            <div className="border border-border rounded-xl p-12 text-center text-muted-foreground">
              Sélectionner un spa
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <Button
                  size="sm"
                  className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={openCreate}
                >
                  <Plus className="h-4 w-4" /> Ajouter un template
                </Button>
              </div>

              <div className="border border-border rounded-xl overflow-hidden shadow-sm bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left py-2.5 px-4 font-semibold">Titre</th>
                      <th className="text-left py-2.5 px-4 font-semibold w-40">Catégorie</th>
                      <th className="text-left py-2.5 px-4 font-semibold w-20">Actif</th>
                      <th className="text-left py-2.5 px-4 font-semibold w-36">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          Chargement…
                        </td>
                      </tr>
                    )}
                    {!isLoading && sortedTemplates.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          Aucun template. Cliquez sur « Ajouter un template ».
                        </td>
                      </tr>
                    )}
                    {sortedTemplates.map((t, idx) => (
                      <tr key={t.id} className="border-t border-border">
                        <td className="py-2 px-4">
                          <div className="font-medium">{t.title}</div>
                          <FreqBadges frequency={t.frequency} expectedCount={t.expected_count} />
                          {t.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {t.description}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-4 text-muted-foreground">
                          {t.category ?? "—"}
                        </td>
                        <td className="py-2 px-4">
                          <Switch
                            checked={t.is_active}
                            onCheckedChange={(v) => {
                              updateMut.mutate(
                                { id: t.id, spaId, is_active: v },
                                {
                                  onSuccess: () => toast.success("Sauvegardé ✓"),
                                  onError: (e: any) => toast.error(e?.message ?? "Erreur"),
                                },
                              );
                            }}
                          />
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={idx === 0}
                              onClick={() => handleSwap(idx, -1)}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={idx === sortedTemplates.length - 1}
                              onClick={() => handleSwap(idx, 1)}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteTarget(t)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* TAB 2 — Calendrier des réunions */}
      {tab === "calendrier" && (
        <section>
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-6">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4 mt-0.5 text-primary" />
              <p>
                Définissez la récurrence des réunions Weekly et Monthly. Le dashboard utilise ces
                réglages pour afficher la prochaine réunion et envoyer les rappels.
              </p>
            </div>

            <div className="border-t border-border pt-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  🟢 Weekly
                </span>
                <span className="text-sm text-muted-foreground">{scheduleDesc.weekly}</span>
              </div>
              <Label className="text-sm font-medium">Jour de la semaine récurrent</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Ex : tous les jeudis</p>
              <Select
                value={String(schedule.weekly_day)}
                onValueChange={(v) => setSchedule({ ...schedule, weekly_day: Number(v) })}
              >
                <SelectTrigger className="w-[260px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_LABELS_FR.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      Tous les {d.toLowerCase()}s
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  🔵 Monthly
                </span>
                <span className="text-sm text-muted-foreground">{scheduleDesc.monthly}</span>
              </div>

              <Label className="text-sm font-medium">Type de récurrence</Label>
              <div className="flex gap-2 mt-1.5 mb-4">
                {([
                  { v: "weekday", label: "X-ième jour du mois (ex : 1er lundi)" },
                  { v: "date", label: "Date exacte (ex : le 15)" },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setSchedule({ ...schedule, monthly_mode: o.v })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      schedule.monthly_mode === o.v
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {schedule.monthly_mode === "weekday" ? (
                <div className="flex gap-2 items-end">
                  <div>
                    <Label className="text-xs">Occurrence</Label>
                    <Select
                      value={String(schedule.monthly_week)}
                      onValueChange={(v) =>
                        setSchedule({ ...schedule, monthly_week: Number(v) })
                      }
                    >
                      <SelectTrigger className="w-[140px] h-9 text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEK_LABELS_FR.map((w, i) => (
                          <SelectItem key={i} value={String(i + 1)}>
                            {w}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Jour</Label>
                    <Select
                      value={String(schedule.monthly_day)}
                      onValueChange={(v) =>
                        setSchedule({ ...schedule, monthly_day: Number(v) })
                      }
                    >
                      <SelectTrigger className="w-[160px] h-9 text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_LABELS_FR.map((d, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-sm text-muted-foreground pb-2">du mois</span>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Jour du mois (1 – 31, ou « Dernier »)</Label>
                  <Select
                    value={String(schedule.monthly_date)}
                    onValueChange={(v) =>
                      setSchedule({ ...schedule, monthly_date: Number(v) })
                    }
                  >
                    <SelectTrigger className="w-[180px] h-9 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          Le {d}
                        </SelectItem>
                      ))}
                      <SelectItem value="32">Dernier jour du mois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Sheet Create/Edit */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editing.id ? "Modifier le template" : "Ajouter un template"}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div>
              <Label className="text-sm font-medium">Titre *</Label>
              <Input
                value={editing.title}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, title: e.target.value.slice(0, 100) }))
                }
                maxLength={100}
                placeholder="Ex : Réunion d'équipe hebdomadaire"
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">
                {editing.title.length}/100
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                value={editing.description}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, description: e.target.value.slice(0, 300) }))
                }
                maxLength={300}
                rows={3}
                placeholder="Précisions sur cette responsabilité (optionnel)"
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">
                {editing.description.length}/300
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Catégorie</Label>
              <Select
                value={editing.category}
                onValueChange={(v) => setEditing((p) => ({ ...p, category: v as Category }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Fréquence</Label>
              <Select
                value={editing.frequency}
                onValueChange={(v) =>
                  setEditing((p) => ({ ...p, frequency: v, expected_count: p.expected_count }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Journalier</SelectItem>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  <SelectItem value="biweekly">Bimensuel</SelectItem>
                  <SelectItem value="monthly">Mensuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">
                {editing.frequency === "daily"
                  ? "Nombre par jour"
                  : editing.frequency === "weekly"
                    ? "Nombre par semaine"
                    : editing.frequency === "biweekly"
                      ? "Nombre par quinzaine"
                      : "Nombre par mois"}
              </Label>
              <Input
                type="number"
                min={1}
                value={editing.expected_count}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    expected_count: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="mt-1"
              />
              {(() => {
                const total = calcMonthlyExpected(editing.frequency, editing.expected_count);
                return (
                  <p className="text-xs text-muted-foreground italic mt-1">
                    = {total} attendu{total > 1 ? "s" : ""} par mois
                  </p>
                );
              })()}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Label className="text-sm font-medium">Actif</Label>
              <Switch
                checked={editing.is_active}
                onCheckedChange={(v) => setEditing((p) => ({ ...p, is_active: v }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Annuler
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={!editing.title.trim() || addMut.isPending || updateMut.isPending}
                onClick={handleSave}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Désactiver ce template ?</DialogTitle>
            <DialogDescription>
              « {deleteTarget?.title} » ne sera plus proposé dans les nouveaux rapports. Les
              historiques restent intacts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMut.isPending}>
              Désactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
