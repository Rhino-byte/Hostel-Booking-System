"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { useEffect } from "react";
import { useAdminNavigation } from "@/components/admin/admin-navigation-context";

function LinkPendingSync() {
  const { pending } = useLinkStatus();
  const { setRoutePending } = useAdminNavigation();

  useEffect(() => {
    setRoutePending(pending);
    return () => setRoutePending(false);
  }, [pending, setRoutePending]);

  return null;
}

export function AdminNavLink({
  href,
  className,
  title,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} title={title}>
      <LinkPendingSync />
      {children}
    </Link>
  );
}
