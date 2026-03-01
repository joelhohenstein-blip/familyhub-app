// Copyright © 2026 Hohenstein. All rights reserved.

import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { LinksFunction } from "react-router";
import { useState, useEffect } from "react";

import "./tailwind.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient, createSSRClient } from "./utils/trpc";
import { Watermark } from "./watermark";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider } from "./utils/auth";
import { FamilyProvider } from "./utils/familyContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { I18nProvider } from "./providers/I18nProvider";
import { Toaster } from "./components/ui/sonner";
import { initSentryClient } from "./utils/sentry.client";

// Initialize Sentry on client
if (typeof window !== "undefined") {
  initSentryClient();
}

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ScrollRestoration />
        <Scripts />
        <Watermark />
      </body>
    </html>
  );
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60,
      },
    },
  }));

  const [trpcClient] = useState(() =>
    typeof window !== 'undefined' ? createTRPCClient() : createSSRClient()
  );

  return (
    <ErrorBoundary>
      <I18nProvider>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <FamilyProvider>
                <TooltipProvider>
                  <Outlet />
                </TooltipProvider>
              </FamilyProvider>
            </AuthProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </I18nProvider>
      <Toaster />
    </ErrorBoundary>
  );
}
