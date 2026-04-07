import { AppHeader } from "@/components/AppHeader";

const stats = [
  {
    label: "Rapport en cours",
    value: "Monthly — Mars 2026",
    subtitle: null,
    badge: "En préparation",
    badgeColor: "bg-muted text-muted-foreground",
    borderColor: "border-l-muted-foreground",
  },
  {
    label: "KPI en alerte",
    value: "2",
    subtitle: "sur 8 KPI",
    badge: null,
    badgeColor: "",
    borderColor: "border-l-destructive",
  },
  {
    label: "To-do en retard",
    value: "3",
    subtitle: "Dont 1 critique",
    badge: null,
    badgeColor: "",
    borderColor: "border-l-destructive",
  },
  {
    label: "Objectifs actifs",
    value: "2 / 3",
    subtitle: null,
    badge: null,
    badgeColor: "",
    borderColor: "border-l-primary",
  },
];

export default function Dashboard() {
  return (
    <>
      <AppHeader title="Dashboard" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-card rounded-card shadow-sm p-6 border-l-4 ${stat.borderColor}`}
          >
            <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
            {stat.subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{stat.subtitle}</p>
            )}
            {stat.badge && (
              <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${stat.badgeColor}`}>
                {stat.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="bg-card rounded-card shadow-sm p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Rapport en cours</h2>
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    </>
  );
}
