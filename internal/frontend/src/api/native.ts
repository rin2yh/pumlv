export interface NativeRequest {
  id: string;
  type: string;
  path?: string;
  line?: number;
}

interface NativeResponse<T> {
  id: string;
  ok: boolean;
  data?: T;
  error?: string;
}

interface NativeEvent {
  type: "tree" | "changed";
  path?: string;
}

interface NativeMessageHandler {
  postMessage(message: string): void;
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        pumlv?: NativeMessageHandler;
      };
    };
  }
}

const pending = new Map<string, (response: NativeResponse<unknown>) => void>();
let nextID = 0;
let responseListenerInstalled = false;
let readySent = false;

export function isNativeHost(): boolean {
  return location.protocol === "pumlv:";
}

export function initializeNativeBridge(): void {
  if (!isNativeHost() || readySent) return;
  const handler = window.webkit?.messageHandlers?.pumlv;
  if (!handler) throw new Error("native bridge is unavailable");
  installResponseListener();
  readySent = true;
  try {
    sendToNative(handler, JSON.stringify({ type: "ready" }));
  } catch (error) {
    readySent = false;
    throw error;
  }
}

export function subscribeNativeSelection(onSelect: (selection: string) => void): () => void {
  if (!isNativeHost()) return () => {};
  const listener = (event: Event) => {
    onSelect((event as CustomEvent<string>).detail);
  };
  window.addEventListener("pumlv:select", listener);
  try {
    initializeNativeBridge();
  } catch (error) {
    window.removeEventListener("pumlv:select", listener);
    throw error;
  }
  return () => window.removeEventListener("pumlv:select", listener);
}

export function requestNative<T>(
  type: string,
  params: { path?: string; line?: number } = {},
  signal?: AbortSignal,
): Promise<T> {
  const handler = window.webkit?.messageHandlers?.pumlv;
  if (!handler) return Promise.reject(new Error("native bridge is unavailable"));
  if (signal?.aborted) return Promise.reject(signal.reason);
  installResponseListener();
  const id = String(++nextID);
  const request: NativeRequest = { id, type, ...params };
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      pending.delete(id);
      reject(signal?.reason ?? new DOMException("aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    pending.set(id, (response) => {
      signal?.removeEventListener("abort", abort);
      if (response.ok) resolve(response.data as T);
      else reject(new Error(response.error ?? "native request failed"));
    });
    try {
      sendToNative(handler, JSON.stringify(request));
    } catch (error) {
      pending.delete(id);
      signal?.removeEventListener("abort", abort);
      reject(error);
    }
  });
}

export function subscribeNative(onEvent: (event: NativeEvent) => void): () => void {
  const listener = (event: Event) => {
    onEvent((event as CustomEvent<NativeEvent>).detail);
  };
  window.addEventListener("pumlv:server-event", listener);
  return () => window.removeEventListener("pumlv:server-event", listener);
}

function receiveResponse(event: Event): void {
  const response = (event as CustomEvent<NativeResponse<unknown>>).detail;
  const resolve = pending.get(response.id);
  if (!resolve) return;
  pending.delete(response.id);
  resolve(response);
}

function installResponseListener(): void {
  if (responseListenerInstalled) return;
  responseListenerInstalled = true;
  window.addEventListener("pumlv:response", receiveResponse);
}

function sendToNative(handler: NativeMessageHandler, message: string): void {
  handler.postMessage.bind(handler)(message);
}
