import { ZOOM_INPUT_LABEL } from "../zoom-controls";

export const zoomInput = (): HTMLInputElement =>
  document.querySelector<HTMLInputElement>(`input[aria-label="${ZOOM_INPUT_LABEL}"]`)!;
