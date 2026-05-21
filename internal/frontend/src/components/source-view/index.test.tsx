import { describe, expect, it } from "vitest";
import { act } from "react";
import { SourceView } from "./index";
import { setupRender } from "../../test/render";
import { flush } from "../../test/flush";
import { FOLD_LABEL, UNFOLD_LABEL } from "./source-fold";

const render = setupRender();

function findFoldToggle(): HTMLButtonElement {
  return document.querySelector(
    `button[aria-label="${FOLD_LABEL}"], button[aria-label="${UNFOLD_LABEL}"]`,
  ) as HTMLButtonElement;
}

describe("SourceView", () => {
  it("shows 'no source' for an empty string", () => {
    render(<SourceView source="" />);
    expect(document.body.textContent).toContain("no source");
    expect(document.querySelector("pre")).toBeNull();
  });

  it("renders one line per source line", async () => {
    render(<SourceView source={"@startuml\n@enduml\n"} />);
    await flush(3);
    expect(document.body.textContent).toContain("@startuml");
    expect(document.body.textContent).toContain("@enduml");
  });

  it("does not interpret source content as HTML (XSS-safe rendering)", async () => {
    render(<SourceView source={"<script>alert(1)</script>"} />);
    await flush(3);

    const pre = document.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toContain("<script>alert(1)</script>");
    expect(pre!.querySelector("script")).toBeNull();
  });

  it("clears highlighted output when source becomes empty", async () => {
    render(<SourceView source="hello" />);
    await flush(3);
    expect(document.body.textContent).toContain("hello");

    render(<SourceView source="" />);
    expect(document.body.textContent).toContain("no source");
  });

  describe("folding", () => {
    const source = ["class A {", "  field1", "  field2", "}", "class B"].join("\n");

    it("renders a fold toggle on the opening brace line", async () => {
      render(<SourceView source={source} />);
      await flush(3);

      const buttons = document.querySelectorAll(`button[aria-label="${FOLD_LABEL}"]`);
      expect(buttons.length).toBe(1);
      expect(buttons[0].getAttribute("aria-expanded")).toBe("true");
    });

    it("hides the block body after clicking the toggle", async () => {
      render(<SourceView source={source} />);
      await flush(3);

      const button = document.querySelector(
        `button[aria-label="${FOLD_LABEL}"]`,
      ) as HTMLButtonElement;
      expect(button).not.toBeNull();

      act(() => {
        button.click();
      });

      expect(document.body.textContent).not.toContain("field1");
      expect(document.body.textContent).not.toContain("field2");
      expect(document.body.textContent).toContain("class A {");
      expect(document.body.textContent).toContain("class B");

      const unfoldBtn = document.querySelector(
        `button[aria-label="${UNFOLD_LABEL}"]`,
      ) as HTMLButtonElement;
      expect(unfoldBtn).not.toBeNull();
      expect(unfoldBtn.getAttribute("aria-expanded")).toBe("false");
    });

    it("re-shows the block body after toggling back", async () => {
      render(<SourceView source={source} />);
      await flush(3);

      act(() => findFoldToggle().click());
      act(() => findFoldToggle().click());

      expect(document.body.textContent).toContain("field1");
      expect(document.body.textContent).toContain("field2");
    });

    it("does not show a fold toggle on lines without a brace block", async () => {
      render(<SourceView source={"@startuml\nactor User\n@enduml\n"} />);
      await flush(3);

      expect(document.querySelector(`button[aria-label="${FOLD_LABEL}"]`)).toBeNull();
    });
  });
});
