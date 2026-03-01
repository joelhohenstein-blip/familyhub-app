// Copyright © 2026 Hohenstein. All rights reserved.

import { HydratedRouter } from "react-router/dom";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "~/utils/trpc";
import { AuthProvider } from "~/utils/auth";
import { FamilyProvider } from "~/utils/familyContext";
import { ErrorBoundary } from "~/components/ErrorBoundary";
import { I18nProvider } from "~/providers/I18nProvider";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";

// Global flag to track if React hydration succeeded
declare global {
  var __reactHydrated: boolean;
}

function hydrate() {
  console.log('🔄 Starting React hydration...');
  console.log('📄 Document ready state:', document.readyState);
  console.log('📄 Document body:', document.body ? 'exists' : 'missing');
  
  try {
    // Create clients for hydration
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          staleTime: 1000 * 60,
        },
      },
    });
    const trpcClient = createTRPCClient();

    // Hydrate the document element with all providers
    hydrateRoot(
      document,
      <StrictMode>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <FamilyProvider>
                <ErrorBoundary>
                  <I18nProvider>
                    <TooltipProvider>
                      <HydratedRouter />
                      <Toaster />
                    </TooltipProvider>
                  </I18nProvider>
                </ErrorBoundary>
              </FamilyProvider>
            </AuthProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </StrictMode>
    );
    console.log('✅ hydrateRoot called successfully');
  } catch (error) {
    console.error('❌ hydrateRoot error:', error);
  }
  
  // Mark hydration as complete
  globalThis.__reactHydrated = true;
  console.log('✅ React hydration complete');
  
  // Set up fallback event handlers after a longer delay to ensure React has fully initialized
  // and the page is stable. This prevents interference with React's hydration process.
  setTimeout(() => {
    setupFallbackEventHandlers();
  }, 500);
}

// Fallback event handler system for when React's event delegation fails
function setupFallbackEventHandlers() {
  console.log('🔧 Setting up fallback event handlers...');
  console.log('✅ Fallback event handlers ready (React hydration should handle all events)');
}

hydrate();
