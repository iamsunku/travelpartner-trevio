"use client";

import { useCallback, useRef, useState } from "react";

/** Prevents duplicate concurrent form submissions. */
export function useSubmitLock() {
  const lockRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const runSubmit = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lockRef.current) return undefined;
    lockRef.current = true;
    setSubmitting(true);
    try {
      return await fn();
    } finally {
      lockRef.current = false;
      setSubmitting(false);
    }
  }, []);

  return { submitting, runSubmit };
}
