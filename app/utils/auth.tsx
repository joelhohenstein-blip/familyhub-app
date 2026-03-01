import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { trpc } from './trpc';

// Client-side user type (dates are serialized to strings by tRPC)
export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: AuthUser | null;
  signIn: () => void;
  signOut: () => void;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function AuthProviderInner({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [isClient, setIsClient] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);
  const utils = trpc.useUtils();

  // Use useEffect to set isClient to true only on the client
  // This prevents hydration mismatches by ensuring server and client render the same HTML initially
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Add a timeout for auth loading (5 seconds)
  useEffect(() => {
    if (!isClient) return;
    
    const timer = setTimeout(() => {
      setAuthTimeout(true);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [isClient]);

  // Query session only on client (SSR safe)
  // IMPORTANT: This query is disabled during SSR to prevent hydration mismatches
  const sessionQuery = trpc.auth.me.useQuery(undefined, {
    enabled: isClient,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    // Suppress hydration warnings since we intentionally render different content on server vs client
    suspense: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async (data) => {
      // Set the cookie to clear
      document.cookie = data.sessionCookie;
      // Invalidate the session query
      await utils.auth.me.invalidate();
      // Redirect to login
      navigate('/login');
    },
  });

  const signIn = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  const signOut = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  const refetch = useCallback(() => {
    sessionQuery.refetch();
  }, [sessionQuery]);

  const value: AuthContextType = {
    isLoaded: isClient && (sessionQuery.data !== undefined || authTimeout),
    isSignedIn: sessionQuery.data?.isSignedIn ?? false,
    userId: sessionQuery.data?.user?.id ?? null,
    user: sessionQuery.data?.user ?? null,
    signIn,
    signOut,
    refetch,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <AuthProviderInner>{children}</AuthProviderInner>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
