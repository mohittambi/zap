"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Key, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { ENABLE_API_KEY_REGENERATION } from "@/lib/featureFlags";
import { openSelectDropdownOnArrowKey } from "@/lib/open-select-dropdown-on-arrow-key";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AdminUserRow = {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
  roles: string[];
};

type AdminRoleRow = {
  id: number;
  name: string;
  description: string | null;
};

type RolePermRow = {
  resource: string;
  action: string;
  description: string | null;
};

/* ── role label colours ── */
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  ops_manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  warehouse_staff: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  finance: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  merchandising: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  sales: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  viewer: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
  warehouse_manager:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  vendor: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
};

function RoleBadge({ name }: { name: string }) {
  const cls = ROLE_COLORS[name] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ${cls}`}
    >
      {name}
    </span>
  );
}

/* ── multi-role dropdown select ── */
function RoleMultiSelect({
  roles,
  selected,
  onChange,
}: {
  roles: AdminRoleRow[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((s) => s !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => openSelectDropdownOnArrowKey(e, setOpen, open)}
        className="flex w-full min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground">Select roles…</span>
        ) : (
          selected.map((name) => (
            <span
              key={name}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ${
                ROLE_COLORS[name] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {name}
              <span
                role="button"
                tabIndex={0}
                className="cursor-pointer opacity-70 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(name);
                }}
                onKeyDown={(e) => e.key === "Enter" && toggle(name)}
              >
                <X className="size-3" />
              </span>
            </span>
          ))
        )}
        <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-muted/60"
            >
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-primary"
                checked={selected.includes(role.name)}
                onChange={() => toggle(role.name)}
              />
              <span>
                <span className="block font-mono text-xs font-medium leading-tight">
                  {role.name}
                </span>
                {role.description ? (
                  <span className="block text-xs leading-tight text-muted-foreground">
                    {role.description}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── permissions panel ── */
function RolePermissionsPanel({
  roleName,
  onClose,
}: {
  roleName: string;
  onClose: () => void;
}) {
  const [perms, setPerms] = React.useState<RolePermRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await apiFetch<RolePermRow[]>(
          `/api/admin/roles/${roleName}/permissions`
        );
        if (!cancel) setPerms(data);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [roleName]);

  const grouped = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of perms) {
      if (!map[p.resource]) map[p.resource] = [];
      map[p.resource].push(p.action);
    }
    return map;
  }, [perms]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          <span className="font-medium">
            Permissions for{" "}
            <span className="font-mono text-sm">{roleName}</span>
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : perms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No permissions assigned.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([resource, actions]) => (
                <div key={resource}>
                  <p className="mb-1 font-mono text-xs font-semibold text-foreground">
                    {resource}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {actions.sort().map((act) => (
                      <span
                        key={act}
                        className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════ Main page ══════════════ */
export default function AdminUsersSettingsPage() {
  const router = useRouter();
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = React.useState<AdminUserRow[]>([]);
  const [rolesCatalog, setRolesCatalog] = React.useState<AdminRoleRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  /* create dialog state */
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createEmail, setCreateEmail] = React.useState("");
  const [createPassword, setCreatePassword] = React.useState("");
  const [createRoles, setCreateRoles] = React.useState<string[]>([]);

  /* edit dialog state */
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminUserRow | null>(null);
  const [editIsActive, setEditIsActive] = React.useState(true);
  const [editRoles, setEditRoles] = React.useState<string[]>([]);
  const [editPassword, setEditPassword] = React.useState("");

  /* permissions panel */
  const [viewingRolePerms, setViewingRolePerms] = React.useState<string | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [regeneratingApiKey, setRegeneratingApiKey] = React.useState(false);

  const loadAll = React.useCallback(async () => {
    const [uRows, rRows] = await Promise.all([
      apiFetch<AdminUserRow[]>("/api/admin/users"),
      apiFetch<AdminRoleRow[]>("/api/admin/roles"),
    ]);
    setUsers(uRows);
    setRolesCatalog(rRows.sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  React.useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadAll()
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [isAdmin, loadAll]);

  React.useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Administrator access required.");
      router.replace("/listings/warehouse");
    }
  }, [isAdmin, loading, router]);

  async function refresh() {
    setLoading(true);
    loadAll()
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }

  async function regenerateApiKey() {
    if (!ENABLE_API_KEY_REGENERATION) return;
    setRegeneratingApiKey(true);
    try {
      const res = await apiFetch<{ api_key: string; message: string }>(
        "/api/auth/refresh-api-key",
        { method: "POST" }
      );
      toast.success("New API key generated", {
        description: "Copy it now — it won’t be shown again.",
      });
      await navigator.clipboard.writeText(res.api_key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate API key");
    } finally {
      setRegeneratingApiKey(false);
    }
  }

  function openCreate() {
    setCreateEmail("");
    setCreatePassword("");
    setCreateRoles([]);
    setCreateOpen(true);
  }

  function openEdit(row: AdminUserRow) {
    setEditing(row);
    setEditIsActive(row.is_active);
    setEditRoles([...row.roles]);
    setEditPassword("");
    setEditOpen(true);
  }

  async function submitCreate() {
    if (createRoles.length === 0) {
      toast.error("Select at least one role.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: createEmail.trim(),
          password: createPassword,
          roles: createRoles,
        }),
      });
      toast.success("User created");
      setCreateOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit() {
    if (!editing) return;
    if (editRoles.length === 0) {
      toast.error("Select at least one role.");
      return;
    }
    setSaving(true);
    try {
      const body: { is_active: boolean; roles: string[]; password?: string } = {
        is_active: editIsActive,
        roles: editRoles,
      };
      if (editPassword.trim().length >= 8) body.password = editPassword;
      await apiFetch(`/api/admin/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success("User updated");
      setEditOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href="/listings/warehouse"
              className="text-primary underline-offset-4 hover:underline"
            >
              Home
            </Link>
            <span aria-hidden className="px-2">/</span>
            User management
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Users &amp; Roles</h1>
          <p className="text-sm text-muted-foreground">
            Create accounts, assign roles, and control access. Admin only.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          + New user
        </Button>
      </div>

      <div className="flex gap-4">
        {/* ── User table ── */}
        <div className="min-w-0 flex-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Team members ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="hidden w-40 sm:table-cell">Created</TableHead>
                    <TableHead className="w-20 text-right">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {[1, 2, 3, 4, 5].map((j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : users.length === 0
                    ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          No users found.
                        </TableCell>
                      </TableRow>
                    )
                    : users.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.email}
                            {currentUser?.id === row.id ? (
                              <span className="ml-1 text-xs text-muted-foreground">
                                (you)
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {row.roles.length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                row.roles.map((rn) => (
                                  <button
                                    key={rn}
                                    type="button"
                                    title="View permissions"
                                    onClick={() =>
                                      setViewingRolePerms(
                                        viewingRolePerms === rn ? null : rn
                                      )
                                    }
                                  >
                                    <RoleBadge name={rn} />
                                  </button>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={row.is_active ? "default" : "outline"}
                              className="text-xs"
                            >
                              {row.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                            {new Date(row.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(row)}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ── Roles reference ── */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Available roles</CardTitle>
              <p className="text-xs text-muted-foreground">
                Click a role badge above or below to view its permissions.
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {rolesCatalog.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      title={role.description ?? role.name}
                      className="flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left hover:bg-muted/50"
                      onClick={() =>
                        setViewingRolePerms(
                          viewingRolePerms === role.name ? null : role.name
                        )
                      }
                    >
                      <RoleBadge name={role.name} />
                      {role.description ? (
                        <span className="mt-0.5 text-[11px] text-muted-foreground">
                          {role.description}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="size-4 text-muted-foreground" aria-hidden />
                Automation API key
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Long-lived credential for scripts and server-to-server access to Zap APIs
                (send as <span className="font-mono">Authorization: Bearer zap_…</span>).
                Only the signed-in admin&apos;s key is rotated.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>Regenerating creates a new key and immediately revokes the previous one.</li>
                <li>The new key is shown once and copied to your clipboard — store it securely.</li>
                <li>
                  API route:{" "}
                  <span className="font-mono text-[11px]">POST /api/auth/refresh-api-key</span>{" "}
                  (admin <span className="font-mono">*:*</span> permission).
                </li>
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!ENABLE_API_KEY_REGENERATION || regeneratingApiKey}
                  onClick={() => void regenerateApiKey()}
                >
                  {regeneratingApiKey ? "Regenerating…" : "Regenerate API key"}
                </Button>
                {!ENABLE_API_KEY_REGENERATION ? (
                  <p className="text-xs text-muted-foreground">
                    Disabled in code — set{" "}
                    <span className="font-mono">ENABLE_API_KEY_REGENERATION</span> in{" "}
                    <span className="font-mono">src/lib/featureFlags.ts</span> when you need to
                    rotate credentials.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Permissions side panel ── */}
        {viewingRolePerms ? (
          <div className="hidden w-72 shrink-0 xl:block">
            <Card className="sticky top-20 h-[calc(100vh-8rem)] overflow-hidden">
              <RolePermissionsPanel
                roleName={viewingRolePerms}
                onClose={() => setViewingRolePerms(null)}
              />
            </Card>
          </div>
        ) : null}
      </div>

      {/* ── Create user dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              Email, password (min 8 chars), and at least one role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cu-email">Email</Label>
              <Input
                id="cu-email"
                type="email"
                autoComplete="off"
                placeholder="user@company.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-pass">Temporary password</Label>
              <Input
                id="cu-pass"
                type="password"
                autoComplete="new-password"
                placeholder="Min 8 characters"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <RoleMultiSelect
                roles={rolesCatalog}
                selected={createRoles}
                onChange={setCreateRoles}
              />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void submitCreate()}
            >
              {saving ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit user dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update activation status, roles, or reset password.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="mt-0.5 text-sm font-medium">{editing.email}</p>
              </div>

              <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                <input
                  id="edit-active"
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={editIsActive}
                  disabled={currentUser?.id === editing.id}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                />
                <label htmlFor="edit-active" className="cursor-pointer text-sm">
                  Account active
                  {currentUser?.id === editing.id ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (cannot deactivate yourself)
                    </span>
                  ) : null}
                </label>
              </div>

              <div className="space-y-2">
                <Label>Roles</Label>
                <RoleMultiSelect
                  roles={rolesCatalog}
                  selected={editRoles}
                  onChange={setEditRoles}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eu-pass">New password (optional)</Label>
                <Input
                  id="eu-pass"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void submitEdit()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Permissions drawer (mobile / smaller screens) ── */}
      <Dialog
        open={!!viewingRolePerms}
        onOpenChange={(o) => !o && setViewingRolePerms(null)}
      >
        <DialogContent className="h-[80vh] gap-0 p-0 sm:max-w-sm xl:hidden">
          {viewingRolePerms ? (
            <RolePermissionsPanel
              roleName={viewingRolePerms}
              onClose={() => setViewingRolePerms(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
