import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
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
import RespExcelMenu from "@/components/resp/RespExcelMenu";

const CATEGORIES = [
  "RH",
  "Commercial",
  "Opérationnel",
  "Qualité",
  "Formation",
  "Administratif",
] as const;
type Category = (typeof CATEGORIES)[number];

const DAY_KEYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
const WEEK_KEYS = ["1er", "2eme", "3eme", "4eme", "last"] as const;

function FreqBadges({ frequency, expectedCount }: { frequency: string | null; expectedCount: number | null }) {
  const { t } = useTranslation();
  const freq = frequency ?? "monthly";
  const count = expectedCount ?? 1;
  const total = calcMonthlyExpected(freq, count);

  const meta: Record<string, { label: string; cls: string; unit: string }> = {
    daily: {
      label: t("respConfig.frequency.daily"),
      cls: "bg-purple-100 text-purple-700",
      unit: t("respConfig.unit.day"),
    },
    weekly: {
      label: t("respConfig.frequency.weekly"),
      cls: "bg-blue-100 text-blue-700",
      unit: t("respConfig.unit.week"),
    },
    biweekly: {
      label: t("respConfig.frequency.biweekly"),
      cls: "bg-cyan-100 text-cyan-700",
      unit: t("respConfig.unit.fortnight"),
    },
    monthly: {
      label: t("respConfig.frequency.monthly"),
      cls: "bg-slate-100 text-slate-600",
      unit: t("respConfig.unit.month"),
    },
  };
  const f = meta[freq] ?? meta.monthly;

  return (
    <div className="flex gap-1 flex-wrap mt-1">
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${f.cls}`}>
        {f.label}
      </span>
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
        × {count}/{f.unit}
      </span>
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">
        {t("respConfig.expectedTotal", { total })}
      </span>
    </div>
  );
}


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
  const { t } = useTranslation();
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

  const spaName = useMemo(
    () => (spas ?? []).find((s: any) => s.id === spaId)?.name ?? "spa",
    [spas, spaId],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EditingTemplate>(EMPTY_EDIT);
  const [deleteTarget, setDeleteTarget] = useState<RespTemplateFullRow | null>(null);

  const openCreate = () => {
    setEditing(EMPTY_EDIT);
    setSheetOpen(true);
  };

  const openEdit = (tmpl: RespTemplateFullRow) => {
    setEditing({
      id: tmpl.id,
      title: tmpl.title,
      description: tmpl.description ?? "",
      category: (CATEGORIES.includes(tmpl.category as Category) ? tmpl.category : "Opérationnel") as Category,
      is_active: tmpl.is_active,
      frequency: tmpl.frequency ?? "monthly",
      expected_count: tmpl.expected_count ?? 1,
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
            toast.success(t("respConfig.editSuccess"));
            setSheetOpen(false);
          },
          onError: (e: any) => toast.error(e?.message ?? t("common.error")),
        },
      );
    } else {
      addMut.mutate(
        { spaId, ...payload, display_order: sortedTemplates.length },
        {
          onSuccess: () => {
            toast.success(t("respConfig.addSuccess"));
            setSheetOpen(false);
          },
          onError: (e: any) => toast.error(e?.message ?? t("common.error")),
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
          toast.success(t("respConfig.deactivateSuccess"));
          setDeleteTarget(null);
        },
        onError: (e: any) => toast.error(e?.message ?? t("common.error")),
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
    const timer = setTimeout(async () => {
      setIsSavingSchedule(true);
      try {
        await saveScheduleToDb(schedule, spaId);
        await queryClient.invalidateQueries({ queryKey: ["spa-schedule", spaId] });
        showToast({ title: t("respConfig.scheduleSaved"), description: t("respConfig.scheduleSavedDesc") });
      } catch (e: any) {
        showToast({ title: t("common.error"), description: e?.message ?? t("respConfig.scheduleSaveError"), variant: "destructive" });
      } finally {
        setIsSavingSchedule(false);
      }
    }, 600);
    return () => clearTimeout(timer);
     
  }, [schedule.weekly_day, schedule.monthly_mode, schedule.monthly_week, schedule.monthly_day, schedule.monthly_date, spaId]);

  // Build schedule descriptions locally with translations
  const weeklyDesc = t(`respConfig.weeklyDayOption.${DAY_KEYS[schedule.weekly_day]}`);

  let monthlyDesc: string;
  if (schedule.monthly_mode === "date") {
    if (schedule.monthly_date >= 32) {
      monthlyDesc = t("respConfig.lastDayOfMonth");
    } else {
      const formattedDate = schedule.monthly_date === 1
        ? t("respConfig.occurrence.1er")
        : String(schedule.monthly_date);
      monthlyDesc = t("respConfig.schedule.monthlyDate", { date: formattedDate });
    }
  } else {
    monthlyDesc = t("respConfig.schedule.monthlyWeekday", {
      occurrence: t(`respConfig.occurrence.${WEEK_KEYS[schedule.monthly_week - 1]}`),
      day: t(`days.${DAY_KEYS[schedule.monthly_day]}`).toLowerCase(),
    });
  }

  void isSavingSchedule;

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 pb-20">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("respConfig.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("respConfig.subtitle")}
          </p>
        </div>
        {userRole === "admin" && (
          <Select value={adminSpaId ?? ""} onValueChange={(v) => setAdminSpaId(v || null)}>
            <SelectTrigger className="w-56 h-9">
              <SelectValue placeholder={t("respConfig.selectSpa")} />
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
          { v: "templates" as const, label: t("respConfig.tabs.templates") },
          { v: "calendrier" as const, label: t("respConfig.tabs.calendar") },
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
              {t("respConfig.selectSpaPrompt")}
            </div>
          ) : (
            <>
              <div className="flex justify-end items-center gap-2 mb-3">
                <RespExcelMenu
                  spaId={spaId}
                  spaName={spaName}
                  templates={templates}
                  canImport={userRole === "admin" || userRole === "manager"}
                />
                <Button
                  size="sm"
                  className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={openCreate}
                >
                  <Plus className="h-4 w-4" /> {t("respConfig.addTemplate")}
                </Button>
              </div>

              <div className="border border-border rounded-xl overflow-hidden shadow-sm bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left py-2.5 px-4 font-semibold">{t("respConfig.table.title")}</th>
                      <th className="text-left py-2.5 px-4 font-semibold w-40">{t("respConfig.table.category")}</th>
                      <th className="text-left py-2.5 px-4 font-semibold w-20">{t("respConfig.table.active")}</th>
                      <th className="text-left py-2.5 px-4 font-semibold w-36">{t("respConfig.table.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          {t("common.loading")}
                        </td>
                      </tr>
                    )}
                    {!isLoading && sortedTemplates.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          {t("respConfig.emptyTemplates")}
                        </td>
                      </tr>
                    )}
                    {sortedTemplates.map((tmpl, idx) => (
                      <tr key={tmpl.id} className="border-t border-border">
                        <td className="py-2 px-4">
                          <div className="font-medium">{tmpl.title}</div>
                          <FreqBadges frequency={tmpl.frequency} expectedCount={tmpl.expected_count} />
                          {tmpl.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {tmpl.description}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-4 text-muted-foreground">
                          {tmpl.category ? t(`respConfig.category.${tmpl.category}`) : "—"}
                        </td>
                        <td className="py-2 px-4">
                          <Switch
                            checked={tmpl.is_active}
                            onCheckedChange={(v) => {
                              updateMut.mutate(
                                { id: tmpl.id, spaId, is_active: v },
                                {
                                  onSuccess: () => toast.success(t("respConfig.saveSuccess")),
                                  onError: (e: any) => toast.error(e?.message ?? t("common.error")),
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
                              onClick={() => openEdit(tmpl)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteTarget(tmpl)}
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
              <p>{t("respConfig.calendarTitle")}</p>
            </div>

            <div className="border-t border-border pt-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {t("respConfig.weeklyLabel")}
                </span>
                <span className="text-sm text-muted-foreground">{weeklyDesc}</span>
              </div>
              <Label className="text-sm font-medium">{t("respConfig.recurrentDayLabel")}</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">{t("respConfig.recurrentDayHint")}</p>
              <Select
                value={String(schedule.weekly_day)}
                onValueChange={(v) => setSchedule({ ...schedule, weekly_day: Number(v) })}
              >
                <SelectTrigger className="w-[260px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_KEYS.map((key, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {t(`respConfig.weeklyDayOption.${key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {t("respConfig.monthlyLabel")}
                </span>
                <span className="text-sm text-muted-foreground">{monthlyDesc}</span>
              </div>

              <Label className="text-sm font-medium">{t("respConfig.recurrenceTypeLabel")}</Label>
              <div className="flex gap-2 mt-1.5 mb-4">
                {([
                  { v: "weekday", label: t("respConfig.recurrenceTypeWeekday") },
                  { v: "date", label: t("respConfig.recurrenceTypeDate") },
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
                    <Label className="text-xs">{t("respConfig.occurrenceLabel")}</Label>
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
                        {WEEK_KEYS.map((key, i) => (
                          <SelectItem key={i} value={String(i + 1)}>
                            {t(`respConfig.occurrence.${key}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t("respConfig.dayLabel")}</Label>
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
                        {DAY_KEYS.map((key, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {t(`days.${key}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-sm text-muted-foreground pb-2">{t("respConfig.ofTheMonth")}</span>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">{t("respConfig.monthDateLabel")}</Label>
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
                          {t("respConfig.theDay", { day: d })}
                        </SelectItem>
                      ))}
                      <SelectItem value="32">{t("respConfig.lastDayOfMonth")}</SelectItem>
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
              {editing.id ? t("respConfig.sheet.editTitle") : t("respConfig.sheet.addTitle")}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div>
              <Label className="text-sm font-medium">{t("respConfig.sheet.titleLabel")}</Label>
              <Input
                value={editing.title}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, title: e.target.value.slice(0, 100) }))
                }
                maxLength={100}
                placeholder={t("respConfig.sheet.titlePlaceholder")}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">
                {editing.title.length}/100
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">{t("respConfig.sheet.descriptionLabel")}</Label>
              <Textarea
                value={editing.description}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, description: e.target.value.slice(0, 300) }))
                }
                maxLength={300}
                rows={3}
                placeholder={t("respConfig.sheet.descriptionPlaceholder")}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">
                {editing.description.length}/300
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">{t("respConfig.sheet.categoryLabel")}</Label>
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
                      {t(`respConfig.category.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">{t("respConfig.sheet.frequencyLabel")}</Label>
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
                  <SelectItem value="daily">{t("respConfig.frequency.daily")}</SelectItem>
                  <SelectItem value="weekly">{t("respConfig.frequency.weekly")}</SelectItem>
                  <SelectItem value="biweekly">{t("respConfig.frequency.biweekly")}</SelectItem>
                  <SelectItem value="monthly">{t("respConfig.frequency.monthly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">
                {editing.frequency === "daily"
                  ? t("respConfig.countLabel.daily")
                  : editing.frequency === "weekly"
                    ? t("respConfig.countLabel.weekly")
                    : editing.frequency === "biweekly"
                      ? t("respConfig.countLabel.biweekly")
                      : t("respConfig.countLabel.monthly")}
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
                    {t("respConfig.expectedTotal", { total })}
                  </p>
                );
              })()}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Label className="text-sm font-medium">{t("respConfig.sheet.activeLabel")}</Label>
              <Switch
                checked={editing.is_active}
                onCheckedChange={(v) => setEditing((p) => ({ ...p, is_active: v }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={!editing.title.trim() || addMut.isPending || updateMut.isPending}
                onClick={handleSave}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("respConfig.deactivateTitle")}</DialogTitle>
            <DialogDescription>
              {t("respConfig.deactivateDesc", { title: deleteTarget?.title ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMut.isPending}>
              {t("respConfig.deactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
