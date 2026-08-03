"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ListedUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  firebaseUid: string | null;
};

const ROLES = ["ADMIN", "SECRETARY", "MATRON", "PARENT"] as const;

export function UsersManagementCard({
  initialUsers,
}: {
  initialUsers: ListedUser[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("PARENT");
  const [password, setPassword] = useState("");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create user");
      toast.success(
        password
          ? "User created with email/password"
          : "User invited — they can sign in with Google using this email"
      );
      setUsers((prev) =>
        [...prev, { ...data.user, phone: null }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("PARENT");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              No public sign-up. Add staff and parents here; they sign in with
              email/password or Google.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            Add user
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users yet. Seed staff Firebase UIDs or add someone above.
            </p>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.email || u.phone || "No email"}
                    {!u.firebaseUid ? " · pending first sign-in" : ""}
                  </p>
                </div>
                <Badge variant="outline">{u.role}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Provide a temporary password for email login, or leave blank so
              they must use Google with this email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Full name</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <select
                id="user-role"
                className="flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as (typeof ROLES)[number])
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">
                Temporary password (optional)
              </Label>
              <Input
                id="user-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters, or leave blank"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Create user"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
