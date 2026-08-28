"use client";

import { useState } from "react";
import {
  AppSidebar,
  MobileTabBar,
  useSidebarCollapsed,
} from "@/components/admin/app-sidebar";
import { AdminPageTransition } from "@/components/admin/admin-page-transition";
import { TopBar } from "@/components/admin/top-bar";
import { CommandPalette } from "@/components/admin/command-palette";

export function AdminShell({
  children,
  termName,
}: {
  children: React.ReactNode;
  termName?: string;
}) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const [cmdOpen, setCmdOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      <AppSidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar termName={termName} onOpenCommand={() => setCmdOpen(true)} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-6 md:pb-6">
          <AdminPageTransition>{children}</AdminPageTransition>
        </div>
      </div>
      <MobileTabBar />
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
