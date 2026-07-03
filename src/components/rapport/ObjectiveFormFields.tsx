import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, X } from "lucide-react";
import type { ObjectiveKind } from "@/hooks/useObjectives";

/** Étape en cours de saisie — id stable (clé React), seul le label est envoyé. */
export interface ObjectiveStepDraft {
  id: string;
  label: string;
}

const makeStepDraft = (): ObjectiveStepDraft => ({ id: crypto.randomUUID(), label: "" });

/**
 * Valeurs brutes du formulaire objectif (saisies texte, converties à la
 * soumission via objectiveFormToPayload). Partagé entre la conversion IDS
 * (IdsToObjectiveDialog) et la création directe (ObjectiveCreateDialog).
 */
export interface ObjectiveFormValues {
  title: string;
  kind: ObjectiveKind;
  metric: string;
  unit: string;
  startValue: string;
  targetValue: string;
  steps: ObjectiveStepDraft[];
  targetDate: string;
}

/** Fabrique un état vierge (factory : évite le partage de la référence steps). */
export function makeEmptyObjectiveFormValues(): ObjectiveFormValues {
  return {
    title: "",
    kind: "numeric",
    metric: "",
    unit: "",
    startValue: "",
    targetValue: "",
    steps: [makeStepDraft()],
    targetDate: "",
  };
}

/** Parse un nombre saisi (tolère la virgule décimale FR) ; undefined si vide/invalide. */
export function parseFormNumber(raw: string): number | undefined {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isNaN(n) ? undefined : n;
}

/** Étapes non vides, trimées — base de la validation et du payload. */
export function cleanSteps(values: ObjectiveFormValues): string[] {
  return values.steps.map((s) => s.label.trim()).filter(Boolean);
}

/** Vrai si cible et départ sont tous deux saisis et égaux (progression impossible). */
function targetEqualsStart(values: ObjectiveFormValues): boolean {
  if (values.kind !== "numeric") return false;
  const target = parseFormNumber(values.targetValue);
  const start = parseFormNumber(values.startValue);
  return target !== undefined && start !== undefined && target === start;
}

/** Aujourd'hui en yyyy-mm-dd LOCAL (pas UTC) — pour le min de l'input date. */
function todayLocalIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Validation Phase 1 : titre + date cible requis ; chiffré → cible requise et
 * différente du départ ; projet → ≥ 1 étape.
 */
export function isObjectiveFormValid(values: ObjectiveFormValues): boolean {
  if (!values.title.trim()) return false;
  if (!values.targetDate) return false;
  if (values.kind === "numeric") {
    return parseFormNumber(values.targetValue) !== undefined && !targetEqualsStart(values);
  }
  return cleanSteps(values).length > 0;
}

/** Traduit les valeurs du formulaire vers les champs attendus par l'EF ids-convert. */
export function objectiveFormToPayload(values: ObjectiveFormValues): {
  title: string;
  kind: ObjectiveKind;
  metric?: string;
  unit?: string;
  startValue?: number;
  targetValue?: number;
  steps?: string[];
  targetDate: string | null;
} {
  const isNumeric = values.kind === "numeric";
  return {
    title: values.title.trim(),
    kind: values.kind,
    metric: isNumeric ? values.metric.trim() || undefined : undefined,
    unit: isNumeric ? values.unit.trim() || undefined : undefined,
    startValue: isNumeric ? parseFormNumber(values.startValue) : undefined,
    targetValue: isNumeric ? parseFormNumber(values.targetValue) : undefined,
    steps: isNumeric ? undefined : cleanSteps(values),
    targetDate: values.targetDate || null,
  };
}

interface Props {
  values: ObjectiveFormValues;
  onChange: (values: ObjectiveFormValues) => void;
}

/**
 * Champs communs de création d'objectif : titre, sélecteur de nature (chiffré /
 * projet), champs indicateur OU constructeur d'étapes, et date cible.
 */
export function ObjectiveFormFields({ values, onChange }: Props) {
  const { t } = useTranslation();
  const patch = (p: Partial<ObjectiveFormValues>) => onChange({ ...values, ...p });

  const setStep = (id: string, label: string) =>
    patch({ steps: values.steps.map((s) => (s.id === id ? { ...s, label } : s)) });
  const addStep = () => patch({ steps: [...values.steps, makeStepDraft()] });
  const removeStep = (id: string) =>
    patch({ steps: values.steps.filter((s) => s.id !== id) });

  const showTargetEqualsStartError = targetEqualsStart(values);

  const kindOptions: { kind: ObjectiveKind; label: string; desc: string }[] = [
    {
      kind: "numeric",
      label: t("objectifs.form.typeNumeric"),
      desc: t("objectifs.form.typeNumericDesc"),
    },
    {
      kind: "steps",
      label: t("objectifs.form.typeSteps"),
      desc: t("objectifs.form.typeStepsDesc"),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Titre — éditable, pré-rempli avec la capture IDS en conversion */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t("report.ids.labelTitle")}</label>
        <Input
          value={values.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder={t("objectifs.create.titlePlaceholder")}
        />
      </div>

      {/* Sélecteur de nature — exclusif à la création */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t("objectifs.form.typeLabel")}</label>
        <RadioGroup
          value={values.kind}
          onValueChange={(kind) => patch({ kind: kind as ObjectiveKind })}
          className="grid grid-cols-2 gap-2"
        >
          {kindOptions.map((opt) => (
            <label
              key={opt.kind}
              className={`flex items-start gap-2 rounded-xl border p-3 cursor-pointer transition-colors ${
                values.kind === opt.kind
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value={opt.kind} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {values.kind === "numeric" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("objectifs.form.metricLabel")}</label>
              <Input
                value={values.metric}
                onChange={(e) => patch({ metric: e.target.value })}
                placeholder={t("objectifs.form.metricPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("objectifs.form.unitLabel")}</label>
              <Input
                value={values.unit}
                onChange={(e) => patch({ unit: e.target.value })}
                placeholder={t("objectifs.form.unitPlaceholder")}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("objectifs.form.startLabel")}</label>
              <Input
                type="number"
                step="any"
                value={values.startValue}
                onChange={(e) => patch({ startValue: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("objectifs.form.targetLabel")}</label>
              <Input
                type="number"
                step="any"
                value={values.targetValue}
                onChange={(e) => patch({ targetValue: e.target.value })}
              />
            </div>
          </div>
          {showTargetEqualsStartError && (
            <p className="text-xs font-medium text-destructive">
              {t("objectifs.form.targetEqualsStartError")}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("objectifs.form.stepsLabel")}</label>
          {values.steps.map((step) => (
            <div key={step.id} className="flex gap-2">
              <Input
                value={step.label}
                onChange={(e) => setStep(step.id, e.target.value)}
                placeholder={t("objectifs.form.stepPlaceholder")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => removeStep(step.id)}
                aria-label={t("objectifs.form.removeStep")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {cleanSteps(values).length === 0 && (
            <p className="text-xs text-muted-foreground">{t("objectifs.form.stepsEmpty")}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStep}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("objectifs.form.addStep")}
          </Button>
        </div>
      )}

      {/* Date cible (clé i18n existante réutilisée) */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t("report.ids.labelTargetDate")}</label>
        <Input
          type="date"
          min={todayLocalIso()}
          value={values.targetDate}
          onChange={(e) => patch({ targetDate: e.target.value })}
        />
      </div>
    </div>
  );
}
