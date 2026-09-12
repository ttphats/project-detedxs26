"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import AdminHeader from "./AdminHeader";
import { message, Spin } from "antd";

interface AdminLayoutProps {
  children: React.ReactNode;
}

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Spin size="large" />
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  // Having a token in localStorage is not the same as having a valid one: a
  // token signed by another environment's JWT_SECRET, or simply an expired
  // one, used to sail past the client-side check and then 401 on every call,
  // leaving a blank page and a console error. Ask the backend once per mount.
  useEffect(() => {
    let cancelled = false;

    const verifySession = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.replace("/admin/login");
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          message.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
          router.replace("/admin/login");
          return;
        }
      } catch {
        // A network blip should not log anyone out — let the page load and let
        // the individual request surface the failure.
      }

      if (!cancelled) setCheckingSession(false);
    };

    verifySession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
        <AdminHeader
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-full">
            <Suspense fallback={<PageLoader />}>{children}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
