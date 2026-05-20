import { act, useState, type JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { subscribe, type EventHandler, type ServerEvent } from "../api/events";
import { setupRender } from "../test/render";
import { useServerEvents } from "./useServerEvents";

vi.mock("../api/events", () => ({
  subscribe: vi.fn(),
}));

const mockedSubscribe = vi.mocked(subscribe);

interface SubscribeRecord {
  handler: EventHandler;
  cleanup: ReturnType<typeof vi.fn>;
}

let subscriptions: SubscribeRecord[];

function Probe(props: { onTree: () => void; onChanged: (path: string) => void }): JSX.Element {
  useServerEvents({ onTree: props.onTree, onChanged: props.onChanged });
  return <div />;
}

let capturedSetActive: (path: string | null) => void;
let changedForActive: number;

function StatefulProbe(): JSX.Element {
  const [active, setActive] = useState<string | null>("/a.puml");
  capturedSetActive = setActive;
  useServerEvents({
    onTree: () => {},
    onChanged: (path) => {
      if (path === active) changedForActive++;
    },
  });
  return <div />;
}

const render = setupRender();

beforeEach(() => {
  subscriptions = [];
  changedForActive = 0;
  vi.clearAllMocks();
  mockedSubscribe.mockImplementation((handler: EventHandler) => {
    const cleanup = vi.fn();
    subscriptions.push({ handler, cleanup });
    return cleanup;
  });
});

afterEach(() => {
  subscriptions = [];
});

const emit = (ev: ServerEvent): void => {
  act(() => {
    subscriptions[0]!.handler(ev);
  });
};

describe("useServerEvents", () => {
  it("subscribes exactly once on mount", () => {
    render(<Probe onTree={() => {}} onChanged={() => {}} />);
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
    render(<Probe onTree={onTree} onChanged={onChanged} />);

    emit(event);

    expect(onTree).toHaveBeenCalledTimes(treeCalls);
    expect(onChanged.mock.calls.flat()).toEqual(changedArgs);
  });

  it("does not resubscribe when handler identities change between renders", () => {
    const onTreeA = vi.fn();
    const onTreeB = vi.fn();
    render(<Probe onTree={onTreeA} onChanged={() => {}} />);
    render(<Probe onTree={onTreeB} onChanged={() => {}} />);

    expect(mockedSubscribe).toHaveBeenCalledTimes(1);

    emit({ type: "tree" });
    expect(onTreeA).not.toHaveBeenCalled();
    expect(onTreeB).toHaveBeenCalledTimes(1);
  });

  it("calls the latest onChanged after re-render", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(<Probe onTree={() => {}} onChanged={first} />);
    render(<Probe onTree={() => {}} onChanged={second} />);

    emit({ type: "changed", path: "/x.puml" });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("/x.puml");
  });

  it("sees updated closure values through the ref (active path swap)", () => {
    render(<StatefulProbe />);

    emit({ type: "changed", path: "/a.puml" });
    expect(changedForActive).toBe(1);

    act(() => capturedSetActive("/b.puml"));

    emit({ type: "changed", path: "/a.puml" });
    expect(changedForActive).toBe(1);

    emit({ type: "changed", path: "/b.puml" });
    expect(changedForActive).toBe(2);
  });

  it("invokes the cleanup returned by subscribe on unmount", () => {
    render(<Probe onTree={() => {}} onChanged={() => {}} />);
    expect(subscriptions[0]!.cleanup).not.toHaveBeenCalled();

    render(<div />);
    expect(subscriptions[0]!.cleanup).toHaveBeenCalledTimes(1);
  });
});
