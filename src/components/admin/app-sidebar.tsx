"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Map,
  Wallet,
  FileBarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/intake", label: "Intake", icon: ClipboardList },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/hostel", label: "Hostel Map", icon: Map },
  { href: "/admin/payments", label: "Payments", icon: Wallet },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart2 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/** Mobile keeps 5 items: drop Reports/Settings so Intake stays in the secretary primary flow. */
const mobileNav = nav.filter(
  (item) => item.href !== "/admin/reports" && item.href !== "/admin/settings"
);

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.message("Signed out");
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto border-r border-border bg-card transition-all duration-200 md:flex",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-3">
        <Link href="/admin" className="flex items-center gap-2 overflow-hidden text-primary">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Home className="h-4 w-4" />
          </span>
          {!collapsed ? (
            <span className="truncate font-serif text-sm font-semibold">St. Clare Admin</span>
          ) : null}
        </Link>
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          className={cn("w-full justify-start gap-3", collapsed && "justify-center px-0")}
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed ? "Sign out" : null}
        </Button>
      </div>
    </aside>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const items = mobileNav;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[10px]",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            {label.split(" ")[0]}
          </Link>
        );
      })}
    </nav>
  );
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("stclare-sidebar");
    if (saved === "1") setCollapsed(true);
  }, []);
  function toggle() {
    setCollapsed((v) => {
      localStorage.setItem("stclare-sidebar", !v ? "1" : "0");
      return !v;
    });
  }
  return { collapsed, toggle };
}
