import { getReportSection, updateReportSection } from "./reportsStore";

export type IdsConversionMap = Record<string, { todo?: boolean; objectif?: boolean }>;

export function getConversions(reportId: string): IdsConversionMap {
  return ((getReportSection(reportId, "ids_conversions") as IdsConversionMap | null) ?? {});
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function convertIdsToTodo(reportId: string, issueText: string, issueKey: string) {
  const existing = (getReportSection(reportId, "todo") as unknown[] | null) ?? [];
  const newTodo = {
    id: makeId("t"),
    title: issueText,
    responsible: "—",
    deadline: "Prochaine réunion",
    priority: "normal",
    status: "pending",
    source: "ids",
  };
  updateReportSection(reportId, "todo", [...existing, newTodo]);
  const convs = getConversions(reportId);
  convs[issueKey] = { ...(convs[issueKey] ?? {}), todo: true };
  updateReportSection(reportId, "ids_conversions", convs);
}

export function convertIdsToObjectif(reportId: string, issueText: string, issueKey: string) {
  // Append a converted item under objectifs.converted (non-breaking)
  const obj = (getReportSection(reportId, "objectifs") as Record<string, unknown> | null) ?? {};
  const converted = Array.isArray((obj as { converted?: unknown[] }).converted)
    ? ((obj as { converted: unknown[] }).converted as unknown[])
    : [];
  const newObjectif = {
    id: makeId("o"),
    title: issueText,
    status: "En cours",
    source: "ids",
  };
  updateReportSection(reportId, "objectifs", { ...obj, converted: [...converted, newObjectif] });
  const convs = getConversions(reportId);
  convs[issueKey] = { ...(convs[issueKey] ?? {}), objectif: true };
  updateReportSection(reportId, "ids_conversions", convs);
}
