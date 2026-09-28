// The TeaVM renderer draws SVG into a DOM and uses canvas to measure text.
// linkedom supplies SVG nodes; hostMeasureText supplies font metrics from Go.
import { parseHTML, DOMParser } from "linkedom";

const { document } = parseHTML("<html><head></head><body></body></html>");
globalThis.document = document;
globalThis.window = globalThis;
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = class {
  serializeToString(node) {
    // linkedom has no processing-instruction node. Our createProcessingInstruction
    // below uses a comment placeholder; serialize it as a real XML instruction.
    // PlantUML's encoded source may contain "--", which is illegal in a comment.
    return node.toString().replace(/<!--\?([\w-]+) (.*?)\?-->/g, "<?$1 $2?>");
  }
};

const createElement = document.createElement.bind(document);
document.createElement = (tag) => {
  if (tag === "canvas") {
    return {
      getContext: () => ({
        font: "12px sans-serif",
        measureText(value) {
          const size = Number(this.font.match(/([\d.]+)px/)?.[1] ?? 12);
          return {
            width: hostMeasureText(value, this.font),
            actualBoundingBoxAscent: size * 0.8,
            actualBoundingBoxDescent: size * 0.2,
            fontBoundingBoxAscent: size * 0.8,
            fontBoundingBoxDescent: size * 0.2,
          };
        },
      }),
    };
  }
  return createElement(tag);
};

const svgText = document.createElementNS("http://www.w3.org/2000/svg", "text");
Object.getPrototypeOf(svgText).getBBox = function () {
  const size = Number(this.getAttribute("font-size") ?? 12);
  return {
    width: hostMeasureText(this.textContent ?? "", `${size}px sans-serif`),
    height: size,
    x: 0,
    y: -size * 0.8,
  };
};
document.createProcessingInstruction = (target, data) =>
  document.createComment(`?${target} ${data}?`);
