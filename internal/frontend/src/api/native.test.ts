import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let native: typeof import("./native");
let responseListeners: EventListenerOrEventListenerObject[];

function installHandler() {
  const postMessage = vi.fn((_message: string) => {});
  const handler = { postMessage };
  window.webkit = { messageHandlers: { pumlv: handler } };
  return { handler, postMessage };
}

function setProtocol(protocol: string): void {
  vi.stubGlobal("location", { protocol } as Location);
}

function respond(id: string, response: { ok: boolean; data?: unknown; error?: string }): void {
  window.dispatchEvent(new CustomEvent("pumlv:response", { detail: { id, ...response } }));
}

beforeEach(async () => {
  responseListeners = [];
  const addEventListener = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation((type, listener, options) => {
    if (type === "pumlv:response") responseListeners.push(listener);
    addEventListener(type, listener, options);
  });
  vi.resetModules();
  native = await import("./native");
  delete window.webkit;
});

afterEach(() => {
  for (const listener of responseListeners) {
    window.removeEventListener("pumlv:response", listener);
  }
  delete window.webkit;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isNativeHost", () => {
  it.each([
    { protocol: "https:", expected: false },
    { protocol: "pumlv:", expected: true },
  ])("returns $expected for $protocol URLs", ({ protocol, expected }) => {
    setProtocol(protocol);
    expect(native.isNativeHost()).toBe(expected);
  });
});

describe("initializeNativeBridge", () => {
  it("does nothing in a browser", () => {
    expect(() => native.initializeNativeBridge()).not.toThrow();
  });

  it("requires a handler and sends the ready message once", () => {
    setProtocol("pumlv:");
    expect(() => native.initializeNativeBridge()).toThrow("native bridge is unavailable");

    const { postMessage } = installHandler();
    native.initializeNativeBridge();
    native.initializeNativeBridge();

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(postMessage.mock.calls[0]![0]!)).toEqual({ type: "ready" });
  });

  it("retries ready after postMessage fails", () => {
    setProtocol("pumlv:");
    const { postMessage } = installHandler();
    const failure = new Error("send failed");
    postMessage.mockImplementationOnce(() => {
      throw failure;
    });

    expect(() => native.initializeNativeBridge()).toThrow(failure);
    native.initializeNativeBridge();
    native.initializeNativeBridge();

    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(JSON.parse(postMessage.mock.calls[1]![0]!)).toEqual({ type: "ready" });
  });
});

describe("requestNative", () => {
  it("rejects when the native message handler is missing", async () => {
    await expect(native.requestNative("files")).rejects.toThrow("native bridge is unavailable");
  });

  it("sends a request and resolves its matching response", async () => {
    const { postMessage } = installHandler();
    const result = native.requestNative<string>("file", { path: "/tmp/diagram.puml", line: 12 });
    const [message] = postMessage.mock.calls[0]!;
    const request = JSON.parse(message!);

    expect(request).toMatchObject({
      type: "file",
      path: "/tmp/diagram.puml",
      line: 12,
    });
    expect(request.id).toMatch(/^\d+$/);

    respond("unrelated-request", { ok: true, data: "ignored" });
    respond(request.id, { ok: true, data: "@startuml\n@enduml" });

    await expect(result).resolves.toBe("@startuml\n@enduml");
  });

  it.each([
    {
      description: "the native error",
      response: { ok: false, error: "file list failed" },
      message: "file list failed",
    },
    {
      description: "a fallback for an empty error",
      response: { ok: false },
      message: "native request failed",
    },
  ])("rejects with $description", async ({ response, message }) => {
    const { postMessage } = installHandler();
    const result = native.requestNative("files");
    const request = JSON.parse(postMessage.mock.calls[0]![0]!);

    respond(request.id, response);

    await expect(result).rejects.toThrow(message);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const { postMessage } = installHandler();
    const controller = new AbortController();
    const reason = new Error("cancelled before send");
    controller.abort(reason);

    await expect(native.requestNative("file", {}, controller.signal)).rejects.toBe(reason);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("rejects an in-flight request when the signal aborts", async () => {
    const { postMessage } = installHandler();
    const controller = new AbortController();
    const result = native.requestNative("file", { path: "/tmp/diagram.puml" }, controller.signal);
    const request = JSON.parse(postMessage.mock.calls[0]![0]!);
    const reason = new Error("request cancelled");
    const rejection = expect(result).rejects.toBe(reason);

    controller.abort(reason);
    respond(request.id, { ok: true, data: "late response" });

    await rejection;
  });

  it("removes the pending request and abort listener when sending fails", async () => {
    const { postMessage } = installHandler();
    const failure = new Error("send failed");
    postMessage.mockImplementationOnce(() => {
      throw failure;
    });
    const controller = new AbortController();
    const removeEventListener = vi.spyOn(controller.signal, "removeEventListener");

    await expect(native.requestNative("files", {}, controller.signal)).rejects.toBe(failure);

    const request = JSON.parse(postMessage.mock.calls[0]![0]!);
    expect(removeEventListener).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(responseListeners).toHaveLength(1);
    respond(request.id, { ok: true, data: "late response" });
    controller.abort();
  });
});

describe("subscribeNative", () => {
  it("forwards native server events and stops after cleanup", () => {
    const onEvent = vi.fn();
    const unsubscribe = native.subscribeNative(onEvent);
    const event = { type: "changed", path: "/tmp/diagram.puml" } as const;

    window.dispatchEvent(new CustomEvent("pumlv:server-event", { detail: event }));
    expect(onEvent).toHaveBeenCalledExactlyOnceWith(event);

    unsubscribe();
    window.dispatchEvent(new CustomEvent("pumlv:server-event", { detail: event }));
    expect(onEvent).toHaveBeenCalledOnce();
  });
});

describe("subscribeNativeSelection", () => {
  it("forwards selections and removes its listener during cleanup", () => {
    setProtocol("pumlv:");
    const { postMessage } = installHandler();
    const onSelect = vi.fn();
    const unsubscribe = native.subscribeNativeSelection(onSelect);
    const selection = "markdown:%2Ftmp%2Fdiagrams.md:8";

    expect(JSON.parse(postMessage.mock.calls[0]![0]!)).toEqual({ type: "ready" });

    window.dispatchEvent(new CustomEvent("pumlv:select", { detail: selection }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(selection);

    unsubscribe();
    window.dispatchEvent(new CustomEvent("pumlv:select", { detail: "/other.puml" }));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
