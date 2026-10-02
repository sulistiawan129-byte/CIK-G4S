"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/gc/client";

/**
 * Subscribes to realtime changes on nc_reports & nc_report_findings and
 * calls `onChange` (debounced) whenever data changes anywhere — including
 * from other users/devices. Use this to auto-refresh dashboard/list data
 * without requiring a manual page reload.
 */
export function useRealtimeNcReports(onChange: () => void) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    function trigger() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(onChange, 400);
    }

    const channel = supabase
      .channel("nc-reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "nc_reports" }, trigger)
      .on("postgres_changes", { event: "*", schema: "public", table: "nc_report_findings" }, trigger)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
