import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { splitLines } from "../../lib/lines";

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
    // Reset the cache on failure so a transient load error (e.g. WASM fetch)
    // doesn't poison every subsequent call with the same rejected promise.
    highlighterPromise = createHighlighterCore({
      themes: [import("shiki/themes/github-light.mjs")],
      langs: [import("shiki/langs/yaml.mjs")],
      engine: createOnigurumaEngine(import("shiki/wasm")),
    }).catch((e) => {
      highlighterPromise = null;
      throw e;
    });
  }
  return highlighterPromise;
}

export async function highlight(source: string): Promise<Highlighted | null> {
  try {
    const highlighter = await getHighlighter();
    const result = highlighter.codeToTokens(source, {
      // PlantUML isn't a built-in shiki grammar; YAML produces
      // reasonable token coloring for arrow/keyword-like lines.
      lang: "yaml",
      theme: "github-light",
    });
    const tokens = (result.tokens as ShikiToken[][]).slice();
    const lineCount = splitLines(source).length;
    while (tokens.length < lineCount) tokens.push([{ content: "" }]);
    return {
      tokens,
      fg: result.fg ?? "",
      bg: result.bg ?? "",
    };
  } catch {
    return null;
  }
}
