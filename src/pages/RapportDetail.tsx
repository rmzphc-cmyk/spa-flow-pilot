import { useParams } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";

const reportNames: Record<string, string> = {
  r1: "Monthly — Mars 2026",
  r2: "Weekly — Semaine 12",
  r3: "Monthly — Février 2026",
  r4: "Weekly — Semaine 11",
  r5: "Monthly — Janvier 2026",
};

export default function RapportDetail() {
  const { id } = useParams<{ id: string }>();
  const title = reportNames[id ?? ""] ?? `Rapport ${id}`;

  return (
    <>
      <AppHeader title={`Rapport — ${title}`} />
      <div className="bg-card rounded-card shadow-sm p-6">
        <p className="text-muted-foreground">Détails du rapport — à venir</p>
      </div>
    </>
  );
}
