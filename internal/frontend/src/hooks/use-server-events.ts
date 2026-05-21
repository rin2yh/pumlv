import { useEffect, useRef } from "react";
import { subscribe } from "../api/events";

export interface ServerEventHandlers {
  onTree: () => void;
  onChanged: (path: string) => void;
}

export function useServerEvents(handlers: ServerEventHandlers): void {
  // The SSE subscription opens once and must survive handler-identity churn,
  // so route every event through a ref that always points at the latest one.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type === "changed") {
        handlersRef.current.onChanged(ev.path);
      } else if (ev.type === "tree") {
        handlersRef.current.onTree();
      }
    });
  }, []);
}
