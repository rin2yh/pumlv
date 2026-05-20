import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

export interface ShikiToken {
  content: string;
  color?: string;
  fontStyle?: number;
}

export interface Highlighted {
  tokens: ShikiToken[][];
  fg: string;
  bg: string;
}

let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [import("shiki/themes/github-light.mjs")],
      langs: [import("shiki/langs/yaml.mjs")],
      engine: createOnigurumaEngine(import("shiki/wasm")),
    });
  }
  return highlighterPromise;
}

export async function highlight(source: string): Promise<Highlighted | null> {
  const highlighter = await getHighlighter();
  try {
    const result = highlighter.codeToTokens(source, {
      // PlantUML isn't a built-in shiki grammar; YAML produces
      // reasonable token coloring for arrow/keyword-like lines.
      lang: "yaml",
      theme: "github-light",
    });
    return {
      tokens: result.tokens as ShikiToken[][],
      fg: result.fg ?? "",
      bg: result.bg ?? "",
    };
  } catch {
    return null;
  }
}
