'use client'

import React, {useEffect, useState, useCallback, useMemo} from 'react'
import Link from 'next/link'
import {AdminLayout} from '@/components/admin'
import {
  Button,
  Card,
  InputNumber,
  message,
  Space,
  Tag,
  Tooltip,
  Segmented,
  Select,
  Modal,
  Input,
  Table,
  Popconfirm,
} from 'antd'
import {
  SaveOutlined,
  ClearOutlined,
  CheckSquareOutlined,
  ReloadOutlined,
  TableOutlined,
  CloudUploadOutlined,
  HistoryOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import {exportSeatsToExcel} from '@/lib/excel-export'

// Types
type SeatType =
  | 'VIP'
  | 'STANDARD'
  | 'ECONOMY'
  | 'DISABLED'
  | 'LEVEL_1'
  | 'LEVEL_2'
  | 'LEVEL_3'
  | string

// Local seat for rendering
interface Seat {
  id: string
  row: string
  col: number
  side: 'left' | 'right'
  type: SeatType
  seat_number: string
  price?: number // Price from ticket type
}

interface LayoutConfig {
  rows: number
  leftSeats: number
  rightSeats: number
  vipRows?: number // Number of VIP rows (from row A)
  economyRows?: number // Number of ECONOMY rows (after VIP rows)
  aisleWidth: number
}

interface EventOption {
  id: string
  name: string
  status?: string
}

interface TicketType {
  id: string
  name: string
  price: number
  level: number // 1 = cheapest, 2 = mid, 3 = expensive
  color: string
}

interface LayoutVersion {
  id: string
  event_id: string
  version_name: string
  description: string | null
  layout_config: LayoutConfig
  seats_data: Seat[]
  status: 'DRAFT' | 'PUBLISHED'
  is_active: boolean
  created_at: string
  updated_at: string
  published_at: string | null
}

// Constants
const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const SEAT_COLORS: Record<
  SeatType,
  {back: string; cushion: string; armrest: string; label: string}
> = {
  VIP: {
    back: 'from-yellow-400 to-orange-500',
    cushion: 'from-orange-500 to-orange-600',
    armrest: 'bg-orange-600',
    label: 'VIP',
  },
  STANDARD: {
    back: 'from-emerald-400 to-emerald-500',
    cushion: 'from-emerald-500 to-emerald-600',
    armrest: 'bg-emerald-600',
    label: 'Tiêu chuẩn',
  },
  ECONOMY: {
    back: 'from-cyan-400 to-cyan-500',
    cushion: 'from-cyan-500 to-cyan-600',
    armrest: 'bg-cyan-600',
    label: 'Phổ thông',
  },
  DISABLED: {
    back: 'from-gray-600 to-gray-700',
    cushion: 'from-gray-700 to-gray-800',
    armrest: 'bg-gray-800',
    label: 'Vô hiệu',
  },
}

// Default config
const DEFAULT_CONFIG: LayoutConfig = {
  rows: 10,
  leftSeats: 5,
  rightSeats: 5,
  vipRows: 2, // Row A-B: VIP
  economyRows: 2, // Row C-D: ECONOMY
  aisleWidth: 60,
}

// ✅ NEW: Get ticket type info from seat type string
// Seat.type will be "LEVEL_1", "LEVEL_2", etc. or old "VIP", "STANDARD", "ECONOMY"
const getTicketTypeFromSeat = (
  seatType: string | undefined,
  ticketTypes: TicketType[]
): TicketType | null => {
  // ✅ Null check
  if (!seatType || ticketTypes.length === 0) {
    return null
  }

  // Handle new format: "LEVEL_X"
  if (seatType.startsWith('LEVEL_')) {
    const level = parseInt(seatType.replace('LEVEL_', ''))
    return ticketTypes.find((tt) => tt.level === level) || null
  }

  // Handle old format: map VIP/STANDARD/ECONOMY to level
  const levelMap: Record<string, number> = {
    ECONOMY: 1,
    STANDARD: 2,
    VIP: 3,
  }

  const level = levelMap[seatType]
  if (level) {
    return ticketTypes.find((tt) => tt.level === level) || null
  }

  return null
}

// Generate seats from config with specific seat type
const generateSeatsFromConfig = (
  cfg: LayoutConfig,
  seatType: SeatType,
  ticketTypes: TicketType[] = []
): Seat[] => {
  const seats: Seat[] = []

  // Get price for the selected seat type
  const ticketInfo = getTicketTypeFromSeat(seatType, ticketTypes)
  const price = ticketInfo?.price || 0

  for (let r = 0; r < cfg.rows; r++) {
    const rowLabel = ROW_LABELS[r] || `R${r + 1}`

    // Left side
    for (let c = 1; c <= cfg.leftSeats; c++) {
      seats.push({
        id: `${rowLabel}-L${c}`,
        row: rowLabel,
        col: c,
        side: 'left',
        type: seatType,
        seat_number: `${rowLabel}${c}`,
        price,
      })
    }
    // Right side
    for (let c = 1; c <= cfg.rightSeats; c++) {
      const seatNumber = c + cfg.leftSeats
      seats.push({
        id: `${rowLabel}-R${c}`,
        row: rowLabel,
        col: c,
        side: 'right',
        type: seatType,
        seat_number: `${rowLabel}${seatNumber}`,
        price,
      })
    }
  }
  return seats
}

export default function LayoutEditorPage() {
  // Layout state
  const [config, setConfig] = useState<LayoutConfig>(DEFAULT_CONFIG)
  const [seats, setSeats] = useState<Seat[]>([])
  const [events, setEvents] = useState<EventOption[]>([])
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isLoadingVersion, setIsLoadingVersion] = useState(false) // Flag to prevent auto-regenerate
  const [hasInitialFetch, setHasInitialFetch] = useState(false) // Flag to prevent double fetch
  const [hasLoadedSeats, setHasLoadedSeats] = useState(false) // Flag to prevent regenerating loaded seats

  // Version management
  const [versions, setVersions] = useState<LayoutVersion[]>([])
  const [currentVersion, setCurrentVersion] = useState<LayoutVersion | null>(null)
  const [showVersionsModal, setShowVersionsModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [versionDescription, setVersionDescription] = useState('')

  // Selection state
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set())
  const [isMultiSelect, setIsMultiSelect] = useState(false)
  const [currentType, setCurrentType] = useState<SeatType | null>(null) // ✅ No default, force user to select

  // Preview mode
  const [showPreview, setShowPreview] = useState(false)

  // Fetch events and versions
  const fetchData = useCallback(async (eventId?: string) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      // Fetch events list first
      const eventsRes = await fetch('/api/admin/seats', {
        headers: {Authorization: `Bearer ${token}`},
      })
      const eventsData = await eventsRes.json()
      if (eventsData.success) {
        setEvents(eventsData.data.events || [])
        if (!eventId && eventsData.data.events?.length > 0) {
          // Find PUBLISHED event first, otherwise use first event
          const publishedEvent = eventsData.data.events.find(
            (e: EventOption) => e.status === 'PUBLISHED'
          )
          eventId = publishedEvent?.id || eventsData.data.events[0].id
          // Only set if different to avoid triggering useEffect loop
          setSelectedEvent((prev) => (prev === eventId ? prev : eventId))
        }
      }

      if (!eventId) {
        setLoading(false)
        return
      }

      // Fetch versions for selected event
      const versionsRes = await fetch(`/api/admin/layout-versions?eventId=${eventId}`, {
        headers: {Authorization: `Bearer ${token}`},
      })
      const versionsData = await versionsRes.json()

      if (versionsData.success) {
        const loadedTicketTypes = versionsData.data.ticketTypes || []
        const loadedVersions = versionsData.data.versions || []

        // Load active version or latest draft
        const activeVersion = loadedVersions.find((v: LayoutVersion) => v.is_active)
        const latestDraft = loadedVersions.find((v: LayoutVersion) => v.status === 'DRAFT')

        // ✅ Set flag BEFORE setTicketTypes to prevent race condition
        if (activeVersion || latestDraft) {
          setHasLoadedSeats(true)
        }

        setVersions(loadedVersions)
        setTicketTypes(loadedTicketTypes)

        console.log('📊 DATA LOADED:', {
          ticketTypes: loadedTicketTypes,
          hasActiveVersion: !!activeVersion,
          hasLatestDraft: !!latestDraft,
          versionName: activeVersion?.version_name || latestDraft?.version_name,
          seatsInVersion: activeVersion?.seats_data?.length || latestDraft?.seats_data?.length || 0,
        })

        if (activeVersion) {
          loadVersion(activeVersion)
        } else if (latestDraft) {
          loadVersion(latestDraft)
        } else {
          // No versions, load seats from database
          try {
            const seatsRes = await fetch(`/api/admin/seats?eventId=${eventId}`, {
              headers: {Authorization: `Bearer ${token}`},
            })
            const seatsData = await seatsRes.json()
            if (seatsData.success && seatsData.data.seats?.length > 0) {
              console.log('📥 Loading seats from database')
              setHasLoadedSeats(true) // ✅ Mark loaded

              // Convert DB seats to layout format
              const dbSeats = seatsData.data.seats
              const convertedSeats: Seat[] = dbSeats.map((s: any) => ({
                id: s.id,
                row: s.row,
                col: parseInt(s.col),
                side: s.section === 'LEFT' ? 'left' : 'right',
                type: s.seat_type as SeatType,
                seat_number: s.seat_number,
              }))

              // Calculate config from seats
              const rows = new Set(dbSeats.map((s: any) => s.row)).size
              const leftSeats = dbSeats.filter((s: any) => s.section === 'LEFT').length / rows || 5
              const rightSeats =
                dbSeats.filter((s: any) => s.section === 'RIGHT').length / rows || 5

              setConfig({
                rows,
                leftSeats: Math.round(leftSeats),
                rightSeats: Math.round(rightSeats),
                aisleWidth: 60,
              })
              setSeats(convertedSeats)
              setCurrentVersion(null)
            } else {
              console.log('🎬 No seats in database - use "Tạo ghế" button to create layout')
              // No seats in DB - keep empty, user will click "Tạo ghế" button
              setConfig(DEFAULT_CONFIG)
              setSeats([])
              setCurrentVersion(null)
            }
          } catch (err) {
            console.error('Failed to load seats from DB:', err)
            // On error, keep empty
            setConfig(DEFAULT_CONFIG)
            setSeats([])
            setCurrentVersion(null)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      message.error('Lỗi khi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load a version
  const loadVersion = (version: LayoutVersion) => {
    console.log('📥 Loading version - RAW DATA:', {
      name: version.version_name,
      seatsCount: version.seats_data?.length,
      firstSeat: version.seats_data?.[0],
      secondSeat: version.seats_data?.[1],
      thirdSeat: version.seats_data?.[2],
      config: version.layout_config,
    })

    // Check seat structure
    const sampleSeat = version.seats_data?.[0]
    console.log('🔍 Seat structure check:', {
      hasType: 'type' in (sampleSeat || {}),
      hasSeatType: 'seat_type' in (sampleSeat || {}),
      allKeys: Object.keys(sampleSeat || {}),
    })

    // Set flag to prevent auto-regenerate
    setIsLoadingVersion(true)
    setHasLoadedSeats(true) // ✅ Mark that we loaded seats from version

    // Clear selections first
    setSelectedSeats(new Set())

    // ✅ FIX: Normalize seat data - ensure `type` field exists
    const normalizedSeats = version.seats_data.map((seat: any) => {
      // Try to find the correct type field
      let seatType = seat.type || seat.seat_type || seat.seatType

      // If still no type, default to cheapest ticket level
      if (!seatType && ticketTypes.length > 0) {
        const cheapest = ticketTypes.reduce(
          (min, tt) => (tt.level < min.level ? tt : min),
          ticketTypes[0]
        )
        seatType = `LEVEL_${cheapest.level}`
      }

      // Ultimate fallback
      if (!seatType) {
        seatType = 'LEVEL_1'
      }

      return {
        ...seat,
        type: seatType,
      }
    })

    console.log('🔧 Normalized seats:', {
      original: version.seats_data[0],
      normalized: normalizedSeats[0],
      allOriginalKeys: Object.keys(version.seats_data[0] || {}),
    })

    // Load version data
    setConfig(version.layout_config)
    setSeats(normalizedSeats) // ✅ Use normalized seats
    setCurrentVersion(version)
    setHasChanges(false)

    console.log('✅ Version loaded, seats set to:', normalizedSeats.length)

    // Reset flag after data is loaded
    setTimeout(() => {
      setIsLoadingVersion(false)
      console.log('🔓 isLoadingVersion flag cleared')
    }, 100)
  }

  useEffect(() => {
    fetchData()
    setHasInitialFetch(true)
  }, [])

  // Refetch when event changes (but skip initial fetch)
  useEffect(() => {
    if (hasInitialFetch && selectedEvent) {
      console.log('🔄 Refetching data for event:', selectedEvent)
      fetchData(selectedEvent)
    }
  }, [selectedEvent, hasInitialFetch])

  // Save draft
  const handleSaveDraft = async () => {
    if (!selectedEvent) {
      message.error('Vui lòng chọn sự kiện')
      return
    }
    if (!versionName.trim()) {
      message.error('Vui lòng nhập tên version')
      return
    }

    setSaving(true)
    try {
      const payload = {
        event_id: selectedEvent,
        version_name: versionName.trim(),
        description: versionDescription.trim() || null,
        layout_config: config,
        seats_data: seats,
      }

      const token = localStorage.getItem('token')
      let res
      if (currentVersion && currentVersion.status === 'DRAFT') {
        // Update existing draft
        res = await fetch(`/api/admin/layout-versions/${currentVersion.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
      } else {
        // Create new draft
        res = await fetch('/api/admin/layout-versions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (data.success) {
        message.success('Đã lưu draft thành công!')
        setShowSaveModal(false)
        setVersionName('')
        setVersionDescription('')
        setHasChanges(false)
        fetchData(selectedEvent)
      } else {
        message.error(data.error || 'Lỗi khi lưu draft')
      }
    } catch (error) {
      console.error('Save draft error:', error)
      message.error('Lỗi khi lưu draft')
    } finally {
      setSaving(false)
    }
  }

  // Publish version
  const handlePublish = async (versionId: string) => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/layout-versions/${versionId}/publish`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        message.success(data.message || 'Đã publish thành công!')
        setShowVersionsModal(false)
        fetchData(selectedEvent)
      } else {
        message.error(data.error || 'Lỗi khi publish')
      }
    } catch (error) {
      console.error('Publish error:', error)
      message.error('Lỗi khi publish')
    } finally {
      setSaving(false)
    }
  }

  // Delete version
  const handleDeleteVersion = async (versionId: string) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/layout-versions?id=${versionId}`, {
        method: 'DELETE',
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        message.success('Đã xóa version!')
        fetchData(selectedEvent)
      } else {
        message.error(data.error || 'Lỗi khi xóa')
      }
    } catch (error) {
      console.error('Delete error:', error)
      message.error('Lỗi khi xóa')
    }
  }

  // Handle seat click
  const handleSeatClick = (seatId: string) => {
    if (isMultiSelect) {
      // Toggle selection
      const newSelected = new Set(selectedSeats)
      if (newSelected.has(seatId)) {
        newSelected.delete(seatId)
      } else {
        newSelected.add(seatId)
      }
      setSelectedSeats(newSelected)
    } else {
      // Single click - toggle type or set to current type
      setSeats((prev) => prev.map((s) => (s.id === seatId ? {...s, type: currentType || ''} : s)))
      setHasChanges(true)
    }
  }

  // Apply type to selected seats
  const applyTypeToSelected = (type: SeatType) => {
    if (selectedSeats.size === 0) {
      message.warning('Chưa chọn ghế nào!')
      return
    }
    setSeats((prev) => prev.map((s) => (selectedSeats.has(s.id) ? {...s, type} : s)))
    setSelectedSeats(new Set())
    setHasChanges(true)
    message.success(`Đã cập nhật ${selectedSeats.size} ghế thành ${SEAT_COLORS[type].label}`)
  }

  // Select all seats
  const selectAllSeats = () => {
    setSelectedSeats(new Set(seats.map((s) => s.id)))
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedSeats(new Set())
  }

  // Select row
  const selectRow = (rowLabel: string) => {
    const rowSeats = seats.filter((s) => s.row === rowLabel)
    const newSelected = new Set(selectedSeats)
    rowSeats.forEach((s) => newSelected.add(s.id))
    setSelectedSeats(newSelected)
  }

  // Get seat stats by type
  const getSeatStats = () => {
    const stats: Record<SeatType, number> = {
      VIP: 0,
      STANDARD: 0,
      ECONOMY: 0,
      DISABLED: 0,
    }
    seats.forEach((s) => stats[s.type]++)
    return stats
  }

  // Get seat stats grouped by ticket type (level-based) - MEMOIZED
  const seatStatsByLevel = useMemo(() => {
    console.log('🔢 Calculating seatStatsByLevel:', {
      ticketTypesCount: ticketTypes.length,
      seatsCount: seats.length,
    })

    if (ticketTypes.length === 0 || seats.length === 0) {
      console.log('⚠️ Cannot calculate stats - missing data')
      return {}
    }

    const statsByLevel: Record<number, {name: string; count: number; color: string}> = {}

    const seatTypesCounts: Record<string, number> = {}
    seats.forEach((seat) => {
      if (seat.type === 'DISABLED') return

      seatTypesCounts[seat.type] = (seatTypesCounts[seat.type] || 0) + 1

      // ✅ Use new dynamic mapping
      const matchingTicket = getTicketTypeFromSeat(seat.type, ticketTypes)

      if (matchingTicket) {
        if (!statsByLevel[matchingTicket.level]) {
          statsByLevel[matchingTicket.level] = {
            name: matchingTicket.name,
            count: 0,
            color: matchingTicket.color,
          }
        }
        statsByLevel[matchingTicket.level].count++
      } else {
        console.warn(`  ❌ No matching ticket for seat type: ${seat.type}`)
      }
    })

    console.log('📈 Seat types in seats array:', seatTypesCounts)
    console.log('📊 Final stats by level:', statsByLevel)

    return statsByLevel
  }, [seats, ticketTypes])

  // Render seat component
  const renderSeat = (seat: Seat, index: number) => {
    const isSelected = selectedSeats.has(seat.id)

    // ✅ Get ticket type color dynamically
    let seatColor = '#6b7280' // default gray
    let ticketLabel = 'Unknown'

    if (seat.type === 'DISABLED') {
      seatColor = '#4b5563' // gray-600
      ticketLabel = 'Disabled'
    } else {
      const ticketInfo = getTicketTypeFromSeat(seat.type, ticketTypes)
      if (ticketInfo) {
        seatColor = ticketInfo.color
        ticketLabel = ticketInfo.name
      }
    }

    // Display full seat number (e.g., "A1", "A10")
    const displayNumber = seat.seat_number

    return (
      <Tooltip
        key={seat.id}
        title={
          <div className='text-xs'>
            <div>Ghế: {seat.seat_number}</div>
            <div>Loại: {ticketLabel}</div>
            {seat.price !== undefined && seat.price > 0 && (
              <div>Giá: {seat.price.toLocaleString('vi-VN')}đ</div>
            )}
          </div>
        }
      >
        <button
          onClick={() => handleSeatClick(seat.id)}
          className={`relative w-9 h-10 flex flex-col items-center transition-all duration-200
            ${seat.type === 'DISABLED' ? 'opacity-50' : 'hover:brightness-110 hover:scale-105'}
            ${isSelected ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-black scale-110' : ''}`}
        >
          {/* Seat back */}
          <div
            className='w-7 h-5 rounded-t-md flex items-center justify-center relative border-t border-l border-r border-white/20'
            style={{
              background: `linear-gradient(to bottom, ${seatColor}, ${seatColor})`,
            }}
          >
            <div
              className='absolute top-0 left-0 w-full h-1/2 rounded-t-md'
              style={{
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)',
              }}
            />
            <span className='relative text-[9px] font-bold text-white'>{displayNumber}</span>
          </div>
          {/* Seat cushion */}
          <div
            className='w-8 h-3 rounded-b-sm border-b border-l border-r border-white/10'
            style={{
              background: `linear-gradient(to bottom, ${seatColor}, ${seatColor})`,
            }}
          />
          {/* Armrests */}
          <div
            className='absolute bottom-0 -left-0.5 w-0.5 h-2.5 rounded-b-sm'
            style={{backgroundColor: seatColor}}
          />
          <div
            className='absolute bottom-0 -right-0.5 w-0.5 h-2.5 rounded-b-sm'
            style={{backgroundColor: seatColor}}
          />
          {/* Disabled X mark */}
          {seat.type === 'DISABLED' && (
            <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
              <div className='w-5 h-0.5 bg-red-500/80 rotate-45' />
              <div className='w-5 h-0.5 bg-red-500/80 -rotate-45 absolute' />
            </div>
          )}
        </button>
      </Tooltip>
    )
  }

  const stats = getSeatStats()

  // Group seats by row
  const getSeatsForRow = (rowLabel: string) => {
    const leftSeats = seats
      .filter((s) => s.row === rowLabel && s.side === 'left')
      .sort((a, b) => a.col - b.col)
    const rightSeats = seats
      .filter((s) => s.row === rowLabel && s.side === 'right')
      .sort((a, b) => a.col - b.col)
    return {leftSeats, rightSeats}
  }

  // Get unique rows - MEMOIZED
  const uniqueRows = useMemo(() => {
    return [...new Set(seats.map((s) => s.row))].sort((a, b) => {
      const idxA = ROW_LABELS.indexOf(a)
      const idxB = ROW_LABELS.indexOf(b)
      return idxA - idxB
    })
  }, [seats])

  return (
    <AdminLayout>
      <div className='space-y-6'>
        {/* Header */}
        <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>Thiết kế Layout Ghế</h1>
            <p className='text-gray-500'>
              Thiết lập layout và publish để đồng bộ với bảng Seats
              {currentVersion && (
                <span className='ml-2'>
                  | Version: <strong>{currentVersion.version_name}</strong>
                  {currentVersion.is_active && (
                    <Tag color='green' className='ml-1'>
                      Active
                    </Tag>
                  )}
                  {currentVersion.status === 'DRAFT' && (
                    <Tag color='orange' className='ml-1'>
                      Draft
                    </Tag>
                  )}
                </span>
              )}
            </p>
          </div>
          <Space wrap>
            <Link href='/admin/seats'>
              <Button icon={<TableOutlined />}>Quản lý Seats</Button>
            </Link>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                const eventName =
                  events.find((e) => e.id === selectedEvent)?.name || 'Unknown Event'
                const exportData = seats
                  .filter((s) => s.type !== 'DISABLED')
                  .map((seat) => ({
                    seatNumber: seat.seat_number,
                    row: seat.row,
                    col: seat.col,
                    section: seat.side === 'left' ? 'Trái' : 'Phải',
                    seatType: seat.type,
                    price: 0, // Layout editor không có giá
                    status: 'AVAILABLE',
                    eventName: eventName,
                  }))
                exportSeatsToExcel(
                  exportData,
                  `layout_${eventName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
                )
                message.success(`Đã xuất ${exportData.length} ghế ra file Excel!`)
              }}
              disabled={seats.filter((s) => s.type !== 'DISABLED').length === 0}
            >
              Xuất Excel
            </Button>
            <Button icon={<HistoryOutlined />} onClick={() => setShowVersionsModal(true)}>
              Versions ({versions.length})
            </Button>
            <Button
              icon={<CheckSquareOutlined />}
              onClick={() => {
                // Save current state to sessionStorage before opening preview
                const previewData = {
                  config,
                  seats,
                  eventId: selectedEvent,
                  versionName: currentVersion?.version_name || 'Draft',
                  timestamp: Date.now(),
                }
                sessionStorage.setItem('layout-preview-data', JSON.stringify(previewData))
                // Open layout preview page in new tab with preview mode flag
                window.open('/admin/layout-preview?mode=editor', '_blank')
              }}
            >
              Xem trước
            </Button>
            <Button
              type='primary'
              icon={<SaveOutlined />}
              onClick={() => {
                if (currentVersion?.status === 'DRAFT') {
                  setVersionName(currentVersion.version_name)
                  setVersionDescription(currentVersion.description || '')
                }
                setShowSaveModal(true)
              }}
              disabled={!hasChanges && !seats.length}
            >
              Lưu Draft
            </Button>
          </Space>
        </div>

        {/* Event Selector */}
        <Card size='small'>
          <div className='flex items-center gap-4'>
            <span className='font-medium'>Sự kiện:</span>
            <Select
              style={{width: 300}}
              value={selectedEvent}
              onChange={(v) => setSelectedEvent(v)}
              options={events.map((e) => ({label: e.name, value: e.id}))}
              placeholder='Chọn sự kiện'
              loading={loading}
            />
            {ticketTypes.length > 0 && (
              <div className='flex gap-2 ml-4'>
                <span className='text-gray-500'>Giá vé:</span>
                {ticketTypes
                  .sort((a, b) => a.level - b.level)
                  .map((tt) => (
                    <Tag key={tt.id} color={tt.color}>
                      {tt.name}: {Number(tt.price).toLocaleString('vi-VN')}đ
                    </Tag>
                  ))}
              </div>
            )}
          </div>
        </Card>

        {/* Config Panel */}
        <Card title='Cấu hình Layout' size='small'>
          {!selectedEvent && (
            <div className='mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg'>
              <span className='text-yellow-800'>⚠️ Vui lòng chọn sự kiện trước khi tạo layout</span>
            </div>
          )}
          {selectedEvent && ticketTypes.length === 0 && (
            <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
              <span className='text-red-800'>
                ❌ Sự kiện này chưa có loại vé. Vui lòng thêm loại vé tại{' '}
                <Link href='/admin/ticket-types' className='underline font-semibold'>
                  Quản lý loại vé
                </Link>
              </span>
            </div>
          )}
          <div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Số hàng</label>
              <InputNumber
                min={1}
                max={26}
                value={config.rows}
                onChange={(v) => setConfig({...config, rows: v || 1})}
                className='w-full'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Ghế bên trái</label>
              <InputNumber
                min={0}
                max={20}
                value={config.leftSeats}
                onChange={(v) => setConfig({...config, leftSeats: v || 0})}
                className='w-full'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Ghế bên phải</label>
              <InputNumber
                min={0}
                max={20}
                value={config.rightSeats}
                onChange={(v) => setConfig({...config, rightSeats: v || 0})}
                className='w-full'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Khoảng cách (px)
              </label>
              <InputNumber
                min={20}
                max={200}
                value={config.aisleWidth}
                onChange={(v) => setConfig({...config, aisleWidth: v || 60})}
                className='w-full'
              />
            </div>
            <div className='flex items-end'>
              <Button
                type='primary'
                className='w-full'
                onClick={() => {
                  if (!currentType) {
                    message.warning('⚠️ Vui lòng chọn loại vé bên dưới trước khi tạo ghế!')
                    return
                  }
                  if (currentType === 'DISABLED') {
                    message.warning("⚠️ Không thể tạo ghế với loại 'Vô hiệu'!")
                    return
                  }
                  const newSeats = generateSeatsFromConfig(config, currentType, ticketTypes)
                  setSeats(newSeats)
                  setHasChanges(true)
                  const ticketInfo = getTicketTypeFromSeat(currentType, ticketTypes)
                  message.success(
                    `Đã tạo ${newSeats.length} ghế loại ${ticketInfo?.name || currentType}`
                  )
                }}
              >
                Tạo ghế
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className='flex flex-wrap gap-4 mt-4 pt-4 border-t'>
            <span className='text-sm text-gray-500'>
              Tổng ghế: <strong className='text-blue-600'>{seats.length}</strong>
            </span>
            {Object.entries(seatStatsByLevel)
              .sort(([levelA], [levelB]) => Number(levelA) - Number(levelB))
              .map(([level, data]) => (
                <Tag key={level} style={{backgroundColor: data.color, color: '#fff'}}>
                  {data.name} (Level {level}): {data.count}
                </Tag>
              ))}
            <Tag color='default'>Vô hiệu: {stats.DISABLED}</Tag>
          </div>
        </Card>

        {/* Type Selector */}
        <Card title='Click vào ghế để đổi loại' size='small'>
          <div className='flex flex-wrap gap-3 items-center'>
            <span className='text-sm text-gray-600'>Loại ghế hiện tại:</span>
            {Array.from(
              new Map(
                ticketTypes.sort((a, b) => a.level - b.level).map((tt) => [`LEVEL_${tt.level}`, tt])
              ).values()
            ).map((tt) => (
              <Button
                key={tt.id}
                type={currentType === `LEVEL_${tt.level}` ? 'primary' : 'default'}
                style={
                  currentType === `LEVEL_${tt.level}`
                    ? {backgroundColor: tt.color, borderColor: tt.color}
                    : {}
                }
                onClick={() => setCurrentType(`LEVEL_${tt.level}` as SeatType)}
              >
                <div className='flex items-center gap-2'>
                  <div className='w-3 h-3 rounded-full' style={{backgroundColor: tt.color}}></div>
                  {tt.name}
                </div>
              </Button>
            ))}
            <Button
              type={currentType === 'DISABLED' ? 'primary' : 'default'}
              danger={currentType === 'DISABLED'}
              onClick={() => setCurrentType('DISABLED')}
            >
              ❌ Vô hiệu
            </Button>
          </div>
        </Card>

        {/* Seat Layout */}
        <Card title='Sơ đồ ghế (Click để thay đổi loại)' className='overflow-auto'>
          <div className='min-h-[500px] bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 relative overflow-hidden'>
            {/* Background effects */}
            <div className='absolute inset-0 pointer-events-none overflow-hidden'>
              <div className='absolute top-10 right-10 w-[200px] h-[200px] bg-red-600/10 rounded-full blur-3xl' />
              <div className='absolute bottom-10 left-10 w-[150px] h-[150px] bg-red-600/5 rounded-full blur-3xl' />
            </div>

            {/* Stage */}
            <div className='relative mb-8'>
              <div className='bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white py-4 px-8 rounded-xl text-center shadow-2xl shadow-red-500/30 border border-red-500/50'>
                <span className='font-black uppercase tracking-widest'>Sân Khấu</span>
              </div>
            </div>

            {/* Seats Grid */}
            <div className='space-y-2'>
              {uniqueRows.length === 0 ? (
                <div className='text-center text-gray-300 py-20'>
                  <div className='text-6xl mb-4'>🪑</div>
                  <p className='text-lg font-medium mb-2'>Chưa có ghế nào</p>
                  <p className='text-sm text-gray-500'>
                    Nhập cấu hình layout ở trên và click nút{' '}
                    <strong className='text-blue-400'>"Tạo ghế"</strong> để bắt đầu
                  </p>
                </div>
              ) : (
                uniqueRows.map((rowLabel) => {
                  const {leftSeats: left, rightSeats: right} = getSeatsForRow(rowLabel)

                  return (
                    <div key={rowLabel} className='flex items-center justify-center gap-2'>
                      {/* Row label left */}
                      <button
                        onClick={() => isMultiSelect && selectRow(rowLabel)}
                        className={`w-8 text-center font-bold text-sm ${
                          left.some((s) => s.type === 'VIP') ? 'text-orange-400' : 'text-gray-500'
                        } ${isMultiSelect ? 'hover:text-white cursor-pointer' : ''}`}
                      >
                        {rowLabel}
                      </button>

                      {/* Left seats */}
                      <div className='flex gap-1'>
                        {left.map((seat, idx) => renderSeat(seat, idx))}
                      </div>

                      {/* Aisle */}
                      <div
                        className='flex items-center justify-center text-gray-600 text-xs'
                        style={{width: config.aisleWidth}}
                      >
                        │
                      </div>

                      {/* Right seats */}
                      <div className='flex gap-1'>
                        {right.map((seat, idx) => renderSeat(seat, idx))}
                      </div>

                      {/* Row label right */}
                      <button
                        onClick={() => isMultiSelect && selectRow(rowLabel)}
                        className={`w-8 text-center font-bold text-sm ${
                          right.some((s) => s.type === 'VIP') ? 'text-orange-400' : 'text-gray-500'
                        } ${isMultiSelect ? 'hover:text-white cursor-pointer' : ''}`}
                      >
                        {rowLabel}
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Legend */}
            <div className='flex flex-wrap justify-center gap-6 mt-8 pt-6 border-t border-white/10'>
              {Array.from(
                new Map(
                  ticketTypes
                    .sort((a, b) => a.level - b.level)
                    .map((tt) => [`LEVEL_${tt.level}`, tt])
                ).values()
              ).map((tt) => {
                return (
                  <div
                    key={tt.id}
                    className='flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5'
                    style={{borderLeft: `4px solid ${tt.color}`}}
                  >
                    <div
                      className='w-6 h-6 rounded'
                      style={{
                        background: `linear-gradient(to bottom, ${tt.color}, ${tt.color})`,
                      }}
                    />
                    <span className='text-white/80 text-sm'>
                      {tt.name} (Level {tt.level})
                    </span>
                  </div>
                )
              })}
              <div className='flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5'>
                <div className='w-6 h-6 rounded bg-gradient-to-b from-gray-600 to-gray-700' />
                <span className='text-white/80 text-sm'>Vô hiệu</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Save Draft Modal */}
      <Modal
        title={currentVersion?.status === 'DRAFT' ? 'Cập nhật Draft' : 'Lưu Draft mới'}
        open={showSaveModal}
        onCancel={() => setShowSaveModal(false)}
        onOk={handleSaveDraft}
        okText='Lưu'
        cancelText='Hủy'
        confirmLoading={saving}
      >
        <div className='space-y-4 py-4'>
          <div>
            <label className='block text-sm font-medium mb-1'>Tên version *</label>
            <Input
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder='VD: Layout v1.0, Draft 2025...'
            />
          </div>
          <div>
            <label className='block text-sm font-medium mb-1'>Mô tả</label>
            <Input.TextArea
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              placeholder='Mô tả về version này...'
              rows={3}
            />
          </div>
          <div className='bg-gray-50 p-3 rounded text-sm'>
            <p>
              <strong>Layout:</strong> {config.rows} hàng × {config.leftSeats + config.rightSeats}{' '}
              ghế/hàng
            </p>
            <p>
              <strong>Tổng ghế:</strong> {seats.length}
            </p>
            <p>
              <strong>Phân loại:</strong> {getSeatStats().VIP} VIP, {getSeatStats().STANDARD}{' '}
              Standard, {getSeatStats().ECONOMY} Economy
            </p>
          </div>
        </div>
      </Modal>

      {/* Versions Modal */}
      <Modal
        title='Quản lý Versions'
        open={showVersionsModal}
        onCancel={() => setShowVersionsModal(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={versions}
          rowKey='id'
          size='small'
          pagination={false}
          columns={[
            {
              title: 'Tên version',
              dataIndex: 'version_name',
              key: 'version_name',
              render: (name: string, record: LayoutVersion) => (
                <div>
                  <strong>{name}</strong>
                  {record.description && (
                    <p className='text-gray-500 text-xs'>{record.description}</p>
                  )}
                </div>
              ),
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              key: 'status',
              width: 120,
              render: (status: string, record: LayoutVersion) => (
                <div className='space-x-1'>
                  {status === 'PUBLISHED' ? (
                    <Tag color='blue'>Published</Tag>
                  ) : (
                    <Tag color='orange'>Draft</Tag>
                  )}
                  {record.is_active && <Tag color='green'>Active</Tag>}
                </div>
              ),
            },
            {
              title: 'Ghế',
              key: 'seats',
              width: 80,
              render: (_: unknown, record: LayoutVersion) => (
                <span>{record.seats_data?.length || 0}</span>
              ),
            },
            {
              title: 'Ngày tạo',
              dataIndex: 'created_at',
              key: 'created_at',
              width: 150,
              render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
            },
            {
              title: 'Hành động',
              key: 'actions',
              width: 200,
              render: (_: unknown, record: LayoutVersion) => (
                <Space size='small'>
                  <Button
                    size='small'
                    onClick={() => {
                      loadVersion(record)
                      setShowVersionsModal(false)
                      message.success(`Đã load version: ${record.version_name}`)
                    }}
                  >
                    Load
                  </Button>
                  {record.status === 'DRAFT' && (
                    <Popconfirm
                      title='Publish version này?'
                      description='Sẽ cập nhật bảng Seats theo layout này'
                      onConfirm={() => handlePublish(record.id)}
                      okText='Publish'
                      cancelText='Hủy'
                    >
                      <Button size='small' type='primary' icon={<CloudUploadOutlined />}>
                        Publish
                      </Button>
                    </Popconfirm>
                  )}
                  {!record.is_active && (
                    <Popconfirm
                      title='Xóa version này?'
                      onConfirm={() => handleDeleteVersion(record.id)}
                      okText='Xóa'
                      cancelText='Hủy'
                    >
                      <Button size='small' danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
        {versions.length === 0 && (
          <div className='text-center py-8 text-gray-500'>
            Chưa có version nào. Tạo layout và lưu draft để bắt đầu.
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
