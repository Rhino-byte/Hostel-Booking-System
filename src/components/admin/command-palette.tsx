"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Map,
  Wallet,
  FileBarChart2,
  Settings,
  UserRound,
} from "lucide-react";

type StudentHit = { id: string; name: string; admissionNo: string };

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [students, setStudents] = useState<StudentHit[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/students?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students ?? []);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <Command className="rounded-2xl" shouldFilter={false}>
          <div className="border-b border-border px-3">
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder="Search students or jump to a page…"
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches
            </Command.Empty>
            <Command.Group heading="Navigate" className="px-1 py-2 text-xs text-muted-foreground">
              {[
                { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
                { href: "/admin/intake", label: "Intake", icon: ClipboardList },
                { href: "/admin/students", label: "Students", icon: Users },
                { href: "/admin/hostel", label: "Hostel Map", icon: Map },
                { href: "/admin/payments", label: "Payments", icon: Wallet },
                { href: "/admin/reports", label: "Reports", icon: FileBarChart2 },
                { href: "/admin/settings", label: "Settings", icon: Settings },
              ].map(({ href, label, icon: Icon }) => (
                <Command.Item
                  key={href}
                  value={label}
                  onSelect={() => go(href)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground aria-selected:bg-muted"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </Command.Item>
              ))}
            </Command.Group>
            {students.length ? (
              <Command.Group heading="Students" className="px-1 py-2 text-xs text-muted-foreground">
                {students.map((s) => (
                  <Command.Item
                    key={s.id}
                    value={`${s.name} ${s.admissionNo}`}
                    onSelect={() => go(`/admin/payments?studentId=${s.id}`)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm aria-selected:bg-muted"
                  >
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                    <span>{s.name}</span>
                    <span className="text-muted-foreground">{s.admissionNo}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
