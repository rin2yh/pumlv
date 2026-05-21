import { act } from "react";

export function typeAndCommitInput(
  input: HTMLInputElement,
  value: string,
  { key = "Enter" } = {},
): void {
  act(() => {
    input.focus();
  });
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}
