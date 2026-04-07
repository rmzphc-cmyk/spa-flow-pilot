import { AppHeader } from "@/components/AppHeader";

export default function Rapports() {
  return (
    <>
      <AppHeader title="Mes rapports" />
      <div className="bg-card rounded-card shadow-sm p-6">
        <p className="text-muted-foreground">Liste des rapports — à venir</p>
      </div>
    </>
  );
}
