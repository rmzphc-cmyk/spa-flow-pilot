import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  title: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8">
      <h1 className="text-2xl font-bold text-foreground pl-10 lg:pl-0">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
          🔵 Monthly
        </span>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouveau rapport
        </Button>
      </div>
    </header>
  );
}
