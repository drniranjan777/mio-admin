import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, type Meta } from '../api/client';

export interface Loaded<T> {
  data: T | null;
  meta?: Meta;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads data whenever `deps` change; ignores stale responses so fast filter
 * changes never show an older result.
 */
export function useApi<T>(load: () => Promise<{ data: T; meta?: Meta }>, deps: unknown[]): Loaded<T> {
  const [state, setState] = useState<{ data: T | null; meta?: Meta; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((res) => {
        if (mine === seq.current) setState({ data: res.data, meta: res.meta, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (mine === seq.current) {
          setState((s) => ({ ...s, loading: false, error: err instanceof ApiError ? err.message : 'Something went wrong' }));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
