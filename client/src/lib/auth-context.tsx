import { createContext, useContext, type ReactNode, type JSX } from "react";
import { authClient } from "./auth-client";

type Session = (typeof authClient.$Infer.Session) | null;
type SessionHook = ReturnType<typeof authClient.useSession>;

type AuthContextType = {
  session: Session;
  isLoading: boolean;
  isRefetching: SessionHook["isRefetching"];
  error: SessionHook["error"];
  refetch: SessionHook["refetch"];
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const { data, isPending, isRefetching, error, refetch } = authClient.useSession();

  return (
    <AuthContext.Provider
      value={{
        session: data ?? null,
        isLoading: isPending,
        isRefetching,
        error,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
