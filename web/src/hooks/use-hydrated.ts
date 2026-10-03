import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useClientValue<T>(read: () => T): T | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function useHydrated(): boolean {
  return useClientValue(() => true) ?? false;
}
