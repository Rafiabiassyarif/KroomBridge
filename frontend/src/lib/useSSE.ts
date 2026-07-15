import { useEffect, useRef } from "react";

/**
 * Hook untuk subscribe ke Server-Sent Events di /api/events/stream.
 *
 * @param eventTypes - daftar event yang mau didengar (mis. ['client:change', 'route:change']).
 * @param onEvent - callback dipanggil saat event masuk dengan tipe sesuai filter.
 * @param enabled - default true. Set false untuk disable.
 *
 * Hook ini auto-reconnect saat koneksi putus dan otomatis pasang token
 * admin dari localStorage.
 */
export function useSSE(
  eventTypes: string[],
  onEvent: (type: string, data: any) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(onEvent);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  // Selalu pakai callback terbaru (closure-safe)
  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || eventTypes.length === 0) return;

    let cancelled = false;

    const connect = () => {
      const token = sessionStorage.getItem("kroombridge_admin_token");
      if (!token) return;

      try {
        const es = new EventSource(
          `/api/events/stream?token=${encodeURIComponent(token)}`,
        );
        esRef.current = es;

        eventTypes.forEach((evtType) => {
          es.addEventListener(evtType, (e: MessageEvent) => {
            if (cancelled) return;
            try {
              const data = JSON.parse(e.data);
              callbackRef.current(evtType, data);
            } catch {
              /* abaikan payload invalid */
            }
          });
        });

        es.onerror = () => {
          es.close();
          esRef.current = null;
          if (cancelled) return;
          // Reconnect setelah 3 detik
          reconnectTimer.current = window.setTimeout(connect, 3000);
        };
      } catch {
        // Browser tidak support EventSource atau gagal koneksi
        if (!cancelled) {
          reconnectTimer.current = window.setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) {
        window.clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, eventTypes.join(",")]);
}
