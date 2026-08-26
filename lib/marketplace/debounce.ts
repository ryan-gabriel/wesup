export interface DebouncedTask<T> {
  schedule(value: T): void;
  cancel(): void;
}

export function createDebouncedTask<T>(
  callback: (value: T) => void,
  delayMs: number,
): DebouncedTask<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return {
    schedule(value) {
      cancel();
      timeoutId = setTimeout(() => {
        timeoutId = null;
        callback(value);
      }, delayMs);
    },
    cancel,
  };
}
