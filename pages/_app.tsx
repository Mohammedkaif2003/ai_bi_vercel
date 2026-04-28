import type { AppProps } from "next/app";
import "../styles/globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

import { Toaster } from "sonner";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors theme="dark" />
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
