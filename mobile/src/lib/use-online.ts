import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { API_BASE_URL } from "./config";

// Can this iPad reach the Surge API RIGHT NOW? Pre-auth staff need this: a
// terminal that cannot reach the API will take a PIN and then fail at the first
// read, and "why is it stuck" is the question this answers before anyone types.
//
// Mirrors the web heartbeat (app/app/pos/use-online.ts): we never guess, we
// never start optimistic, and only an actual round trip decides. The probe is
// GET /api/v1/session with NO bearer token — resolveApiContext rejects that at
// the first line, before it touches Postgres, so the reply is a ~60-byte 401
// that costs the server nothing. ANY HTTP status means the host answered, which
// is precisely the question; only a thrown fetch or a timeout means offline.
//
// Deliberately NOT reported: the host, the LAN address or the port. TouchBistro
// prints "Offline - 10.0.1.185:1337" on its pre-auth venue picker; that is the
// venue's internal network topology on a screen anyone standing at the counter
// can read, and the competitor study flags it as a defect rather than a feature.

const PROBE_URL = `${API_BASE_URL}/api/v1/session`;
const POLL_MS = 30_000;
const TIMEOUT_MS = 8_000;
// One failure is not an outage. Measured on the pilot iPad: the very first probe
// after a cold start raced the app's own startup and timed out, painting a red
// "Offline" on a screen whose entire job is to be trusted — then the next poll
// corrected it to green. A wrong red is worse than a slow green here, so the
// indicator holds at "checking" until two probes in a row have failed.
const FAILS_BEFORE_OFFLINE = 2;
const RETRY_MS = 3_000;

export type Reachability = "checking" | "online" | "offline";

export function useApiReachable(): Reachability {
  const [state, setState] = useState<Reachability>("checking");

  useEffect(() => {
    let alive = true;
    let fails = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const ping = async () => {
      // A network that black-holes packets never rejects, so without this the
      // indicator would sit on "checking" forever and tell nobody anything.
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      try {
        await fetch(PROBE_URL, { method: "GET", cache: "no-store", signal: ctl.signal });
        if (!alive) return;
        fails = 0;
        setState("online");
      } catch {
        if (!alive) return;
        fails += 1;
        // Once it has said "offline" it keeps saying it until a probe succeeds;
        // the threshold only governs the first transition away from "checking".
        if (fails >= FAILS_BEFORE_OFFLINE) setState("offline");
        // Confirm quickly rather than waiting out the 30s poll — a genuine
        // outage should still surface in seconds, not in the best part of a
        // minute, or the indicator is just decoration.
        else retry = setTimeout(ping, RETRY_MS);
      } finally {
        clearTimeout(t);
      }
    };

    ping();
    const iv = setInterval(ping, POLL_MS);
    // Coming back from the background is the most likely moment for this to
    // have changed (carried out of Wi-Fi range and back), so re-check at once
    // rather than waiting out the poll.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") ping();
    });

    return () => {
      alive = false;
      clearInterval(iv);
      if (retry) clearTimeout(retry);
      sub.remove();
    };
  }, []);

  return state;
}
