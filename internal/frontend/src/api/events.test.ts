import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { subscribe, type ServerEvent } from "./events";

type Listener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  readonly listeners = new Map<string, Set<Listener>>();
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data?: unknown): void {
    const set = this.listeners.get(type);
    if (!set) return;
    const payload = data === undefined ? "" : JSON.stringify(data);
    const event = new MessageEvent(type, { data: payload });
    for (const listener of set) {
      listener(event);
    }
  }
}

const originalEventSource = globalThis.EventSource;

beforeEach(() => {
  MockEventSource.instances = [];
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
});

afterEach(() => {
  (globalThis as unknown as { EventSource: typeof EventSource }).EventSource = originalEventSource;
});

describe("subscribe", () => {
  it("connects to /api/events", () => {
    const cleanup = subscribe(() => {});
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]!.url).toBe("/api/events");
    cleanup();
  });

  it("dispatches 'changed' with the parsed path", () => {
    const seen: ServerEvent[] = [];
    const cleanup = subscribe((ev) => seen.push(ev));

    MockEventSource.instances[0]!.emit("changed", { path: "/tmp/a.puml" });

    expect(seen).toEqual([{ type: "changed", path: "/tmp/a.puml" }]);
    cleanup();
  });

  it("dispatches 'tree' without payload", () => {
    const seen: ServerEvent[] = [];
    const cleanup = subscribe((ev) => seen.push(ev));

    MockEventSource.instances[0]!.emit("tree");

    expect(seen).toEqual([{ type: "tree" }]);
    cleanup();
  });

  it("dispatches 'hello' on connect", () => {
    const seen: ServerEvent[] = [];
    const cleanup = subscribe((ev) => seen.push(ev));

    MockEventSource.instances[0]!.emit("hello");

    expect(seen).toEqual([{ type: "hello" }]);
    cleanup();
  });

  it("dispatches multiple events in arrival order", () => {
    const seen: ServerEvent[] = [];
    const cleanup = subscribe((ev) => seen.push(ev));

    const src = MockEventSource.instances[0]!;
    src.emit("hello");
    src.emit("changed", { path: "/p/a.puml" });
    src.emit("tree");

    expect(seen).toEqual([
      { type: "hello" },
      { type: "changed", path: "/p/a.puml" },
      { type: "tree" },
    ]);
    cleanup();
  });

  it("returns a cleanup that closes the EventSource", () => {
    const cleanup = subscribe(() => {});
    expect(MockEventSource.instances[0]!.closed).toBe(false);
    cleanup();
    expect(MockEventSource.instances[0]!.closed).toBe(true);
  });

  it("throws on malformed 'changed' payload", () => {
    const cleanup = subscribe(() => {});
    const src = MockEventSource.instances[0]!;
    const listener = [...src.listeners.get("changed")!][0]!;
    expect(() => listener(new MessageEvent("changed", { data: "not json" }))).toThrow();
    cleanup();
  });
});
