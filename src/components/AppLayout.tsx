import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useState } from "react";
import type { SectionId, SectionStatus } from "@/pages/RapportDetail";

export function AppLayout() {
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
        />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[900px] mx-auto px-6 py-6">
            <Outlet context={{ activeSection, setActiveSection, sectionStatuses, setSectionStatuses }} />
          </div>
        </main>
      </div>
    </div>
  );
}
