export function splitLines(source: string): string[] {
  return source.split(/\r\n|\r|\n/);
}
