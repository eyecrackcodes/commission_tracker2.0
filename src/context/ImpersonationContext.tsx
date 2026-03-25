"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";

interface ImpersonationState {
  isImpersonating: boolean;
  impersonatedUserId: string | null;
  impersonatedUserName: string | null;
  isAdmin: boolean;
  isLoading: boolean;
}

interface ImpersonationContextType extends ImpersonationState {
  startImpersonation: (userId: string, userName: string) => void;
  stopImpersonation: () => void;
  effectiveUserId: string | null;
}

const ImpersonationContext = createContext<ImpersonationContextType | null>(
  null
);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [state, setState] = useState<ImpersonationState>({
    isImpersonating: false,
    impersonatedUserId: null,
    impersonatedUserName: null,
    isAdmin: false,
    isLoading: true,
  });

  useEffect(() => {
    if (!user) return;

    const checkAdminStatus = async () => {
      try {
        const res = await fetch("/api/admin/check");
        if (res.ok) {
          const data = await res.json();
          setState((prev) => ({
            ...prev,
            isAdmin: data.isAdmin,
            isLoading: false,
          }));
        } else {
          setState((prev) => ({ ...prev, isAdmin: false, isLoading: false }));
        }
      } catch {
        setState((prev) => ({ ...prev, isAdmin: false, isLoading: false }));
      }
    };

    checkAdminStatus();
  }, [user]);

  const startImpersonation = useCallback(
    (userId: string, userName: string) => {
      setState((prev) => ({
        ...prev,
        isImpersonating: true,
        impersonatedUserId: userId,
        impersonatedUserName: userName,
      }));
    },
    []
  );

  const stopImpersonation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isImpersonating: false,
      impersonatedUserId: null,
      impersonatedUserName: null,
    }));
  }, []);

  const effectiveUserId = state.isImpersonating
    ? state.impersonatedUserId
    : user?.id ?? null;

  return (
    <ImpersonationContext.Provider
      value={{
        ...state,
        startImpersonation,
        stopImpersonation,
        effectiveUserId,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error(
      "useImpersonation must be used within an ImpersonationProvider"
    );
  }
  return context;
}
