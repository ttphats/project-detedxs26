"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin";
import {
  Calendar,
  ShoppingCart,
  Armchair,
  Mail,
  TrendingUp,
  Users,
} from "lucide-react";

interface Stats {
  totalEvents: number;
  totalOrders: number;
  ticketsSold: number;
  revenue: number;
  availableSeats: number;
  pendingOrders: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/dashboard/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome to TEDx Admin Panel</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Events
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? "-" : stats?.totalEvents || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Orders
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? "-" : stats?.totalOrders || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Tickets Sold
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? "-" : stats?.ticketsSold || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Armchair className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-3xl font-bold text-[#e62b1e] mt-2">
                  {loading
                    ? "-"
                    : `${((stats?.revenue || 0) / 1000000).toFixed(1)}M`}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#e62b1e]" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/admin/events"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#e62b1e] hover:bg-red-50 transition-colors text-center"
            >
              <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <div className="font-medium">Manage Events</div>
            </Link>
            <Link
              href="/admin/seats"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#e62b1e] hover:bg-red-50 transition-colors text-center"
            >
              <Armchair className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <div className="font-medium">Manage Seats</div>
            </Link>
            <Link
              href="/admin/orders"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#e62b1e] hover:bg-red-50 transition-colors text-center"
            >
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <div className="font-medium">View Orders</div>
            </Link>
            <Link
              href="/admin/email-templates"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#e62b1e] hover:bg-red-50 transition-colors text-center"
            >
              <Mail className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <div className="font-medium">Email Templates</div>
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Available Seats
            </h2>
            <p className="text-4xl font-bold text-green-600">
              {loading ? "-" : stats?.availableSeats || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Seats ready for booking
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Pending Orders
            </h2>
            <p className="text-4xl font-bold text-yellow-600">
              {loading ? "-" : stats?.pendingOrders || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Orders awaiting payment confirmation
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
