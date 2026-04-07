import { Outlet, useLocation, useParams } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useState, useMemo } from "react";
import type { SectionId, SectionStatus, ReportType } from "@/pages/RapportDetail";

const reportData: Record<string, { type: ReportType }> = {
  r1: { type: "monthly" },
  r2: { type: "weekly" },
  r3: { type: "monthly" },
  r4: { type: "weekly" },
  r5: { type: "monthly" },
  r6: { type: "weekly" },
};

const weeklySections: SectionId[] = ["kpi", "checkin", "ids"];
const monthlySections: SectionId[] = ["kpi", "checkin", "responsabilites", "todo", "objectifs", "ids", "cloture"];

export function AppLayout() {
  const location = useLocation();
  const reportMatch = location.pathname.match(/^\/rapport\/(\w+)/);
  const reportId = reportMatch?.[1] ?? "";
  const reportType: ReportType = reportData[reportId]?.type ?? "monthly";

  const [activeSection, setActiveSection] = useState<SectionId>("kpi");
  const [sectionStatuses, setSectionStatuses] = useState<Record<SectionId, SectionStatus>>({
    kpi: "incomplete",
    checkin: "incomplete",
    responsabilites: "incomplete",
    todo: "incomplete",
    objectifs: "incomplete",
    ids: "incomplete",
    cloture: "incomplete",
  });

  return (
    <div className="flex flex-col min-h-screen w-full">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          sectionStatuses={sectionStatuses}
          reportType={reportType}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[900px] mx-auto px-6 py-6">
            <Outlet context={{ activeSection, setActiveSection, sectionStatuses, setSectionStatuses, reportType }} />
          </div>
        </main>
      </div>
    </div>
  );
}
