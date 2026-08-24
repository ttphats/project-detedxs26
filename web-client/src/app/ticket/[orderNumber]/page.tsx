'use client'

import {useEffect, useState, use} from 'react'
import {useSearchParams} from 'next/navigation'
const MESSAGES: Record<string, string> = {
  'status.pending.text': 'Pending Payment',
  'status.pending.desc': 'Please complete the bank transfer to reserve your tickets.',
  'status.pendingConf.text': 'Pending Confirmation',
  'status.pendingConf.desc':
    'We are confirming your payment. The ticket will be issued in a few minutes.',
  'status.paid.text': 'Paid',
  'status.paid.desc': 'Payment successful. See you at the event!',
  'status.cancelled.text': 'Cancelled',
  'status.cancelled.desc': 'This order has been cancelled.',
  'status.expired.text': 'Expired',
  'status.expired.desc': 'The payment time has expired.',
  'error.missingToken': 'Missing order validation token.',
  'error.fetchFailed': 'Unable to load ticket details.',
  'error.generic': 'An error occurred.',
  loading: 'Loading...',
  'error.accessDenied': 'Access Denied',
  'error.notFound': 'Ticket not found',
  backHome: 'Back to Home',
  eTicket: 'E-Ticket',
  importantNote: 'Important Note',
  date: 'Date',
  time: 'Time',
  venue: 'Venue',
  attendeeInfo: 'Attendee Info',
  tickets: 'tickets',
  seat: 'Seat',
  checkinCode: 'Check-in Code',
  scanInstruction: 'Scan this code at the check-in counter',
  checkinSuccess: 'Check-in Successful',
  totalAmount: 'Total Amount',
  footerNote: 'Please bring this ticket to the event.',
}

const useTranslations = () => {
  return (key: string) => MESSAGES[key] || key
}
import {toast} from 'sonner'
import {
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Share2,
  Ticket,
  Sparkles,
  QrCode,
  Users,
  Shield,
} from 'lucide-react'
import {formatVNDate, formatVNTime} from '@/lib/date-utils'

interface TicketUnit {
  id?: string
  index: number
  ticketCode: string | null
  qrCodeUrl: string | null
  typeName: string
  seatNumber?: string
  price: number
  checkedIn?: boolean
  checkedInAt?: string | null
}

interface TicketData {
  orderNumber: string
  status: string
  customerName: string
  totalAmount: number
  createdAt: string
  checkedIn: boolean
  checkedInAt: string | null
  qrCodeUrl: string | null
  canDownload: boolean
  bookingMode?: 'TICKET_CLASS' | 'SEAT_MAP'
  ticketLines?: Array<{
    name: string
    unitPrice: number
    quantity: number
    lineTotal: number
  }>
  ticketUnits?: TicketUnit[]
  checkInProgress?: {total: number; checkedIn: number; pending: number}
  event: {
    id: string
    name: string
    venue: string
    eventDate: string
    startTime: string
    doorsOpenTime: string
    bannerImageUrl: string | null
    thumbnailUrl: string | null
  } | null
  seats: {
    seatNumber: string
    seatType: string
    price: number
  }[]
}

const getStatusConfig = (t: any) => ({
  PENDING: {
    color: 'yellow',
    bgClass: 'bg-yellow-500/20',
    textClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/30',
    icon: AlertTriangle,
    text: t('status.pending.text'),
    description: t('status.pending.desc'),
  },
  PENDING_CONFIRMATION: {
    color: 'blue',
    bgClass: 'bg-blue-500/20',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/30',
    icon: Clock,
    text: t('status.pendingConf.text'),
    description: t('status.pendingConf.desc'),
  },
  PAID: {
    color: 'green',
    bgClass: 'bg-emerald-500/20',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    icon: CheckCircle,
    text: t('status.paid.text'),
    description: t('status.paid.desc'),
  },
  CANCELLED: {
    color: 'red',
    bgClass: 'bg-red-500/20',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/30',
    icon: XCircle,
    text: t('status.cancelled.text'),
    description: t('status.cancelled.desc'),
  },
  EXPIRED: {
    color: 'gray',
    bgClass: 'bg-gray-500/20',
    textClass: 'text-gray-400',
    borderClass: 'border-gray-500/30',
    icon: Clock,
    text: t('status.expired.text'),
    description: t('status.expired.desc'),
  },
})

export default function TicketPage({params}: {params: Promise<{orderNumber: string}>}) {
  const {orderNumber} = use(params)
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const t = useTranslations()

  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) {
      setError(t('error.missingToken'))
      setLoading(false)
      return
    }

    const fetchTicket = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
        const res = await fetch(`${apiUrl}/ticket/${orderNumber}?token=${token}`)
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.error || t('error.fetchFailed'))
        }

        setTicket(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('error.generic'))
      } finally {
        setLoading(false)
      }
    }

    fetchTicket()
  }, [orderNumber, token])

  const formatDate = (dateString: string) => {
    return formatVNDate(dateString, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTimeLocal = (dateString: string) => {
    return formatVNTime(dateString)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'VND',
    }).format(amount)
  }

  // Permanent ticket URL — access token is hash-only and does NOT expire by time
  const handleCopyLink = async () => {
    const ticketUrl = `${window.location.origin}/ticket/${orderNumber}?token=${token}`
    try {
      await navigator.clipboard.writeText(ticketUrl)
      setCopied(true)
      toast.success('Ticket link copied — save it to reopen anytime')
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.error('Failed to copy:', err)
      toast.error('Could not copy link')
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className='min-h-screen bg-black flex items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 text-red-500 animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>{t('loading')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !ticket) {
    return (
      <div className='min-h-screen bg-black flex items-center justify-center p-4'>
        <div className='glass-dark rounded-3xl p-8 max-w-md w-full text-center'>
          <div className='w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6'>
            <Shield className='w-10 h-10 text-red-500' />
          </div>
          <h1 className='text-2xl font-bold text-white mb-3'>{t('error.accessDenied')}</h1>
          <p className='text-gray-400 mb-6'>{error || t('error.notFound')}</p>
          <a
            href='/'
            className='inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors'
          >
            {t('backHome')}
          </a>
        </div>
      </div>
    )
  }

  const STATUS_CONFIG = getStatusConfig(t)
  const statusConfig =
    STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDING
  const StatusIcon = statusConfig.icon

  return (
    <div className='min-h-screen bg-black'>
      {/* Animated Background */}
      <div className='fixed inset-0 overflow-hidden pointer-events-none'>
        <div className='absolute top-0 left-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-[120px] animate-pulse' />
        <div className='absolute bottom-1/4 right-1/4 w-80 h-80 bg-red-500/10 rounded-full blur-[100px]' />
        <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-red-900/5 to-transparent' />
      </div>

      <div className='relative max-w-lg mx-auto px-4 py-8 md:py-12'>
        {/* Header */}
        <div className='text-center mb-8'>
          <div className='inline-flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 mb-4'>
            <Ticket className='w-4 h-4 text-red-500' />
            <span className='text-sm text-gray-400'>{t('eTicket')}</span>
          </div>
          <h1 className='text-3xl md:text-4xl font-black text-white mb-2'>
            <span className='text-white'>TED</span>
            <span className='text-red-500'>x</span>
            <span className='text-white font-light'>FPTUniversityHCMC</span>
          </h1>
        </div>

        {/* Save permanent ticket URL — token does not expire */}
        <div className='mb-6 p-4 bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/30 rounded-2xl backdrop-blur-sm'>
          <div className='flex items-start gap-3'>
            <div className='w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5'>
              <Shield className='w-5 h-5 text-amber-400' />
            </div>
            <div className='flex-1 min-w-0'>
              <h3 className='text-amber-400 font-bold mb-1 flex items-center gap-2'>
                <AlertTriangle className='w-4 h-4' />
                {t('importantNote')}
              </h3>
              <p className='text-sm text-amber-100/90 leading-relaxed mb-3'>
                <strong>Save / copy this link</strong> to reopen your ticket anytime. The access
                token <strong>does not expire</strong> — keep it private.
              </p>
              <button
                type='button'
                onClick={handleCopyLink}
                className='inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#e62b1e] hover:bg-[#c41e12] text-white text-sm font-bold transition-colors'
              >
                {copied ? <CheckCircle className='w-4 h-4' /> : <Share2 className='w-4 h-4' />}
                {copied ? 'Copied' : 'Copy ticket URL'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Ticket Card */}
        <div className='relative'>
          {/* Ticket Glow Effect */}
          <div className='absolute -inset-1 bg-gradient-to-r from-red-600/30 via-red-500/20 to-red-600/30 rounded-3xl blur-xl opacity-75' />

          {/* Ticket Container */}
          <div
            id='ticket-card'
            className='relative bg-gradient-to-b from-zinc-900 to-black rounded-3xl overflow-hidden border border-white/10'
          >
            {/* Top Section - Event Info */}
            <div className='relative p-6 pb-8'>
              {/* Event Banner Background */}
              {ticket.event?.bannerImageUrl && (
                <div
                  className='absolute inset-0 opacity-30'
                  style={{
                    backgroundImage: `url(${ticket.event.bannerImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
              )}
              <div className='absolute inset-0 bg-gradient-to-b from-red-900/50 via-black/80 to-black' />

              <div className='relative'>
                {/* Status Badge */}
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusConfig.bgClass} ${statusConfig.borderClass} border mb-4`}
                >
                  <StatusIcon className={`w-4 h-4 ${statusConfig.textClass}`} />
                  <span className={`text-sm font-medium ${statusConfig.textClass}`}>
                    {statusConfig.text}
                  </span>
                </div>

                {/* Event Name */}
                <h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>
                  {ticket.event?.name || 'TEDx Event'}
                </h2>

                {/* Event Details Grid */}
                <div className='grid grid-cols-2 gap-4'>
                  <div className='flex items-start gap-3'>
                    <div className='w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0'>
                      <Calendar className='w-5 h-5 text-red-500' />
                    </div>
                    <div>
                      <p className='text-xs text-gray-500 uppercase tracking-wide'>{t('date')}</p>
                      <p className='text-sm text-white font-medium'>
                        {ticket.event ? formatDate(ticket.event.eventDate) : '-'}
                      </p>
                    </div>
                  </div>

                  <div className='flex items-start gap-3'>
                    <div className='w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0'>
                      <Clock className='w-5 h-5 text-red-500' />
                    </div>
                    <div>
                      <p className='text-xs text-gray-500 uppercase tracking-wide'>{t('time')}</p>
                      <p className='text-sm text-white font-medium'>
                        {ticket.event ? formatTimeLocal(ticket.event.startTime) : '-'}
                      </p>
                    </div>
                  </div>

                  <div className='col-span-2 flex items-start gap-3'>
                    <div className='w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0'>
                      <MapPin className='w-5 h-5 text-red-500' />
                    </div>
                    <div>
                      <p className='text-xs text-gray-500 uppercase tracking-wide'>{t('venue')}</p>
                      <p className='text-sm text-white font-medium'>{ticket.event?.venue || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Perforated Line */}
            <div className='relative h-8 flex items-center'>
              <div className='absolute left-0 w-4 h-8 bg-black rounded-r-full -ml-1' />
              <div className='absolute right-0 w-4 h-8 bg-black rounded-l-full -mr-1' />
              <div className='flex-1 mx-4 border-t-2 border-dashed border-white/20' />
            </div>

            {/* Bottom Section - Ticket Info & QR */}
            <div className='p-6 pt-2'>
              {/* Attendee Info */}
              <div className='mb-6'>
                <div className='flex items-center gap-2 mb-3'>
                  <Users className='w-4 h-4 text-gray-500' />
                  <span className='text-xs text-gray-500 uppercase tracking-wide'>
                    {t('attendeeInfo')}
                  </span>
                </div>
                <p className='text-xl font-bold text-white mb-1'>{ticket.customerName}</p>
                <div className='flex items-center gap-4 text-sm text-gray-400'>
                  <span className='font-mono bg-white/5 px-2 py-1 rounded'>
                    #{ticket.orderNumber}
                  </span>
                  <span>
                    {ticket.seats.length} {t('tickets')}
                  </span>
                </div>
              </div>

              {/* Ticket units (model B) or seats grid */}
              <div className='mb-6'>
                <div className='flex items-center justify-between gap-2 mb-3'>
                  <div className='flex items-center gap-2'>
                    <Ticket className='w-4 h-4 text-gray-500' />
                    <span className='text-xs text-gray-500 uppercase tracking-wide'>
                      {ticket.ticketUnits?.length ? 'Tickets' : t('seat')}
                    </span>
                  </div>
                  {ticket.checkInProgress && (
                    <span className='text-[11px] text-gray-500 tabular-nums'>
                      {ticket.checkInProgress.checkedIn}/{ticket.checkInProgress.total} checked in
                    </span>
                  )}
                </div>

                {ticket.ticketUnits && ticket.ticketUnits.length > 0 ? (
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    {ticket.ticketUnits.map((unit) => (
                      <div
                        key={unit.id || unit.ticketCode || unit.index}
                        className={`rounded-xl border p-3 ${
                          unit.checkedIn
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-white/10 bg-white/[0.03]'
                        }`}
                      >
                        <div className='flex items-start justify-between gap-2 mb-2'>
                          <div className='min-w-0'>
                            <p className='text-sm font-bold text-white truncate'>{unit.typeName}</p>
                            <p className='text-[11px] text-gray-500 font-mono'>
                              {unit.ticketCode || `#${unit.index}`}
                            </p>
                          </div>
                          {ticket.canDownload && (
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                unit.checkedIn
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-white/10 text-gray-400'
                              }`}
                            >
                              {unit.checkedIn ? 'In' : 'Ready'}
                            </span>
                          )}
                        </div>
                        {ticket.canDownload && unit.qrCodeUrl && (
                          <div className='bg-white rounded-lg p-2 flex justify-center'>
                            <img
                              src={unit.qrCodeUrl}
                              alt={unit.ticketCode || 'QR'}
                              className='w-36 h-36 object-contain'
                              style={{imageRendering: 'crisp-edges'}}
                            />
                          </div>
                        )}
                        <p className='text-[11px] text-gray-500 mt-2 text-center tabular-nums'>
                          {Number(unit.price).toLocaleString('en-US')} VND
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='flex flex-wrap gap-2'>
                    {ticket.seats.map((seat, index) => (
                      <div
                        key={index}
                        className={`relative px-4 py-3 rounded-xl border ${
                          seat.seatType === 'VIP'
                            ? 'bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-amber-500/30'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        {seat.seatType === 'VIP' && (
                          <Sparkles className='absolute -top-1 -right-1 w-4 h-4 text-amber-400' />
                        )}
                        <p className='text-lg font-bold text-white'>{seat.seatNumber}</p>
                        <p className='text-xs text-gray-400'>{seat.seatType}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Legacy single QR only if no units */}
              {ticket.canDownload &&
                ticket.qrCodeUrl &&
                !(ticket.ticketUnits && ticket.ticketUnits.length > 0) && (
                  <div className='mb-6 flex flex-col items-center'>
                    <div className='flex items-center gap-2 mb-3'>
                      <QrCode className='w-4 h-4 text-gray-500' />
                      <span className='text-xs text-gray-500 uppercase tracking-wide'>
                        {t('checkinCode')}
                      </span>
                    </div>
                    <div className='bg-white rounded-lg p-4 flex items-center justify-center'>
                      <img
                        src={ticket.qrCodeUrl}
                        alt='QR Code'
                        className='w-48 h-48 object-contain'
                        style={{imageRendering: 'crisp-edges'}}
                      />
                    </div>
                  </div>
                )}

              {/* Check-in Status */}
              {ticket.checkedIn && (
                <div className='mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3'>
                  <div className='w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center'>
                    <CheckCircle className='w-6 h-6 text-emerald-400' />
                  </div>
                  <div>
                    <p className='text-emerald-400 font-semibold'>{t('checkinSuccess')}</p>
                    <p className='text-sm text-gray-400'>
                      {ticket.checkedInAt && new Date(ticket.checkedInAt).toLocaleString('en-US')}
                    </p>
                  </div>
                </div>
              )}

              {/* Total Amount */}
              <div className='flex items-center justify-between py-4 border-t border-white/10'>
                <span className='text-gray-400'>{t('totalAmount')}</span>
                <span className='text-2xl font-bold text-white'>
                  {formatCurrency(ticket.totalAmount)}
                </span>
              </div>

              {(ticket.status === 'PENDING_CONFIRMATION' || ticket.canDownload) && (
                <div className='flex gap-3 mt-4'>
                  <button
                    onClick={handleCopyLink}
                    className='flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors'
                  >
                    {copied ? (
                      <CheckCircle className='w-5 h-5 text-emerald-400' />
                    ) : (
                      <Share2 className='w-5 h-5' />
                    )}
                    {copied ? 'Copied' : 'Copy ticket link'}
                  </button>
                </div>
              )}

              {/* Status Description */}
              <div
                className={`mt-4 p-4 rounded-xl ${statusConfig.bgClass} ${statusConfig.borderClass} border`}
              >
                <p className={`text-sm ${statusConfig.textClass}`}>{statusConfig.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className='text-center mt-8 text-xs text-gray-600'>
          <p>{t('footerNote')}</p>
          <p className='mt-1'>© 2026 TEDxFPTUniversityHCMC</p>
        </div>
      </div>
    </div>
  )
}
