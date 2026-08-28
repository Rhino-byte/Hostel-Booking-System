"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type AdminNavigationContextValue = {
  /** True while a segmented tab overlay should show (Intake mode switch). */
  isLoading: boolean;
  routePending: boolean;
  segmentPending: boolean;
  setRoutePending: (pending: boolean) => void;
  startSegmentLoad: () => void;
  endSegmentLoad: () => void;
};

const AdminNavigationContext =
  createContext<AdminNavigationContextValue | null>(null);

export function AdminNavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [routePending, setRoutePending] = useState(false);
  const [segmentPending, setSegmentPending] = useState(false);
  const segmentStartedAt = useRef<number | null>(null);
  const segmentEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSegmentLoad = useCallback(() => {
    if (segmentEndTimer.current) {
      clearTimeout(segmentEndTimer.current);
      segmentEndTimer.current = null;
    }
    segmentStartedAt.current = Date.now();
    setSegmentPending(true);
  }, []);

  const endSegmentLoad = useCallback(() => {
    const started = segmentStartedAt.current;
    if (started == null) {
      setSegmentPending(false);
      return;
    }
    const elapsed = Date.now() - started;
    const minMs = 180;
    const remaining = minMs - elapsed;
    const finish = () => {
      segmentStartedAt.current = null;
      segmentEndTimer.current = null;
      setSegmentPending(false);
    };
    if (remaining <= 0) {
      finish();
      return;
    }
    if (segmentEndTimer.current) clearTimeout(segmentEndTimer.current);
    segmentEndTimer.current = setTimeout(finish, remaining);
  }, []);

  const isLoading = segmentPending;

  const value = useMemo(
    () => ({
      isLoading,
      routePending,
      segmentPending,
      setRoutePending,
      startSegmentLoad,
      endSegmentLoad,
    }),
    [isLoading, routePending, segmentPending, startSegmentLoad, endSegmentLoad]
  );

  return (
    <AdminNavigationContext.Provider value={value}>
      {children}
    </AdminNavigationContext.Provider>
  );
}

export function useAdminNavigation() {
  const ctx = useContext(AdminNavigationContext);
  if (!ctx) {
    throw new Error(
      "useAdminNavigation must be used within AdminNavigationProvider"
    );
  }
  return ctx;
}
