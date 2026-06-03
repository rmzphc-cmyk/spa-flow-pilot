import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Destination {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  country: string | null;
  timezone: string;
}

export interface AdminSpa {
  id: string;
  name: string;
  slug: string;
  organization_id: string;
  destination_id: string;
  reporting_cycle_type: "weekly" | "monthly";
  is_active: boolean;
  timezone: string;
  country: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: "spa_manager" | "direction" | "admin" | "employee";
  spa_id: string | null;
  destination_id: string | null;
  organization_id: string | null;
  is_active: boolean;
}

// ---------- Organizations ----------
export function useOrganizations() {
  return useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Organization[];
    },
  });
}

// ---------- Destinations ----------
export function useDestinations(organizationId?: string) {
  return useQuery({
    queryKey: ["admin", "destinations", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("destinations")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Destination[];
    },
  });
}

export function useCreateDestination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organization_id: string; name: string; country?: string; timezone?: string }) => {
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { error } = await supabase.from("destinations").insert({
        organization_id: input.organization_id,
        name: input.name,
        slug,
        country: input.country ?? null,
        timezone: input.timezone ?? "Atlantic/Canary",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "destinations"] }),
  });
}

export function useUpdateDestination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; country?: string; timezone?: string }) => {
      const update: { name?: string; slug?: string; country?: string | null; timezone?: string } = {};
      if (input.name) {
        update.name = input.name;
        update.slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      }
      if (input.country !== undefined) update.country = input.country;
      if (input.timezone !== undefined) update.timezone = input.timezone;
      const { error } = await supabase.from("destinations").update(update).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "destinations"] }),
  });
}

export function useDeleteDestination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("destinations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "destinations"] });
      qc.invalidateQueries({ queryKey: ["admin", "spas"] });
    },
  });
}

// ---------- Spas (admin) ----------
export function useAdminSpas(organizationId?: string) {
  return useQuery({
    queryKey: ["admin", "spas", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spas")
        .select("id, name, slug, organization_id, destination_id, reporting_cycle_type, is_active, timezone, country")
        .eq("organization_id", organizationId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as AdminSpa[];
    },
  });
}

export function useCreateSpa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      destination_id: string;
      name: string;
      timezone?: string;
      country?: string;
    }) => {
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { data: userRes } = await supabase.auth.getUser();
      const created_by = userRes.user?.id;
      if (!created_by) throw new Error("Not authenticated");
      const { error } = await supabase.from("spas").insert({
        organization_id: input.organization_id,
        destination_id: input.destination_id,
        name: input.name,
        slug,
        reporting_cycle_type: input.reporting_cycle_type,
        timezone: input.timezone ?? "Atlantic/Canary",
        country: input.country ?? null,
        created_by,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "spas"] }),
  });
}

export function useUpdateSpa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      destination_id?: string;
      reporting_cycle_type?: "weekly" | "monthly";
      is_active?: boolean;
    }) => {
      const update: {
        name?: string;
        slug?: string;
        destination_id?: string;
        reporting_cycle_type?: "weekly" | "monthly";
        is_active?: boolean;
      } = {};
      if (input.name) {
        update.name = input.name;
        update.slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      }
      if (input.destination_id !== undefined) update.destination_id = input.destination_id;
      if (input.reporting_cycle_type !== undefined) update.reporting_cycle_type = input.reporting_cycle_type;
      if (input.is_active !== undefined) update.is_active = input.is_active;
      const { error } = await supabase.from("spas").update(update).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "spas"] }),
  });
}

export function useDeleteSpa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "spas"] }),
  });
}

// ---------- Users (admin) ----------
export function useAdminUsers(organizationId?: string) {
  return useQuery({
    queryKey: ["admin", "users", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, full_name, role, spa_id, destination_id, organization_id, is_active")
        .eq("organization_id", organizationId!)
        .order("role")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

async function callManageUser(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-manage-user", { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { ok: true; user_id?: string; temp_password?: string };
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      full_name: string;
      role: "spa_manager" | "direction";
      spa_id?: string | null;
      destination_id?: string | null;
      organization_id?: string | null;
    }) => callManageUser({ action: "invite", ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      full_name?: string;
      role?: "spa_manager" | "direction";
      spa_id?: string | null;
      destination_id?: string | null;
    }) => callManageUser({ action: "update", ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (user_id: string) => callManageUser({ action: "delete", user_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}
