"use client";

import { useEffect, useState } from "react";
import { createDebouncedTask } from "@/lib/marketplace/debounce";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const task = createDebouncedTask(setDebouncedValue, delayMs);
    task.schedule(value);
    return task.cancel;
  }, [delayMs, value]);

  return debouncedValue;
}
