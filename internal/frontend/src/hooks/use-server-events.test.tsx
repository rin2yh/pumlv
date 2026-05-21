import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { subscribe, type EventHandler, type ServerEvent } from "../api/events";
import { useServerEvents } from "./use-server-events";

vi.mock("../api/events", () => ({
  subscribe: vi.fn(),
}));

const mockedSubscribe = vi.mocked(subscribe);

interface SubscribeRecord {
  handler: EventHandler;
  cleanup: ReturnType<typeof vi.fn>;
}

let subscriptions: SubscribeRecord[];

interface ProbeProps {
  onTree: () => void;
  onChanged: (path: string) => void;
}

const renderProbe = (props: ProbeProps) =>
  renderHook(({ onTree, onChanged }: ProbeProps) => useServerEvents({ onTree, onChanged }), {
    initialProps: props,
  });

beforeEach(() => {
  subscriptions = [];
  vi.clearAllMocks();
  mockedSubscribe.mockImplementation((handler: EventHandler) => {
    const cleanup = vi.fn();
    subscriptions.push({ handler, cleanup });
    return cleanup;
  });
});

const emit = (ev: ServerEvent): void => {
  act(() => {
    subscriptions[0]!.handler(ev);
  });
};

describe("useServerEvents", () => {
  it("subscribes exactly once on mount", () => {
    renderProbe({ onTree: () => {}, onChanged: () => {} });
    expect(mockedSubscribe).toHaveBeenCalledTimes(1);
    expect(subscriptions).toHaveLength(1);
  });

  it.each<{ name: string; event: ServerEvent; treeCalls: number; changedArgs: string[] }>([
    { name: "tree -> onTree()", event: { type: "tree" }, treeCalls: 1, changedArgs: [] },
    {
      name: "changed -> onChanged(path)",
      event: { type: "changed", path: "/a.puml" },
      treeCalls: 0,
      changedArgs: ["/a.puml"],
    },
    { name: "hello -> noop", event: { type: "hello" }, treeCalls: 0, changedArgs: [] },
  ])("routes $name", ({ event, treeCalls, changedArgs }) => {
    const onTree = vi.fn();
    const onChanged = vi.fn();
    renderProbe({ onTree, onChanged });

    emit(event);

    expect(onTree).toHaveBeenCalledTimes(treeCalls);
    expect(onChanged.mock.calls.flat()).toEqual(changedArgs);
  });

  it("does not resubscribe when handler identities change between renders", () => {
    const onTreeA = vi.fn();
    const onTreeB = vi.fn();
    const { rerender } = renderProbe({ onTree: onTreeA, onChanged: () => {} });
    rerender({ onTree: onTreeB, onChanged: () => {} });

    expect(mockedSubscribe).toHaveBeenCalledTimes(1);

    emit({ type: "tree" });
    expect(onTreeA).not.toHaveBeenCalled();
    expect(onTreeB).toHaveBeenCalledTimes(1);
  });

  it("calls the latest onChanged after re-render", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderProbe({ onTree: () => {}, onChanged: first });
    rerender({ onTree: () => {}, onChanged: second });

    emit({ type: "changed", path: "/x.puml" });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("/x.puml");
  });

  it("sees updated closure values through the ref (active path swap)", () => {
    const { result } = renderHook(() => {
      const [active, setActive] = useState<string | null>("/a.puml");
      const changedForActive = useRef(0);
      useServerEvents({
        onTree: () => {},
        onChanged: (path) => {
          if (path === active) changedForActive.current++;
        },
      });
      return { setActive, changedForActive };
    });

    emit({ type: "changed", path: "/a.puml" });
    expect(result.current.changedForActive.current).toBe(1);

    act(() => result.current.setActive("/b.puml"));

    emit({ type: "changed", path: "/a.puml" });
    expect(result.current.changedForActive.current).toBe(1);

    emit({ type: "changed", path: "/b.puml" });
    expect(result.current.changedForActive.current).toBe(2);
  });

  it("invokes the cleanup returned by subscribe on unmount", () => {
    const { unmount } = renderProbe({ onTree: () => {}, onChanged: () => {} });
    expect(subscriptions[0]!.cleanup).not.toHaveBeenCalled();

    unmount();
    expect(subscriptions[0]!.cleanup).toHaveBeenCalledTimes(1);
  });
});
