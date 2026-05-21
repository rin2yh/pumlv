import { useState } from "react";

export function useToggleSet<T>(): readonly [Set<T>, (key: T) => void] {
  const [set, setSet] = useState<Set<T>>(() => new Set());
  const toggle = (key: T): void => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return [set, toggle] as const;
}
