import { useCallback, useEffect, useRef, useState } from "react";

/** Serialize navigation/submission and discard results for edited or unmounted forms. */
export function useFormOperation(onError: () => void) {
  const version = useRef(0);
  const active = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const invalidate = useCallback(() => {
    version.current += 1;
  }, []);
  useEffect(() => invalidate, [invalidate]);

  const run = useCallback(
    async (action: (isCurrent: () => boolean) => Promise<void>) => {
      if (active.current) {
        return;
      }
      active.current = true;
      const request = version.current;
      const isCurrent = () => request === version.current;
      setIsPending(true);
      try {
        await action(isCurrent);
      } catch {
        if (isCurrent()) {
          onError();
        }
      } finally {
        active.current = false;
        setIsPending(false);
      }
    },
    [onError]
  );

  return { invalidate, isPending, run };
}
