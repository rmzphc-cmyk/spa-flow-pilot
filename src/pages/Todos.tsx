import { AppHeader } from "@/components/AppHeader";

export default function Todos() {
  return (
    <>
      <AppHeader title="To-do" />
      <div className="bg-card rounded-card shadow-sm p-6">
        <p className="text-muted-foreground">Liste des tâches — à venir</p>
      </div>
    </>
  );
}
