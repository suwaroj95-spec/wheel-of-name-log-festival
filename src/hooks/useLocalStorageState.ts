import { useEffect, useState } from 'react';

export function useLocalStorageState<T>(key: string, initialState: T): [T, (next: T | ((current: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    const stored = window.localStorage.getItem(key);
    if (!stored) return initialState;
    try {
      return { ...initialState, ...JSON.parse(stored) } as T;
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}
