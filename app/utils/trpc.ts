import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink, splitLink, createWSClient, wsLink } from '@trpc/client';
import type { AppRouter } from '../server/trpc/root';

// Store the original fetch before React Router can intercept it
let originalFetch: typeof fetch | undefined;
if (typeof globalThis !== 'undefined') {
  originalFetch = globalThis.fetch;
}

// Create the tRPC React hooks
export const trpc = createTRPCReact<AppRouter>();

// NOTE: For server-side usage in loaders/actions, use callTrpc() from '~/utils/trpc.server'
// It uses direct RPC calls (no HTTP overhead) - see trpc.server.ts

// SSR-safe client (HTTP only, no WebSocket)
// Used during SSR so the provider is always available
// NOTE: This client is only used for the provider wrapper during SSR
// Actual server-side tRPC calls should use callTrpc() from trpc.server.ts
export function createSSRClient() {
  // Use absolute URL for SSR to avoid React Router fetch interception
  const httpUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}/api/trpc`
    : 'http://localhost:3000/api/trpc';
  
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: httpUrl,
        // Send credentials (cookies) with requests
        credentials: 'include',
      }),
    ],
  });
}

// Client-side tRPC client factory with WebSocket support
export function createTRPCClient() {
  const host = typeof window !== 'undefined' 
    ? window.location.host 
    : 'localhost:3000';
  
  const isHttps = typeof window !== 'undefined' 
    ? window.location.protocol === 'https:'
    : false;
  
  // Use relative URL with explicit /api prefix to avoid React Router interception
  // IMPORTANT: Must use /api/trpc, not just /trpc
  const httpUrl = '/api/trpc';
  
  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('🔗 tRPC HTTP URL:', httpUrl);
    console.log('📍 Current location:', window.location.href);
  }
  
  // WebSocket URL - use ingress proxy path for external, direct for local dev
  const wsUrl = typeof window !== 'undefined'
    ? `${isHttps ? 'wss' : 'ws'}://${host}/api/ws` // Use ingress proxy path
    : 'ws://localhost:3002'; // Direct to WS server for local dev
  
  // Debug logging for WebSocket URL
  if (typeof window !== 'undefined') {
    console.log('🔌 tRPC WebSocket URL:', wsUrl);
    console.log('📍 Current host:', host);
    console.log('🔒 Is HTTPS:', isHttps);
  }
  
  const wsClient = createWSClient({
    url: wsUrl,
    onOpen() {
      console.log('✅ tRPC WebSocket connected successfully');
    },
    onClose() {
      console.log('❌ tRPC WebSocket connection closed');
    },
  });
  
  return trpc.createClient({
    links: [
      splitLink({
        condition(op) {
          // Use WebSocket for subscriptions, HTTP for queries/mutations
          return op.type === 'subscription';
        },
        true: wsLink({
          client: wsClient,
        }),
        false: httpBatchLink({
          url: httpUrl,
          // Use the original fetch to bypass React Router's fetch interception
          fetch: originalFetch || globalThis.fetch,
          // Send credentials (cookies) with requests
          credentials: 'include',
        }),
      }),
    ],
  });
}