import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "./auth-client";

type Session = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
} | null;

type AuthContextType = {
  session: Session;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isLoading } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await authClient.getSession();
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  return (
    <AuthContext.Provider value={{ session: session || null, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
