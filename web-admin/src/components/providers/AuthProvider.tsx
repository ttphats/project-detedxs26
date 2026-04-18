"use client";

import { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthState, AuthContext } from "@/hooks/useAuth";
import { Spin } from "antd";

interface AuthProviderProps {
  children: ReactNode;
}

function LoadingScreen({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-4">
      <Spin size="large" />
      <span className="text-gray-500">{text}</span>
    </div>
  );
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuthState();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/admin/login";

  // Show loading while checking auth
  if (auth.loading) {
    return <LoadingScreen />;
  }

  // Redirect to login if not authenticated (except login page)
  if (!auth.isAuthenticated && !isLoginPage) {
    if (typeof window !== "undefined") {
      router.push("/admin/login");
    }
    return <LoadingScreen text="Redirecting..." />;
  }

  // Redirect to dashboard if authenticated and on login page
  if (auth.isAuthenticated && isLoginPage) {
    if (typeof window !== "undefined") {
      router.push("/admin/dashboard");
    }
    return <LoadingScreen text="Redirecting..." />;
  }

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
