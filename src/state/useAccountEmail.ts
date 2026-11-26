import { useEffect, useState } from "react";
import { storedAccount } from "../services/supabase";

/** The signed-in account's email, or null in the demo and until it is read. */
export function useAccountEmail(demo: boolean) {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    if (!demo)
      void storedAccount()
        .then((saved) => {
          if (mounted) setEmail(saved?.email ?? null);
        })
        .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [demo]);
  return email;
}
