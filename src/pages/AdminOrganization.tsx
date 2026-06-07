import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const readOnly = userRole === "direction";

  const { data: orgs = [] } = useOrganizations();
  const [orgId, setOrgId] = useState<string | undefined>();
  const currentOrgId = orgId ?? orgs[0]?.id;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {readOnly ? t("admin.subtitleReadOnly") : t("admin.subtitle")}
          </p>
        </div>
        {orgs.length > 1 && (
          <Select value={currentOrgId} onValueChange={setOrgId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder={t("admin.orgPlaceholder")} />
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
            {t("admin.noOrgs")}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="destinations" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="destinations">{t("admin.tabs.destinations")}</TabsTrigger>
            <TabsTrigger value="spas">{t("admin.tabs.spas")}</TabsTrigger>
            <TabsTrigger value="managers">{t("admin.tabs.managers")}</TabsTrigger>
            <TabsTrigger value="directors">{t("admin.tabs.directors")}</TabsTrigger>
          </TabsList>

          <TabsContent value="destinations" className="mt-6">
            <DestinationsTab organizationId={currentOrgId} readOnly={readOnly} />
          </TabsContent>

          <TabsContent value="spas" className="mt-6">
            <SpasTab organizationId={currentOrgId} readOnly={readOnly} />
          </TabsContent>

          <TabsContent value="managers" className="mt-6">
            <ManagersTab organizationId={currentOrgId} readOnly={readOnly} />
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
  const { t } = useTranslation();
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
        <CardTitle className="text-base">{t("admin.destinations.count", { count: destinations.length })}</CardTitle>
        {!readOnly && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t("admin.destinations.new")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : destinations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.destinations.empty")}</p>
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
                      title={(spaCountByDest.get(d.id) ?? 0) > 0 ? t("admin.destinations.detachFirst") : t("common.delete")}
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
            toast.success(t("admin.destinations.updatedToast"));
          } else {
            await createMut.mutateAsync({ organization_id: organizationId, ...values });
            toast.success(t("admin.destinations.createdToast"));
          }
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.destinations.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.destinations.deleteDesc", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteMut.mutateAsync(deleteTarget.id);
                  toast.success(t("admin.destinations.deletedToast"));
                  setDeleteTarget(null);
                } catch (e: any) {
                  toast.error(e.message ?? t("common.error"));
                }
              }}
            >
              {t("common.delete")}
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
  const { t } = useTranslation();
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
          <DialogTitle>{destination ? t("admin.destinations.editTitle") : t("admin.destinations.newTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("admin.destinations.fields.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("admin.destinations.fields.namePlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("admin.destinations.fields.country")}</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t("admin.destinations.fields.countryPlaceholder")} />
            </div>
            <div>
              <Label>{t("admin.destinations.fields.timezone")}</Label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            onClick={async () => {
              if (!name.trim()) {
                toast.error(t("admin.destinations.nameRequired"));
                return;
              }
              try {
                await onSubmit({ name: name.trim(), country: country.trim() || undefined, timezone });
                onClose();
              } catch (e: any) {
                toast.error(e.message ?? t("common.error"));
              }
            }}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== Spas ===================
function SpasTab({ organizationId, readOnly }: { organizationId: string; readOnly: boolean }) {
  const { t } = useTranslation();
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
        <CardTitle className="text-base">{t("admin.spas.count", { count: spas.length })}</CardTitle>
        {!readOnly && (
          <Button size="sm" onClick={() => setCreating(true)} disabled={destinations.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> {t("admin.spas.new")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : spas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.spas.empty")}</p>
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
            toast.success(t("admin.spas.updatedToast"));
          } else {
            await createMut.mutateAsync({ organization_id: organizationId, ...values });
            toast.success(t("admin.spas.createdToast"));
          }
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.spas.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.spas.deleteDesc", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteMut.mutateAsync(deleteTarget.id);
                  toast.success(t("admin.spas.deletedToast"));
                  setDeleteTarget(null);
                } catch (e: any) {
                  toast.error(e.message ?? t("common.error"));
                }
              }}
            >
              {t("common.delete")}
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
  const { t } = useTranslation();
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
          <DialogTitle>{spa ? t("admin.spas.editTitle") : t("admin.spas.newTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("admin.spas.fields.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("admin.spas.fields.namePlaceholder")} />
          </div>
          <div>
            <Label>{t("admin.spas.fields.destination")}</Label>
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
              <Label>{t("admin.spas.fields.active")}</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            onClick={async () => {
              if (!name.trim() || !destinationId) {
                toast.error(t("admin.spas.nameDestRequired"));
                return;
              }
              try {
                await onSubmit({
                  name: name.trim(),
                  destination_id: destinationId,
                  is_active: spa ? isActive : undefined,
                });
                onClose();
              } catch (e: any) {
                toast.error(e.message ?? t("common.error"));
              }
            }}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== Directors ===================
function DirectorsTab({ organizationId, readOnly }: { organizationId: string; readOnly: boolean }) {
  const { t } = useTranslation();
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
        <CardTitle className="text-base">{t("admin.directors.count", { count: directors.length })}</CardTitle>
        {!readOnly && (
          <Button size="sm" onClick={() => setInviting(true)} disabled={destinations.length === 0}>
            <UserPlus className="h-4 w-4 mr-2" /> {t("admin.directors.invite")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : directors.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.directors.empty")}</p>
        ) : (
          <div className="divide-y divide-border">
            {directors.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} · {destById.get(u.destination_id ?? "")?.name ?? t("admin.directors.wholeOrg")}
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
            toast.success(t("admin.directors.updatedToast"));
          } else {
            const res = await inviteMut.mutateAsync({
              email: values.email!,
              full_name: values.full_name,
              role: "direction",
              destination_id: values.destination_id,
              organization_id: organizationId,
            });
            toast.success(t("admin.directors.invitedToast"));
            if (res?.temp_password) {
              setTempCredentials({ email: values.email!, password: res.temp_password });
            }
          }
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.directors.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.directors.deleteDesc", { name: deleteTarget?.full_name || deleteTarget?.email || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteMut.mutateAsync(deleteTarget.id);
                  toast.success(t("admin.directors.deletedToast"));
                  setDeleteTarget(null);
                } catch (e: any) {
                  toast.error(e.message ?? t("common.error"));
                }
              }}
            >
              {t("common.delete")}
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
  const { t } = useTranslation();
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
          <DialogTitle>{director ? t("admin.directors.editTitle") : t("admin.directors.inviteTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("admin.directors.fields.email")}</Label>
            <Input
              type="email"
              value={email}
              disabled={!!director}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("admin.directors.fields.emailPlaceholder")}
            />
          </div>
          <div>
            <Label>{t("admin.directors.fields.fullName")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("admin.directors.fields.fullNamePlaceholder")} />
          </div>
          <div>
            <Label>{t("admin.directors.fields.destination")}</Label>
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
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            onClick={async () => {
              if (!director && !email.trim()) {
                toast.error(t("admin.emailRequired"));
                return;
              }
              if (!destinationId) {
                toast.error(t("admin.destRequired"));
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
                toast.error(e.message ?? t("common.error"));
              }
            }}
          >
            {director ? t("common.save") : t("admin.invite")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== Managers ===================
function ManagersTab({ organizationId, readOnly }: { organizationId: string; readOnly: boolean }) {
  const { t } = useTranslation();
  const { data: users = [], isLoading } = useAdminUsers(organizationId);
  const { data: spas = [] } = useAdminSpas(organizationId);
  const inviteMut = useInviteUser();
  const updateMut = useUpdateUser();
  const deleteMut = useDeleteUser();

  const spaById = useMemo(() => new Map(spas.map((s) => [s.id, s])), [spas]);
  const managers = users.filter((u) => u.role === "spa_manager");

  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [tempCredentials, setTempCredentials] = useState<{ email: string; password: string } | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("admin.managers.count", { count: managers.length })}</CardTitle>
        {!readOnly && (
          <Button size="sm" onClick={() => setInviting(true)} disabled={spas.length === 0}>
            <UserPlus className="h-4 w-4 mr-2" /> {t("admin.managers.invite")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : managers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.managers.empty")}</p>
        ) : (
          <div className="divide-y divide-border">
            {managers.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} · {u.spa_id ? (spaById.get(u.spa_id)?.name ?? t("admin.managers.unknownSpa")) : t("admin.managers.noSpa")}
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

      <ManagerEditDialog
        open={inviting || !!editing}
        manager={editing}
        spas={spas}
        onClose={() => {
          setInviting(false);
          setEditing(null);
        }}
        onSubmit={async (values) => {
          if (editing) {
            await updateMut.mutateAsync({
              user_id: editing.id,
              full_name: values.full_name,
              spa_id: values.spa_id,
            });
            toast.success(t("admin.managers.updatedToast"));
          } else {
            const res = await inviteMut.mutateAsync({
              email: values.email!,
              full_name: values.full_name,
              role: "spa_manager",
              spa_id: values.spa_id,
              organization_id: organizationId,
            });
            toast.success(t("admin.managers.invitedToast"));
            if (res?.temp_password) {
              setTempCredentials({ email: values.email!, password: res.temp_password });
            }
          }
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.managers.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.managers.deleteDesc", { name: deleteTarget?.full_name || deleteTarget?.email || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteMut.mutateAsync(deleteTarget.id);
                  toast.success(t("admin.managers.deletedToast"));
                  setDeleteTarget(null);
                } catch (e: any) {
                  toast.error(e.message ?? t("common.error"));
                }
              }}
            >
              {t("common.delete")}
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

function ManagerEditDialog({
  open,
  manager,
  spas,
  onClose,
  onSubmit,
}: {
  open: boolean;
  manager: AdminUser | null;
  spas: AdminSpa[];
  onClose: () => void;
  onSubmit: (values: { email?: string; full_name: string; spa_id: string }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [spaId, setSpaId] = useState<string>("");

  useMemo(() => {
    if (open) {
      setEmail(manager?.email ?? "");
      setFullName(manager?.full_name ?? "");
      setSpaId(manager?.spa_id ?? spas[0]?.id ?? "");
    }
  }, [open, manager, spas]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{manager ? t("admin.managers.editTitle") : t("admin.managers.inviteTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("admin.managers.fields.email")}</Label>
            <Input
              type="email"
              value={email}
              disabled={!!manager}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("admin.managers.fields.emailPlaceholder")}
            />
          </div>
          <div>
            <Label>{t("admin.managers.fields.fullName")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("admin.managers.fields.fullNamePlaceholder")} />
          </div>
          <div>
            <Label>{t("admin.managers.fields.spa")}</Label>
            <Select value={spaId} onValueChange={setSpaId}>
              <SelectTrigger><SelectValue placeholder={t("admin.managers.fields.spaPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {spas.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            onClick={async () => {
              if (!manager && !email.trim()) {
                toast.error(t("admin.emailRequired"));
                return;
              }
              if (!spaId) {
                toast.error(t("admin.managers.spaRequired"));
                return;
              }
              try {
                await onSubmit({
                  email: manager ? undefined : email.trim(),
                  full_name: fullName.trim(),
                  spa_id: spaId,
                });
                onClose();
              } catch (e: any) {
                toast.error(e.message ?? t("common.error"));
              }
            }}
          >
            {manager ? t("common.save") : t("admin.invite")}
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
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={!!credentials} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.tempCreds.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("admin.tempCreds.desc")}
        </p>
        <div className="space-y-2 mt-2">
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p><strong>{t("admin.tempCreds.emailLabel")}</strong> {credentials?.email}</p>
            <p><strong>{t("admin.tempCreds.passwordLabel")}</strong> <code>{credentials?.password}</code></p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              navigator.clipboard.writeText(`${t("admin.tempCreds.emailLabel")} ${credentials?.email}\n${t("admin.tempCreds.passwordLabel")} ${credentials?.password}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? t("admin.tempCreds.copied") : t("admin.tempCreds.copy")}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
