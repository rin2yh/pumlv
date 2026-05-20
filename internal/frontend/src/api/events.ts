export type ServerEvent = { type: "changed"; path: string } | { type: "tree" } | { type: "hello" };

export type EventHandler = (ev: ServerEvent) => void;

export function subscribe(onEvent: EventHandler): () => void {
  const source = new EventSource("/api/events");
  source.addEventListener("changed", (e) => {
    const data = JSON.parse((e as MessageEvent).data) as { path: string };
    onEvent({ type: "changed", path: data.path });
  });
  source.addEventListener("tree", () => {
    onEvent({ type: "tree" });
  });
  source.addEventListener("hello", () => {
    onEvent({ type: "hello" });
  });
  return () => source.close();
}
