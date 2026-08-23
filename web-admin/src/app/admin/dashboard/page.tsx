'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import {AdminLayout} from '@/components/admin'
import {Calendar, ShoppingCart, Armchair, Mail, TrendingUp, Clock} from 'lucide-react'

interface Stats {
  totalEvents: number
  totalOrders: number
  ticketsSold: number
  revenue: number
  availableSeats: number
  pendingOrders: number
}

type TicketSalesOverride = 'auto' | 'open' | 'closed'

interface TicketSalesConfig {
  salesOpen: boolean
  opensAt: string
  override: TicketSalesOverride
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toISOString()
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<TicketSalesConfig | null>(null)
  const [override, setOverride] = useState<TicketSalesOverride>('auto')
  const [opensAtLocal, setOpensAtLocal] = useState('')
  const [salesLoading, setSalesLoading] = useState(true)
  const [salesSaving, setSalesSaving] = useState(false)
  const [salesError, setSalesError] = useState<string | null>(null)
  const [salesSaved, setSalesSaved] = useState(false)

  useEffect(() => {
    fetchStats()
    fetchSales()
  }, [])

  const fetchSales = async () => {
    setSalesLoading(true)
    setSalesError(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/settings/ticket-sales', {
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load ticket sales config')
      }
      const config = data.data as TicketSalesConfig
      setSales(config)
      setOverride(config.override || 'auto')
      setOpensAtLocal(toDatetimeLocal(config.opensAt))
    } catch (error) {
      console.error('Failed to fetch ticket sales:', error)
      setSalesError(error instanceof Error ? error.message : 'Failed to load')
    } finally {
      setSalesLoading(false)
    }
  }

  const saveSales = async () => {
    setSalesSaving(true)
    setSalesError(null)
    setSalesSaved(false)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/settings/ticket-sales', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          override,
          opensAt: fromDatetimeLocal(opensAtLocal),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save ticket sales config')
      }
      const config = data.data as TicketSalesConfig
      setSales(config)
      setOverride(config.override || 'auto')
      setOpensAtLocal(toDatetimeLocal(config.opensAt))
      setSalesSaved(true)
    } catch (error) {
      setSalesError(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      setSalesSaving(false)
    }
  }

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/dashboard/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className='space-y-6'>
        {/* Header */}
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Dashboard</h1>
          <p className='text-gray-600 mt-1'>Welcome to TEDx Admin Panel</p>
        </div>

        {/* Ticket sales gate */}
        <div className='bg-white rounded-lg shadow p-6'>
          <div className='flex items-start justify-between gap-4 mb-4'>
            <div>
              <h2 className='text-lg font-semibold text-gray-900 flex items-center gap-2'>
                <Clock className='w-5 h-5 text-[#e62b1e]' />
                Ticket Sales
              </h2>
              <p className='text-sm text-gray-500 mt-1'>
                Auto mở khi hết countdown. Force open / closed để test ngay.
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                sales?.salesOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {salesLoading ? 'Loading…' : sales?.salesOpen ? 'OPEN' : 'CLOSED'}
            </span>
          </div>

          <div className='flex flex-wrap gap-2 mb-4'>
            {(
              [
                {value: 'auto', label: 'Auto (hết giờ tự mở)'},
                {value: 'open', label: 'Force open'},
                {value: 'closed', label: 'Force closed'},
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type='button'
                disabled={salesLoading || salesSaving}
                onClick={() => {
                  setOverride(opt.value)
                  setSalesSaved(false)
                }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                  override === opt.value
                    ? 'bg-[#e62b1e] text-white border-[#e62b1e]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-end'>
            <label className='flex flex-col gap-1'>
              <span className='text-xs font-medium text-gray-600'>Countdown target</span>
              <input
                type='datetime-local'
                className='border border-gray-300 rounded-md px-3 py-2 text-sm'
                value={opensAtLocal}
                disabled={salesLoading || salesSaving}
                onChange={(e) => {
                  setOpensAtLocal(e.target.value)
                  setSalesSaved(false)
                }}
              />
            </label>

            <button
              type='button'
              onClick={saveSales}
              disabled={salesLoading || salesSaving || !opensAtLocal}
              className='bg-[#e62b1e] text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-[#c41f14] disabled:opacity-50'
            >
              {salesSaving ? 'Saving…' : 'Save setup'}
            </button>
          </div>

          {salesError && <p className='text-sm text-red-600 mt-3'>{salesError}</p>}
          {salesSaved && !salesError && (
            <p className='text-sm text-green-600 mt-3'>
              Saved. Production ticket page sẽ tự mở khi hết giờ (nếu Auto), hoặc theo Force.
            </p>
          )}
          {sales && !salesSaved && !salesError && (
            <p className='text-xs text-gray-400 mt-3'>
              Mode: {sales.override} · Open time: {new Date(sales.opensAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Stats Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
          <div className='bg-white rounded-lg shadow p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Total Events</p>
                <p className='text-3xl font-bold text-gray-900 mt-2'>
                  {loading ? '-' : stats?.totalEvents || 0}
                </p>
              </div>
              <div className='w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center'>
                <Calendar className='w-6 h-6 text-blue-600' />
              </div>
            </div>
          </div>

          <div className='bg-white rounded-lg shadow p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Total Orders</p>
                <p className='text-3xl font-bold text-gray-900 mt-2'>
                  {loading ? '-' : stats?.totalOrders || 0}
                </p>
              </div>
              <div className='w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center'>
                <ShoppingCart className='w-6 h-6 text-green-600' />
              </div>
            </div>
          </div>

          <div className='bg-white rounded-lg shadow p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Tickets Sold</p>
                <p className='text-3xl font-bold text-gray-900 mt-2'>
                  {loading ? '-' : stats?.ticketsSold || 0}
                </p>
              </div>
              <div className='w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center'>
                <Armchair className='w-6 h-6 text-purple-600' />
              </div>
            </div>
          </div>

          <div className='bg-white rounded-lg shadow p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Revenue</p>
                <p className='text-3xl font-bold text-[#e62b1e] mt-2'>
                  {loading ? '-' : `${((stats?.revenue || 0) / 1000000).toFixed(1)}M`}
                </p>
              </div>
              <div className='w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center'>
                <TrendingUp className='w-6 h-6 text-[#e62b1e]' />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>Quick Actions</h2>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <Link
              href='/admin/events'
              className='p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#e62b1e] hover:bg-red-50 transition-colors text-center'
            >
              <Calendar className='w-8 h-8 mx-auto mb-2 text-gray-400' />
              <div className='font-medium'>Manage Events</div>
            </Link>
            <Link
              href='/admin/seats'
              className='p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#e62b1e] hover:bg-red-50 transition-colors text-center'
            >
              <Armchair className='w-8 h-8 mx-auto mb-2 text-gray-400' />
              <div className='font-medium'>Manage Seats</div>
            </Link>
            <Link
              href='/admin/orders'
              className='p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#e62b1e] hover:bg-red-50 transition-colors text-center'
            >
              <ShoppingCart className='w-8 h-8 mx-auto mb-2 text-gray-400' />
              <div className='font-medium'>View Orders</div>
            </Link>
            <Link
              href='/admin/email-templates'
              className='p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#e62b1e] hover:bg-red-50 transition-colors text-center'
            >
              <Mail className='w-8 h-8 mx-auto mb-2 text-gray-400' />
              <div className='font-medium'>Email Templates</div>
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-lg font-semibold text-gray-900 mb-4'>Available Seats</h2>
            <p className='text-4xl font-bold text-green-600'>
              {loading ? '-' : stats?.availableSeats || 0}
            </p>
            <p className='text-sm text-gray-500 mt-1'>Seats ready for booking</p>
          </div>
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-lg font-semibold text-gray-900 mb-4'>Pending Orders</h2>
            <p className='text-4xl font-bold text-yellow-600'>
              {loading ? '-' : stats?.pendingOrders || 0}
            </p>
            <p className='text-sm text-gray-500 mt-1'>Orders awaiting payment confirmation</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
