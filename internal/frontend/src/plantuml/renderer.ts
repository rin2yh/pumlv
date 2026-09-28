export async function renderPlantUML(source: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch("/api/render", { method: "POST", body: source, signal });
  if (!response.ok) throw new Error((await response.text()).trim());
  const svg = await response.text();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
