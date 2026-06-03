import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, UserPlus, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  useOrganizations,
  useDestinations,
  useCreateDestination,
  useUpdateDestination,
  useDeleteDestination,
  useAdminSpas,
  useCreateSpa,
  useUpdateSpa,
  useDeleteSpa,
  useAdminUsers,
  useInviteUser,
  useUpdateUser,
  useDeleteUser,
  type Destination,
  type AdminSpa,
  type AdminUser,
} from "@/hooks/useAdminOrganization";

export default function AdminOrganization() {
  const { userRole } = useAuth();
  const readOnly = userRole === "direction";

  const { data: orgs = [] } = useOrganizations();
  const [orgId, setOrgId] = useState<string | undefined>();
  const currentOrgId = orgId ?? orgs[0]?.id;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Organisation</h1>
          <p className="text-sm text-muted-foreground">
            {readOnly
              ? "Lecture seule — gestion réservée aux administrateurs."
              : "Gestion des destinations, spas et directions."}
          </p>
        </div>
        {orgs.length > 1 && (
          <Select value={currentOrgId} onValueChange={setOrgId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Organisation" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!currentOrgId ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Aucune organisation accessible.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="destinations" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="destinations">Destinations</TabsTrigger>
            <TabsTrigger value="spas">Spas</TabsTrigger>
            <TabsTrigger value="directors">Directions</TabsTrigger>
          </TabsList>

          <TabsContent value="destinations" className="mt-6">
            <DestinationsTab organizationId={currentOrgId} readOnly={readOnly} />
          </TabsContent>

          <TabsContent value="spas" className="mt-6">
            <SpasTab organizationId={currentOrgId} readOnly={readOnly} />
          </TabsContent>

          <TabsContent value="directors" className="mt-6">
            <DirectorsTab organizationId={currentOrgId} readOnly={readOnly} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// =================== Destinations ===================
function DestinationsTab({ organizationId, readOnly }: { organizationId: string; readOnly: boolean }) {
  const { data: destinations = [], isLoading } = useDestinations(organizationId);
  const { data: spas = [] } = useAdminSpas(organizationId);
  const createMut = useCreateDestination();
  const updateMut = useUpdateDestination();
  const deleteMut = useDeleteDestination();

  const [editing, setEditing] = useState<Destination | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Destination | null>(null);

  const spaCountByDest = useMemo(() => {
    const m = new Map<string, number>();
    spas.forEach((s) => m.set(s.destination_id, (m.get(s.destination_id) ?? 0) + 1));
    return m;
  }, [spas]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{destinations.length} destination(s)</CardTitle>
        {!readOnly && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nouvelle destination
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : destinations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune destination.</p>
        ) : (
          <div className="divide-y divide-border">
            {destinations.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.country ?? "—"} · {d.timezone} · {spaCountByDest.get(d.id) ?? 0} spa(s)
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(d)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(d)}
                      disabled={(spaCountByDest.get(d.id) ?? 0) > 0}
                      title={(spaCountByDest.get(d.id) ?? 0) > 0 ? "Détacher les spas d'abord" : "Supprimer"}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DestinationEditDialog
        open={creating || !!editing}
        destination={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSubmit={async (values) => {
          if (editing) {
            await updateMut.mutateAsync({ id: editing.id, ...values });
            toast.success("Destination mise à jour");
          } else {
            await createMut.mutateAsync({ organization_id: organizationId, ...values });
            toast.success("Destination créée");
          }
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette destination ?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" sera supprimée. Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteMut.mutateAsync(deleteTarget.id);
                  toast.success("Destination supprimée");
                  setDeleteTarget(null);
                } catch (e: any) {
                  toast.error(e.message ?? "Erreur");
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function DestinationEditDialog({
  open,
  destination,
  onClose,
  onSubmit,
}: {
  open: boolean;
  destination: Destination | null;
  onClose: () => void;
  onSubmit: (values: { name: string; country?: string; timezone?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("Atlantic/Canary");

  useMemo(() => {
    if (open) {
      setName(destination?.name ?? "");
      setCountry(destination?.country ?? "");
      setTimezone(destination?.timezone ?? "Atlantic/Canary");
    }
  }, [open, destination]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{destination ? "Modifier la destination" : "Nouvelle destination"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Tenerife" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Pays</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="ES" />
            </div>
            <div>
              <Label>Fuseau</Label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            onClick={async () => {
              if (!name.trim()) {
                toast.error("Nom requis");
                return;
              }
              try {
                await onSubmit({ name: name.trim(), country: country.trim() || undefined, timezone });
                onClose();
              } catch (e: any) {
                toast.error(e.message ?? "Erreur");
              }
            }}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== Spas ===================
function SpasTab({ organizationId, readOnly }: { organizationId: string; readOnly: boolean }) {
  const { data: spas = [], isLoading } = useAdminSpas(organizationId);
  const { data: destinations = [] } = useDestinations(organizationId);
  const createMut = useCreateSpa();
  const updateMut = useUpdateSpa();
  const deleteMut = useDeleteSpa();

  const destById = useMemo(() => new Map(destinations.map((d) => [d.id, d])), [destinations]);

  const [editing, setEditing] = useState<AdminSpa | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminSpa | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{spas.length} spa(s)</CardTitle>
        {!readOnly && (
          <Button size="sm" onClick={() => setCreating(true)} disabled={destinations.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Nouveau spa
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : spas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun spa.</p>
        ) : (
          <div className="divide-y divide-border">
            {spas.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${s.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                  />
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {destById.get(s.destination_id)?.name ?? "—"}
                    </p>
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <SpaEditDialog
        open={creating || !!editing}
        spa={editing}
        destinations={destinations}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSubmit={async (values) => {
          if (editing) {
            await updateMut.mutateAsync({ id: editing.id, ...values });
            toast.success("Spa mis à jour");
          } else {
            await createMut.mutateAsync({ organization_id: organizationId, ...values });
            toast.success("Spa créé");
          }
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce spa ?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" et toutes ses données (rapports, KPI…) seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteMut.mutateAsync(deleteTarget.id);
                  toast.success("Spa supprimé");
                  setDeleteTarget(null);
                } catch (e: any) {
                  toast.error(e.message ?? "Erreur");
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function SpaEditDialog({
  open,
  spa,
  destinations,
  onClose,
  onSubmit,
}: {
  open: boolean;
  spa: AdminSpa | null;
  destinations: Destination[];
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    destination_id: string;
    is_active?: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [isActive, setIsActive] = useState(true);

  useMemo(() => {
    if (open) {
      setName(spa?.name ?? "");
      setDestinationId(spa?.destination_id ?? destinations[0]?.id ?? "");
      setIsActive(spa?.is_active ?? true);
    }
  }, [open, spa, destinations]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{spa ? "Modifier le spa" : "Nouveau spa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sanagua Par Tenerife" />
          </div>
          <div>
            <Label>Destination</Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {destinations.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {spa && (
            <div className="flex items-center justify-between">
              <Label>Spa actif</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            onClick={async () => {
              if (!name.trim() || !destinationId) {
                toast.error("Nom et destination requis");
                return;
              }
              try {
                await onSubmit({
                  name: name.trim(),
                  destination_id: destinationId,
                  reporting_cycle_type: cycle,
                  is_active: spa ? isActive : undefined,
                });
                onClose();
              } catch (e: any) {
                toast.error(e.message ?? "Erreur");
              }
            }}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== Directors ===================
function DirectorsTab({ organizationId, readOnly }: { organizationId: string; readOnly: boolean }) {
  const { data: users = [], isLoading } = useAdminUsers(organizationId);
  const { data: destinations = [] } = useDestinations(organizationId);
  const inviteMut = useInviteUser();
  const updateMut = useUpdateUser();
  const deleteMut = useDeleteUser();

  const destById = useMemo(() => new Map(destinations.map((d) => [d.id, d])), [destinations]);
  const directors = users.filter((u) => u.role === "direction");

  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [tempCredentials, setTempCredentials] = useState<{ email: string; password: string } | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{directors.length} direction(s)</CardTitle>
        {!readOnly && (
          <Button size="sm" onClick={() => setInviting(true)} disabled={destinations.length === 0}>
            <UserPlus className="h-4 w-4 mr-2" /> Inviter un directeur
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : directors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun directeur.</p>
        ) : (
          <div className="divide-y divide-border">
            {directors.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} · {destById.get(u.destination_id ?? "")?.name ?? "Toute l'organisation"}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DirectorEditDialog
        open={inviting || !!editing}
        director={editing}
        destinations={destinations}
        onClose={() => {
          setInviting(false);
          setEditing(null);
        }}
        onSubmit={async (values) => {
          if (editing) {
            await updateMut.mutateAsync({
              user_id: editing.id,
              full_name: values.full_name,
              destination_id: values.destination_id,
            });
            toast.success("Directeur mis à jour");
          } else {
            const res = await inviteMut.mutateAsync({
              email: values.email!,
              full_name: values.full_name,
              role: "direction",
              destination_id: values.destination_id,
              organization_id: organizationId,
            });
            toast.success("Directeur invité");
            if (res?.temp_password) {
              setTempCredentials({ email: values.email!, password: res.temp_password });
            }
          }
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce directeur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.full_name || deleteTarget?.email} perdra l'accès à l'application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteMut.mutateAsync(deleteTarget.id);
                  toast.success("Directeur supprimé");
                  setDeleteTarget(null);
                } catch (e: any) {
                  toast.error(e.message ?? "Erreur");
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TempCredentialsDialog
        credentials={tempCredentials}
        onClose={() => setTempCredentials(null)}
      />
    </Card>
  );
}

function DirectorEditDialog({
  open,
  director,
  destinations,
  onClose,
  onSubmit,
}: {
  open: boolean;
  director: AdminUser | null;
  destinations: Destination[];
  onClose: () => void;
  onSubmit: (values: { email?: string; full_name: string; destination_id: string | null }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [destinationId, setDestinationId] = useState<string>("");

  useMemo(() => {
    if (open) {
      setEmail(director?.email ?? "");
      setFullName(director?.full_name ?? "");
      setDestinationId(director?.destination_id ?? destinations[0]?.id ?? "");
    }
  }, [open, director, destinations]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{director ? "Modifier le directeur" : "Inviter un directeur"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              disabled={!!director}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="direction@exemple.com"
            />
          </div>
          <div>
            <Label>Nom complet</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ana Sanagua" />
          </div>
          <div>
            <Label>Destination</Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {destinations.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            onClick={async () => {
              if (!director && !email.trim()) {
                toast.error("Email requis");
                return;
              }
              if (!destinationId) {
                toast.error("Destination requise");
                return;
              }
              try {
                await onSubmit({
                  email: director ? undefined : email.trim(),
                  full_name: fullName.trim(),
                  destination_id: destinationId,
                });
                onClose();
              } catch (e: any) {
                toast.error(e.message ?? "Erreur");
              }
            }}
          >
            {director ? "Enregistrer" : "Inviter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TempCredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: { email: string; password: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={!!credentials} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Identifiants temporaires</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Transmets ces identifiants au directeur. Le mot de passe ne sera plus affiché ensuite.
        </p>
        <div className="space-y-2 mt-2">
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p><strong>Email :</strong> {credentials?.email}</p>
            <p><strong>Mot de passe :</strong> <code>{credentials?.password}</code></p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              navigator.clipboard.writeText(`Email: ${credentials?.email}\nMot de passe: ${credentials?.password}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copié" : "Copier"}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
