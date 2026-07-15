import { useEffect, useRef } from "react";

/**
 * Hook untuk auto-refresh data secara berkala.
 *
 * @param fetcher - fungsi yang dipanggil setiap interval
 * @param enabled - apakah auto-refresh aktif
 * @param intervalSec - interval dalam detik (default: 10)
 *
 * Hook ini TIDAK memanggil fetcher di mount — Anda harus panggil sendiri.
 * Hanya menjalankan `fetcher` setiap `intervalSec` detik selama `enabled` true,
 * dan akan berhenti saat unmount atau enabled = false.
 */
export function useAutoRefresh(
  fetcher: () => void,
  enabled: boolean = true,
  intervalSec: number = 10,
) {
  const ref = useRef<number | null>(null);
  const fetcherRef = useRef(fetcher);

  // Always use latest fetcher (closure-safe)
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    if (ref.current) {
      window.clearInterval(ref.current);
      ref.current = null;
    }

    if (enabled && intervalSec > 0) {
      ref.current = window.setInterval(() => {
        // Skip jika tab tidak terlihat (hemat resource)
        if (document.visibilityState === "visible") {
          fetcherRef.current();
        }
      }, intervalSec * 1000);
    }

    return () => {
      if (ref.current) {
        window.clearInterval(ref.current);
        ref.current = null;
      }
    };
  }, [enabled, intervalSec]);
}
