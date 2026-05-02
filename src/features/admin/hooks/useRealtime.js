import { useState, useEffect, useRef } from "react";
import { fetchRealtimeUsers } from "../utils/ga4Api";

/**
 * Polls GA4 Realtime API every 30 seconds for active users
 * @param {string} propertyId
 * @param {string} accessToken
 * @returns {number} activeUsers
 */
export default function useRealtime(propertyId, accessToken) {
  const [count, setCount] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!propertyId || !accessToken) return;

    const poll = async () => {
      try {
        const n = await fetchRealtimeUsers(propertyId, accessToken);
        setCount(n);
      } catch {
        // Silently fail — realtime is non-critical
      }
    };

    poll();
    timerRef.current = setInterval(poll, 30_000);
    return () => clearInterval(timerRef.current);
  }, [propertyId, accessToken]);

  return count;
}
