'use client'

import {useState, useEffect, Suspense} from 'react'
import {useSearchParams, useRouter} from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Copy,
  Check,
  Clock,
  CreditCard,
  Ticket,
  QrCode,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

// Type definitions for event data
interface Seat {
  id: string
  seatNumber: string
  row: string
  number: number
  section: string
  status: string
  ticketTypeId: string
  seatType: string
  price: number
}

interface SeatRow {
  row: string
  seats: Seat[]
}

interface EventData {
  id: string
  name: string
  venue: string
  eventDate: string
  seatMap: SeatRow[]
}

// Bank account info for transfer
const bankInfo = {
  bankName: 'Ngân hàng Á Châu - ACB',
  bankLogo: '/acb-logo.png',
  accountNumber: '85085588',
  accountHolder: 'CONG TY TNHH TICKETHUB VN',
}

// Countdown timer duration in seconds (15 minutes)
const COUNTDOWN_DURATION = 15 * 60

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const eventId = searchParams.get('event')
  const seatIds = searchParams.get('seats')?.split(',') || []
  const orderNumber = searchParams.get('order') // Order number from create-pending
  const accessToken = searchParams.get('token') // Access token from create-pending

  const [formData, setFormData] = useState({name: '', email: '', phone: ''})
  const [isProcessing, setIsProcessing] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_DURATION)
  const [isExpired, setIsExpired] = useState(false)
  const [orderCode, setOrderCode] = useState('TKH000000')
  const [orderError, setOrderError] = useState<string | null>(null)
  const [event, setEvent] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [orderData, setOrderData] = useState<any>(null)

  // Debug URL params
  console.log('[CHECKOUT] URL params:', {
    eventId,
    orderNumber,
    accessToken: accessToken ? `${accessToken.substring(0, 10)}...` : null,
    seatIds: seatIds.length,
  })

  // Fetch order data to get accurate expiration time
  useEffect(() => {
    const fetchOrder = async () => {
      // If no order number, this is old flow (direct from seats page without creating order)
      // Just load event data instead
      if (!orderNumber || !accessToken) {
        console.log('[CHECKOUT] No order number - using legacy flow')
        setLoading(false)
        return
      }

      try {
        console.log('[CHECKOUT] Fetching order:', orderNumber)
        const res = await fetch(`/api/orders/${orderNumber}?token=${accessToken}`)
        const data = await res.json()

        if (data.success) {
          setOrderData(data.data)
          setOrderCode(data.data.orderNumber)

          // Set initial countdown based on actual time remaining
          setTimeLeft(data.data.timeRemaining)

          // Pre-fill customer info if already exists
          if (data.data.customerName) {
            setFormData({
              name: data.data.customerName,
              email: data.data.customerEmail,
              phone: data.data.customerPhone,
            })
          }

          // Check if already expired
          if (data.data.timeRemaining <= 0) {
            setIsExpired(true)
          }

          console.log('[CHECKOUT] Order loaded:', {
            orderNumber: data.data.orderNumber,
            status: data.data.status,
            timeRemaining: data.data.timeRemaining,
            expiresAt: data.data.expiresAt,
          })
        } else {
          console.error('Failed to fetch order:', data.error)
          setOrderError(data.error || 'Không thể tải thông tin đơn hàng')
        }
      } catch (err) {
        console.error('Error fetching order:', err)
        setOrderError('Lỗi khi tải thông tin đơn hàng')
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderNumber, accessToken])

  // Fetch event data from API (fallback if order doesn't have event info)
  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId || orderData?.event) {
        return
      }

      try {
        const res = await fetch(`/api/events/${eventId}`)
        const data = await res.json()

        if (data.success) {
          setEvent(data.data)
        } else {
          console.error('Failed to fetch event:', data.error)
        }
      } catch (err) {
        console.error('Error fetching event:', err)
      }
    }

    fetchEvent()
  }, [eventId, orderData])

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft <= 0) {
      setIsExpired(true)
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Get selected seats from order data (preferred) or event data (fallback)
  const selectedSeats: Seat[] = orderData?.seats
    ? orderData.seats.map((s: any) => ({
        id: s.seatId,
        seatNumber: s.seatNumber,
        row: s.row,
        number: parseInt(s.seatNumber.replace(/\D/g, '')) || 0,
        section: s.section,
        status: 'RESERVED',
        ticketTypeId: '',
        seatType: s.seatType,
        price: s.price,
      }))
    : event
    ? event.seatMap.flatMap((row) => row.seats).filter((seat) => seatIds.includes(seat.id))
    : []
  const totalPrice =
    orderData?.totalAmount || selectedSeats.reduce((sum, seat) => sum + seat.price, 0)
  const transferContent = `Nap quy khach hang id ${orderCode}`

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleConfirmPayment = async () => {
    if (!formData.name || !formData.email || !formData.phone) {
      alert('Vui lòng điền đầy đủ thông tin')
      return
    }

    if (!orderNumber || !accessToken) {
      setOrderError('Thiếu thông tin đơn hàng. Vui lòng quay lại trang chọn ghế.')
      return
    }

    setIsProcessing(true)
    setOrderError(null)

    try {
      // Call API to confirm payment (update order status to PAID)
      const response = await fetch('/api/orders/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderNumber,
          accessToken,
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to confirm payment')
      }

      console.log('[CHECKOUT] Payment confirmed for order:', orderNumber)

      // Navigate to ticket page with token for status tracking
      const ticketPath = `/ticket/${orderNumber}?token=${accessToken}`
      router.push(ticketPath)
    } catch (error: unknown) {
      console.error('Payment confirmation error:', error)
      setOrderError(
        error instanceof Error ? error.message : 'Có lỗi xảy ra khi xác nhận thanh toán'
      )
      setIsProcessing(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className='min-h-screen bg-black flex items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 text-red-500 animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Đang tải thông tin đơn hàng...</p>
        </div>
      </div>
    )
  }

  if (!event || selectedSeats.length === 0) {
    return (
      <div className='min-h-screen bg-black flex items-center justify-center'>
        <div className='text-center glass-panel p-8 rounded-2xl'>
          <h1 className='text-2xl font-bold text-white mb-4'>Không tìm thấy đơn hàng</h1>
          <Link
            href='/'
            className='inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors'
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-black pt-24 pb-12'>
      {/* Background effects */}
      <div className='fixed inset-0 pointer-events-none overflow-hidden'>
        <div
          className='absolute top-20 right-20 w-125 h-125 bg-red-600/10 rounded-full blur-3xl animate-pulse'
          style={{animationDuration: '4s'}}
        />
        <div
          className='absolute bottom-20 left-20 w-100 h-100 bg-red-600/5 rounded-full blur-3xl animate-pulse'
          style={{animationDuration: '5s'}}
        />
      </div>

      <div className='relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Countdown Timer - Fixed on mobile */}
        <div
          className={`fixed top-20 left-0 right-0 z-40 px-4 sm:static sm:mb-6 ${
            isExpired ? 'animate-pulse' : ''
          }`}
        >
          <div
            className={`max-w-6xl mx-auto p-3 sm:p-4 rounded-xl sm:rounded-2xl backdrop-blur-xl border ${
              isExpired
                ? 'bg-red-900/80 border-red-500/50'
                : timeLeft <= 60
                ? 'bg-yellow-900/80 border-yellow-500/50'
                : 'bg-white/10 border-white/10'
            }`}
          >
            <div className='flex items-center justify-between gap-3'>
              <div className='flex items-center gap-2 sm:gap-3'>
                {isExpired ? (
                  <AlertTriangle className='w-5 h-5 sm:w-6 sm:h-6 text-red-400' />
                ) : (
                  <Clock
                    className={`w-5 h-5 sm:w-6 sm:h-6 ${
                      timeLeft <= 60 ? 'text-yellow-400' : 'text-red-400'
                    }`}
                  />
                )}
                <div>
                  <p
                    className={`text-xs sm:text-sm font-medium ${
                      isExpired
                        ? 'text-red-300'
                        : timeLeft <= 60
                        ? 'text-yellow-300'
                        : 'text-gray-300'
                    }`}
                  >
                    {isExpired ? 'Hết thời gian thanh toán' : 'Thời gian còn lại để thanh toán'}
                  </p>
                </div>
              </div>

              {!isExpired && (
                <div
                  className={`flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono font-black text-lg sm:text-2xl ${
                    timeLeft <= 60
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-600/20 text-red-400'
                  }`}
                >
                  <span>{formatTime(timeLeft)}</span>
                </div>
              )}

              {isExpired && (
                <Link
                  href={`/events/${eventId}/seats`}
                  className='px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-colors'
                >
                  Chọn lại ghế
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Spacer for fixed timer on mobile */}
        <div className='h-16 sm:hidden' />

        {/* Header */}
        <div className='mb-6 sm:mb-8 animate-fade-in-down'>
          <Link
            href={`/events/${eventId}/seats`}
            className='inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors group'
          >
            <ArrowLeft className='w-4 h-4 group-hover:-translate-x-1 transition-transform' />
            Quay lại chọn ghế
          </Link>
          <h1 className='text-2xl sm:text-3xl md:text-4xl font-black text-white mt-4'>
            Thanh toán
          </h1>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          {/* Left: Customer Info & Bank Transfer */}
          <div className='lg:col-span-2 space-y-6'>
            {/* Customer Info */}
            <div className='glass-panel rounded-2xl p-6 animate-fade-in relative overflow-hidden'>
              <div className='absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-2xl' />

              <h2 className='text-xl font-bold text-white mb-6 flex items-center gap-3'>
                <div className='w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center'>
                  <CreditCard className='w-5 h-5 text-red-500' />
                </div>
                Thông tin khách hàng
              </h2>

              <div className='space-y-4 relative'>
                <div>
                  <label className='block text-sm font-medium text-gray-300 mb-2'>
                    Họ và tên *
                  </label>
                  <input
                    type='text'
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className='w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all'
                    placeholder='Nguyễn Văn A'
                  />
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-300 mb-2'>Email *</label>
                    <input
                      type='email'
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className='w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all'
                      placeholder='email@example.com'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-300 mb-2'>
                      Số điện thoại *
                    </label>
                    <input
                      type='tel'
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className='w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all'
                      placeholder='0901234567'
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Transfer Section */}
            <div
              className='glass-panel rounded-2xl overflow-hidden animate-fade-in relative'
              style={{animationDelay: '0.1s'}}
            >
              <div className='absolute top-0 left-0 w-48 h-48 bg-red-600/5 rounded-full blur-2xl -translate-y-1/2 -translate-x-1/2' />

              <div className='border-l-4 border-red-500 px-6 py-4 bg-red-600/10'>
                <h2 className='text-xl font-bold text-white flex items-center gap-3'>
                  <QrCode className='w-5 h-5 text-red-500' />
                  Thanh toán chuyển khoản
                </h2>
              </div>

              <div className='p-6 relative'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                  {/* Bank Info Left */}
                  <div className='space-y-5'>
                    {/* Bank Name */}
                    <div className='flex items-center gap-3 p-3 bg-white/5 rounded-xl'>
                      <div className='w-12 h-12 bg-linear-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-red-500/30'>
                        ACB
                      </div>
                      <div>
                        <p className='font-semibold text-white'>{bankInfo.bankName}</p>
                      </div>
                    </div>

                    {/* Account Number */}
                    <div className='p-3 bg-white/5 rounded-xl'>
                      <p className='text-sm text-red-400 mb-1'>Số tài khoản</p>
                      <div className='flex items-center gap-2'>
                        <span className='text-xl font-bold text-white'>
                          {bankInfo.accountNumber}
                        </span>
                        <button
                          onClick={() => copyToClipboard(bankInfo.accountNumber, 'account')}
                          className='p-1.5 hover:bg-white/10 rounded-lg transition-colors'
                        >
                          {copiedField === 'account' ? (
                            <Check className='w-4 h-4 text-green-500' />
                          ) : (
                            <Copy className='w-4 h-4 text-gray-400' />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Account Holder */}
                    <div className='p-3 bg-white/5 rounded-xl'>
                      <p className='text-sm text-red-400 mb-1'>Chủ tài khoản</p>
                      <p className='font-semibold text-white'>{bankInfo.accountHolder}</p>
                    </div>

                    {/* Transfer Content */}
                    <div className='p-3 bg-white/5 rounded-xl'>
                      <p className='text-sm text-red-400 mb-1'>Nội dung chuyển khoản</p>
                      <div className='flex items-center gap-2'>
                        <span className='font-semibold text-white'>{transferContent}</span>
                        <button
                          onClick={() => copyToClipboard(transferContent, 'content')}
                          className='p-1.5 hover:bg-white/10 rounded-lg transition-colors'
                        >
                          {copiedField === 'content' ? (
                            <Check className='w-4 h-4 text-green-500' />
                          ) : (
                            <Copy className='w-4 h-4 text-gray-400' />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className='p-4 bg-linear-to-r from-red-600/20 to-red-600/10 rounded-xl border border-red-500/30'>
                      <p className='text-sm text-red-400 mb-1'>Số tiền</p>
                      <div className='flex items-center gap-2'>
                        <span className='text-2xl font-black text-red-500'>
                          {totalPrice.toLocaleString('vi-VN')}đ
                        </span>
                        <button
                          onClick={() => copyToClipboard(totalPrice.toString(), 'amount')}
                          className='p-1.5 hover:bg-white/10 rounded-lg transition-colors'
                        >
                          {copiedField === 'amount' ? (
                            <Check className='w-4 h-4 text-green-500' />
                          ) : (
                            <Copy className='w-4 h-4 text-gray-400' />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* QR Code Right */}
                  <div className='flex flex-col items-center justify-center'>
                    <p className='text-sm text-gray-400 mb-4 text-center'>
                      Quét mã qua ứng dụng
                      <br />
                      ngân hàng/ ví điện tử để thanh toán
                    </p>
                    <div className='border-2 border-white/10 rounded-2xl p-4 bg-white relative overflow-hidden'>
                      {/* VietQR Header */}
                      <div className='flex items-center justify-center gap-1 mb-3'>
                        <span className='text-blue-600 font-bold text-lg'>Viet</span>
                        <span className='text-red-500 font-bold text-lg'>QR</span>
                      </div>
                      {/* QR Code Placeholder */}
                      <div className='w-48 h-48 bg-white rounded-lg flex items-center justify-center relative overflow-hidden'>
                        <div className='absolute inset-0 grid grid-cols-10 gap-0.5 p-3'>
                          {Array.from({length: 100}).map((_, i) => (
                            <div
                              key={i}
                              className={`aspect-square rounded-sm ${
                                Math.random() > 0.5 ? 'bg-gray-900' : 'bg-white'
                              }`}
                            />
                          ))}
                        </div>
                        <div className='absolute inset-0 flex items-center justify-center'>
                          <div className='w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-lg border border-gray-200'>
                            <span className='text-red-500 font-black text-sm'>TEDx</span>
                          </div>
                        </div>
                      </div>
                      {/* Footer */}
                      <div className='flex items-center justify-center gap-2 mt-3 text-xs text-gray-500'>
                        <span className='text-blue-600 font-semibold'>napas</span>
                        <span>247</span>
                        <span className='text-gray-300'>|</span>
                        <span className='text-red-500 font-bold'>ACB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className='lg:col-span-1'>
            <div className='sticky top-24'>
              <div
                className='glass-panel rounded-2xl p-6 animate-fade-in relative overflow-hidden'
                style={{animationDelay: '0.2s'}}
              >
                {/* Decorative elements */}
                <div className='absolute top-0 right-0 w-24 h-24 bg-red-600/10 rounded-full blur-2xl' />

                <h2 className='text-xl font-bold text-white mb-4 flex items-center gap-3'>
                  <div className='w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center'>
                    <Ticket className='w-5 h-5 text-red-500' />
                  </div>
                  Thông tin đơn hàng
                </h2>

                <div className='mb-4 pb-4 border-b border-white/10'>
                  <p className='font-semibold text-white'>{event.name}</p>
                  <p className='text-sm text-gray-400'>
                    {new Date(event.eventDate).toLocaleDateString('vi-VN')}
                  </p>
                </div>

                <div className='space-y-2 mb-4 max-h-40 overflow-y-auto'>
                  {selectedSeats.map((seat) => (
                    <div
                      key={seat.id}
                      className='flex justify-between text-sm py-2 border-b border-white/5'
                    >
                      <span className='text-gray-300'>Ghế {seat.seatNumber}</span>
                      <span className='font-medium text-white'>
                        {seat.price.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  ))}
                </div>

                <div className='p-4 bg-linear-to-r from-red-600/20 to-transparent rounded-xl mb-6'>
                  <div className='flex justify-between items-center'>
                    <span className='font-bold text-white'>Tổng cộng</span>
                    <span className='text-2xl font-black text-red-500'>
                      {totalPrice.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>

                <div className='bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6'>
                  <div className='flex items-start gap-2'>
                    <Clock className='w-5 h-5 text-yellow-500 mt-0.5' />
                    <div>
                      <p className='text-sm font-medium text-yellow-400'>Thời gian thanh toán</p>
                      <p className='text-xs text-yellow-500/80'>
                        Vui lòng thanh toán trong vòng 15 phút
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error message */}
                {orderError && (
                  <div className='bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4'>
                    <div className='flex items-start gap-2'>
                      <AlertTriangle className='w-5 h-5 text-red-500 mt-0.5' />
                      <p className='text-sm text-red-400'>{orderError}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                  className='relative w-full py-4 px-6 rounded-xl font-bold text-white flex items-center justify-center gap-2 bg-linear-to-r from-red-600 to-red-500 shadow-xl shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {/* Shine effect */}
                  <div className='absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700' />
                  <span className='relative'>
                    {isProcessing ? 'Đang xử lý...' : 'Đã thanh toán'}
                  </span>
                </button>

                <p className='text-xs text-gray-500 text-center mt-4'>
                  Sau khi chuyển khoản, vui lòng nhấn &quot;Đã thanh toán&quot; để xác nhận
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className='min-h-screen bg-black flex items-center justify-center'>
          <div className='flex flex-col items-center gap-4'>
            <div className='w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin' />
            <p className='text-gray-400'>Đang tải...</p>
          </div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
