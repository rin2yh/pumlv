import { act } from "react";

export async function flush(ticks = 1): Promise<void> {
  await act(async () => {
    for (let i = 0; i < ticks; i++) {
      await Promise.resolve();
    }
  });
}
