import { AppHeader } from "@/components/AppHeader";

export default function Objectifs() {
  return (
    <>
      <AppHeader title="Objectifs" />
      <div className="bg-card rounded-card shadow-sm p-6">
        <p className="text-muted-foreground">Suivi des objectifs — à venir</p>
      </div>
    </>
  );
}
