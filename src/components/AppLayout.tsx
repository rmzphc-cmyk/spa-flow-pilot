import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useState } from "react";
import type { SectionId, SectionStatus, ReportType } from "@/pages/RapportDetail";
import { useReport } from "@/hooks/useReports";

export function AppLayout() {
  const location = useLocation();
  const reportMatch = location.pathname.match(/^\/rapport\/([\w-]+)/);
  const reportId = reportMatch?.[1] ?? "";
  const { data: reportRow } = useReport(reportId || undefined);
  const reportType: ReportType = (reportRow?.cycle_type as ReportType) ?? "monthly";
  const fullscreenMeeting =
    reportType === "monthly" &&
    (reportRow?.status === "in_meeting" ||
      reportRow?.status === "post_meeting_generated" ||
      reportRow?.status === "validated");

  const [activeSection, setActiveSection] = useState<SectionId>("kpi");
  const [sectionStatuses, setSectionStatuses] = useState<Record<SectionId, SectionStatus>>({
    kpi: "incomplete",
    checkin: "incomplete",
    responsabilites: "incomplete",
    todo: "incomplete",
    objectifs: "incomplete",
    ids: "incomplete",
    notes: "complete",
    cloture: "incomplete",
  });

  // MEETING MODE — full focus, no sidebar/header
  if (fullscreenMeeting) {
    return <Outlet context={{ activeSection, setActiveSection, sectionStatuses, setSectionStatuses, reportType }} />;
  }

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
