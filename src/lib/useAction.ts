import { useCallback, useState } from 'react';

import { ApiError } from '../api/client';
import { useToast } from '../components/ui';

/**
 * Wraps a mutation: busy flag, success toast, error toast, and server field
 * errors (for forms). Returns the result or undefined on failure.
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(true);
      setFields({});
      try {
        const result = await fn();
        if (success) toast(success);
        return result;
      } catch (err) {
        if (err instanceof ApiError) {
          setFields(err.fields);
          toast(err.message, 'error');
        } else {
          toast('Something went wrong', 'error');
        }
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  return { run, busy, fields };
}
