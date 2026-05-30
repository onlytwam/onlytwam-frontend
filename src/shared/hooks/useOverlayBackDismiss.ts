import { useCallback, useEffect, useRef } from "react";

type OverlayEntry = {
  id: string;
  onDismiss: () => void;
};

const OVERLAY_STATE_KEY = "__twamOverlayId";
const overlayStack: OverlayEntry[] = [];
let popstateListenerAttached = false;
let suppressNextPopstate = false;

function ensurePopstateListener() {
  if (popstateListenerAttached || typeof window === "undefined") return;
  popstateListenerAttached = true;

  window.addEventListener("popstate", () => {
    if (suppressNextPopstate) {
      suppressNextPopstate = false;
      return;
    }

    const entry = overlayStack.pop();
    if (entry) entry.onDismiss();
  });
}

function removeOverlayEntry(id: string) {
  for (let i = overlayStack.length - 1; i >= 0; i -= 1) {
    if (overlayStack[i].id === id) {
      overlayStack.splice(i, 1);
      break;
    }
  }
}

export function useOverlayBackDismiss(onDismiss: () => void, enabled = true) {
  const onDismissRef = useRef(onDismiss);
  const overlayIdRef = useRef(
    `twam-overlay-${Math.random().toString(36).slice(2, 11)}`,
  );

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    ensurePopstateListener();

    const entry: OverlayEntry = {
      id: overlayIdRef.current,
      onDismiss: () => onDismissRef.current(),
    };

    overlayStack.push(entry);
    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        [OVERLAY_STATE_KEY]: overlayIdRef.current,
      },
      "",
    );

    return () => {
      removeOverlayEntry(overlayIdRef.current);

      const currentState = window.history.state as Record<
        string,
        unknown
      > | null;

      if (currentState?.[OVERLAY_STATE_KEY] === overlayIdRef.current) {
        suppressNextPopstate = true;
        window.history.back();
      }
    };
  }, [enabled]);

  const dismiss = useCallback(() => {
    if (typeof window === "undefined") {
      onDismissRef.current();
      return;
    }

    const currentState = window.history.state as Record<string, unknown> | null;
    if (currentState?.[OVERLAY_STATE_KEY] === overlayIdRef.current) {
      window.history.back();
      return;
    }

    onDismissRef.current();
  }, []);

  const dismissThen = useCallback((next?: () => void) => {
    if (!next) {
      dismiss();
      return;
    }

    const currentState = window.history.state as Record<string, unknown> | null;
    const hasOverlayEntry =
      currentState?.[OVERLAY_STATE_KEY] === overlayIdRef.current;

    if (hasOverlayEntry) {
      // history.back() is asynchronous — popstate fires on a later tick.
      // If we call next() immediately (even via setTimeout 0) the popstate
      // from back() fires AFTER the navigation and undoes it.
      // Fix: add a one-shot popstate listener, THEN call back().
      const onPop = () => {
        window.removeEventListener("popstate", onPop);
        next();
      };
      window.addEventListener("popstate", onPop);
      window.history.back();
    } else {
      // No overlay entry in history — dismiss sync then navigate.
      onDismissRef.current();
      next();
    }
  }, []);

  return { dismiss, dismissThen };
}
