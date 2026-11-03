import { useRef, useState } from "react";
export function useTask() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>, success?: string) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (success) setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return { busy, message, run, setMessage };
}
