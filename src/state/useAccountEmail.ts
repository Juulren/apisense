import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

/** The signed-in account's email, or null in the demo and until it is read. */
export function useAccountEmail(demo: boolean) {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    if (!demo && supabase)
      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (mounted) setEmail(data.session?.user.email ?? null);
        })
        .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [demo]);
  return email;
}
