import type { AppProps } from "next/app";
import "../styles/globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

import { Toaster } from "sonner";

import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.push("/login#type=recovery");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors theme="dark" />
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
