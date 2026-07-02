"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import {
  LEGACY_ROLE_NAMES,
  PERMISSION_CATALOG,
  PERMISSION_MODULES,
  PROPOSED_ROLE_NAMES,
  permissionKey,
  type CatalogPermission,
  type PermissionModuleId,
} from "@/lib/permission-catalog";
import { MultiSelect } from "@/components/ui/multi-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AdminRoleRow = {
  id: number;
  name: string;
  description: string | null;
};

type RolePermRow = {
  resource: string;
  action: string;
};

const SUBGROUP_LABELS: Record<string, string> = {
  warehouse_listings: "Warehouse listings",
  secondary_listings: "Secondary listings",
  catalogues: "Catalogues",
  focus_lists: "Focus lists",
  labels: "Labels",
  company_sku: "Company SKU",
  bulk: "Bulk operations",
  analytics: "Analytics & packs",
  elevated: "Elevated inbound actions",
};

export default function RoleManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, loading: authLoading } = useAuth();

  const [roles, setRoles] = React.useState<AdminRoleRow[]>([]);
  const [selectedRole, setSelectedRole] = React.useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = React.useState<Set<string>>(new Set());
  const [loadingRoles, setLoadingRoles] = React.useState(true);
  const [loadingPerms, setLoadingPerms] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [roleSearch, setRoleSearch] = React.useState("");
  const [permSearch, setPermSearch] = React.useState("");
  const [moduleFilter, setModuleFilter] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      router.replace("/listings/warehouse");
    }
  }, [authLoading, isAdmin, router]);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await apiFetch<AdminRoleRow[]>("/api/admin/roles");
        if (!cancel) setRoles(data);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load roles");
      } finally {
        if (!cancel) setLoadingRoles(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const loadRolePermissions = React.useCallback(async (roleName: string) => {
    setLoadingPerms(true);
    try {
      const rows = await apiFetch<RolePermRow[]>(
        `/api/admin/roles/${encodeURIComponent(roleName)}/permissions`
      );
      const keys = new Set(rows.map((r) => permissionKey(r.resource, r.action)));
      setSelectedKeys(keys);
      setSavedKeys(new Set(keys));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load permissions");
      setSelectedKeys(new Set());
      setSavedKeys(new Set());
    } finally {
      setLoadingPerms(false);
    }
  }, []);

  React.useEffect(() => {
    const fromUrl = searchParams.get("role");
    if (fromUrl && roles.some((r) => r.name === fromUrl)) {
      setSelectedRole(fromUrl);
      return;
    }
    if (!selectedRole && roles.length > 0) {
      const first = roles.find((r) => r.name !== "admin") ?? roles[0];
      setSelectedRole(first.name);
    }
  }, [roles, searchParams, selectedRole]);

  React.useEffect(() => {
    if (!selectedRole || selectedRole === "admin") return;
    void loadRolePermissions(selectedRole);
  }, [selectedRole, loadRolePermissions]);

  const filteredRoles = React.useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
    );
  }, [roles, roleSearch]);

  const catalogByModule = React.useMemo(() => {
    const map = new Map<PermissionModuleId, CatalogPermission[]>();
    for (const mod of PERMISSION_MODULES) {
      map.set(mod.id, []);
    }
    for (const entry of PERMISSION_CATALOG) {
      map.get(entry.module)?.push(entry);
    }
    return map;
  }, []);

  const visibleModules = React.useMemo(() => {
    if (moduleFilter.length === 0) return PERMISSION_MODULES;
    return PERMISSION_MODULES.filter((m) => moduleFilter.includes(m.id));
  }, [moduleFilter]);

  const permQuery = permSearch.trim().toLowerCase();

  function matchesPermSearch(entry: CatalogPermission): boolean {
    if (!permQuery) return true;
    const hay = `${entry.resource} ${entry.action} ${entry.description} ${entry.subgroup ?? ""}`.toLowerCase();
    return hay.includes(permQuery);
  }

  const isAdminRole = selectedRole === "admin";
  const dirty = React.useMemo(() => {
    if (selectedKeys.size !== savedKeys.size) return true;
    for (const k of selectedKeys) {
      if (!savedKeys.has(k)) return true;
    }
    return false;
  }, [selectedKeys, savedKeys]);

  function togglePermission(resource: string, action: string) {
    const key = permissionKey(resource, action);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllInModule(moduleId: PermissionModuleId) {
    const entries = catalogByModule.get(moduleId) ?? [];
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const e of entries) {
        next.add(permissionKey(e.resource, e.action));
      }
      return next;
    });
  }

  function clearModule(moduleId: PermissionModuleId) {
    const entries = catalogByModule.get(moduleId) ?? [];
    const moduleKeys = new Set(entries.map((e) => permissionKey(e.resource, e.action)));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const k of moduleKeys) next.delete(k);
      return next;
    });
  }

  async function handleSave() {
    if (!selectedRole || isAdminRole) return;
    setSaving(true);
    try {
      const permissions = [...selectedKeys].map((key) => {
        const idx = key.indexOf(":");
        const resource = key.slice(0, idx);
        const action = key.slice(idx + 1);
        return { resource, action };
      });
      const res = await apiFetch<{
        ok: boolean;
        added: string[];
        removed: string[];
      }>(`/api/admin/roles/${encodeURIComponent(selectedRole)}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions }),
      });
      setSavedKeys(new Set(selectedKeys));
      toast.success(
        `Saved permissions for ${selectedRole}` +
          (res.added.length || res.removed.length
            ? ` (+${res.added.length} / -${res.removed.length})`
            : "")
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleSelectRole(name: string) {
    if (dirty && selectedRole && !window.confirm("Discard unsaved permission changes?")) {
      return;
    }
    setSelectedRole(name);
    setPermSearch("");
  }

  const roleMeta = roles.find((r) => r.name === selectedRole);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Role Management</h1>
          <p className="text-muted-foreground text-sm">
            Add or remove permissions per role. Assign roles to users in{" "}
            <Link href="/settings/users" className="text-primary underline-offset-4 hover:underline">
              User Management
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder="Search roles…"
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              aria-label="Search roles"
            />
            {loadingRoles ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
                {filteredRoles.map((role) => (
                  <li key={role.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectRole(role.name)}
                      className={cn(
                        "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                        selectedRole === role.name && "bg-primary/10 font-medium text-primary"
                      )}
                    >
                      <span className="flex items-center gap-1.5 font-mono text-xs">
                        {role.name}
                        {LEGACY_ROLE_NAMES.has(role.name) ? (
                          <Badge variant="outline" className="text-[10px]">
                            legacy
                          </Badge>
                        ) : null}
                        {PROPOSED_ROLE_NAMES.has(role.name) ? (
                          <Badge variant="secondary" className="text-[10px]">
                            new
                          </Badge>
                        ) : null}
                      </span>
                      {role.description ? (
                        <span className="text-muted-foreground line-clamp-2 text-[11px]">
                          {role.description}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selectedRole ? (
                <>
                  Permissions for <span className="font-mono">{selectedRole}</span>
                </>
              ) : (
                "Select a role"
              )}
            </CardTitle>
            {roleMeta?.description ? (
              <p className="text-muted-foreground text-sm">{roleMeta.description}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedRole ? (
              <p className="text-muted-foreground text-sm">Choose a role from the list.</p>
            ) : isAdminRole ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                The <span className="font-mono">admin</span> role has wildcard access{" "}
                <span className="font-mono">*:*</span>. Individual permissions cannot be edited here.
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Filter modules</Label>
                    <MultiSelect
                      options={PERMISSION_MODULES.map((m) => ({
                        value: m.id,
                        label: m.label,
                      }))}
                      selected={moduleFilter}
                      onChange={setModuleFilter}
                      placeholder="All modules"
                      ariaLabel="Filter permission modules"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="perm-search">Search permissions</Label>
                    <Input
                      id="perm-search"
                      placeholder="resource, action, description…"
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                    />
                  </div>
                </div>

                {loadingPerms ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="max-h-[32rem] space-y-4 overflow-y-auto pr-1">
                    {visibleModules.map((mod) => {
                      const entries = (catalogByModule.get(mod.id) ?? []).filter(matchesPermSearch);
                      if (entries.length === 0) return null;

                      const bySubgroup = new Map<string, CatalogPermission[]>();
                      for (const e of entries) {
                        const sg = e.subgroup ?? "_default";
                        if (!bySubgroup.has(sg)) bySubgroup.set(sg, []);
                        bySubgroup.get(sg)!.push(e);
                      }

                      return (
                        <div key={mod.id} className="rounded-md border p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-semibold text-sm">{mod.label}</h3>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => selectAllInModule(mod.id)}
                              >
                                Select all
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => clearModule(mod.id)}
                              >
                                Clear
                              </Button>
                            </div>
                          </div>
                          {[...bySubgroup.entries()].map(([sg, items]) => (
                            <div key={sg} className="mb-3 last:mb-0">
                              {sg !== "_default" ? (
                                <p className="text-muted-foreground mb-1 text-xs font-medium">
                                  {SUBGROUP_LABELS[sg] ?? sg}
                                </p>
                              ) : null}
                              <ul className="space-y-1">
                                {items.map((entry) => {
                                  const key = permissionKey(entry.resource, entry.action);
                                  const checked = selectedKeys.has(key);
                                  return (
                                    <li key={key}>
                                      <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-muted/60">
                                        <input
                                          type="checkbox"
                                          className="mt-1"
                                          checked={checked}
                                          onChange={() =>
                                            togglePermission(entry.resource, entry.action)
                                          }
                                        />
                                        <span className="min-w-0 flex-1">
                                          <span className="font-mono text-xs">
                                            {entry.resource}:{entry.action}
                                          </span>
                                          <span className="text-muted-foreground block text-xs">
                                            {entry.description}
                                          </span>
                                        </span>
                                      </label>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <p className="text-muted-foreground text-xs">
                    {selectedKeys.size} permission{selectedKeys.size === 1 ? "" : "s"} selected
                    {dirty ? " · unsaved changes" : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!dirty || saving}
                      onClick={() => setSelectedKeys(new Set(savedKeys))}
                    >
                      Discard
                    </Button>
                    <Button type="button" disabled={!dirty || saving} onClick={() => void handleSave()}>
                      {saving ? "Saving…" : "Save permissions"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
