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

function Harness(props: { onTree: () => void; onChanged: (path: string) => void }): JSX.Element {
  useServerEvents({ onTree: props.onTree, onChanged: props.onChanged });
  return <div />;
}

let capturedSetActive: (path: string | null) => void;
let changedForActive: number;

function RebindHarness(): JSX.Element {
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
    render(<Harness onTree={() => {}} onChanged={() => {}} />);
    expect(mockedSubscribe).toHaveBeenCalledTimes(1);
    expect(subscriptions).toHaveLength(1);
  });

  it("invokes onTree for tree events", () => {
    const onTree = vi.fn();
    render(<Harness onTree={onTree} onChanged={() => {}} />);

    emit({ type: "tree" });
    expect(onTree).toHaveBeenCalledTimes(1);
  });

  it("invokes onChanged with the changed path", () => {
    const onChanged = vi.fn();
    render(<Harness onTree={() => {}} onChanged={onChanged} />);

    emit({ type: "changed", path: "/a.puml" });
    expect(onChanged).toHaveBeenCalledWith("/a.puml");
  });

  it("ignores hello events", () => {
    const onTree = vi.fn();
    const onChanged = vi.fn();
    render(<Harness onTree={onTree} onChanged={onChanged} />);

    emit({ type: "hello" });
    expect(onTree).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("does not resubscribe when handler identities change between renders", () => {
    const onTreeA = vi.fn();
    const onTreeB = vi.fn();
    render(<Harness onTree={onTreeA} onChanged={() => {}} />);
    render(<Harness onTree={onTreeB} onChanged={() => {}} />);

    expect(mockedSubscribe).toHaveBeenCalledTimes(1);

    emit({ type: "tree" });
    expect(onTreeA).not.toHaveBeenCalled();
    expect(onTreeB).toHaveBeenCalledTimes(1);
  });

  it("calls the latest onChanged after re-render", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(<Harness onTree={() => {}} onChanged={first} />);
    render(<Harness onTree={() => {}} onChanged={second} />);

    emit({ type: "changed", path: "/x.puml" });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("/x.puml");
  });

  it("sees updated closure values through the ref (active path swap)", () => {
    render(<RebindHarness />);

    emit({ type: "changed", path: "/a.puml" });
    expect(changedForActive).toBe(1);

    act(() => capturedSetActive("/b.puml"));

    emit({ type: "changed", path: "/a.puml" });
    expect(changedForActive).toBe(1);

    emit({ type: "changed", path: "/b.puml" });
    expect(changedForActive).toBe(2);
  });

  it("invokes the cleanup returned by subscribe on unmount", () => {
    render(<Harness onTree={() => {}} onChanged={() => {}} />);
    expect(subscriptions[0]!.cleanup).not.toHaveBeenCalled();

    render(<div />);
    expect(subscriptions[0]!.cleanup).toHaveBeenCalledTimes(1);
  });
});
