'use client'

import {useEffect, useState} from 'react'
import {AdminLayout} from '@/components/admin'
import {
  Table,
  Button,
  Tag,
  Space,
  Card,
  Statistic,
  Row,
  Col,
  Popconfirm,
  message,
  Select,
} from 'antd'
import {ReloadOutlined, DeleteOutlined, ClockCircleOutlined, LockOutlined} from '@ant-design/icons'
import type {ColumnsType} from 'antd/es/table'

interface SeatLock {
  id: string
  seat_id: string
  seat_number: string
  row: string
  section: string
  event_id: string
  event_name: string
  session_id: string
  expires_at: string
  created_at: string
  time_remaining: number // seconds
}

interface Event {
  id: string
  name: string
}

export default function SeatLocksPage() {
  const [locks, setLocks] = useState<SeatLock[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchLocks = async () => {
    setLoading(true)
    try {
      const url = selectedEvent
        ? `/api/admin/seat-locks?eventId=${selectedEvent}`
        : '/api/admin/seat-locks'
      const res = await fetch(url)
      const data = await res.json()

      console.log('[SEAT LOCKS] Full API response:', data)

      if (data.success) {
        console.log('[SEAT LOCKS] Fetched locks:', data.data.locks)
        console.log('[SEAT LOCKS] Total locks:', data.data.locks?.length)
        setLocks(data.data.locks || [])
        setEvents(data.data.events || [])
      } else {
        console.error('[SEAT LOCKS] API error:', data.error)
        message.error(data.error || 'Không thể tải dữ liệu')
      }
    } catch (error) {
      console.error('Fetch locks error:', error)
      message.error('Lỗi khi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlock = async (lockId: string, seatNumber: string) => {
    setActionLoading(lockId)
    try {
      const res = await fetch(`/api/admin/seat-locks/${lockId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (data.success) {
        message.success(`Đã giải phóng ghế ${seatNumber}`)
        fetchLocks()
      } else {
        message.error(data.error || 'Không thể giải phóng ghế')
      }
    } catch (error) {
      console.error('Unlock error:', error)
      message.error('Lỗi khi giải phóng ghế')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnlockAll = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/seat-locks/clear-all', {
        method: 'POST',
      })
      const data = await res.json()

      if (data.success) {
        message.success(`Đã giải phóng ${data.data.count} ghế`)
        fetchLocks()
      } else {
        message.error(data.error || 'Không thể giải phóng ghế')
      }
    } catch (error) {
      console.error('Unlock all error:', error)
      message.error('Lỗi khi giải phóng ghế')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocks()
    // Auto refresh every 5 seconds
    const interval = setInterval(fetchLocks, 5000)
    return () => clearInterval(interval)
  }, [selectedEvent])

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Đã hết hạn'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const columns: ColumnsType<SeatLock> = [
    {
      title: 'Ghế',
      dataIndex: 'seat_number',
      key: 'seat_number',
      width: 100,
      render: (text, record) => (
        <div>
          <div className='font-semibold'>{text}</div>
          <div className='text-xs text-gray-500'>
            {record.row} - {record.section}
          </div>
        </div>
      ),
    },
    {
      title: 'Sự kiện',
      dataIndex: 'event_name',
      key: 'event_name',
      width: 200,
    },
    {
      title: 'Session ID',
      dataIndex: 'session_id',
      key: 'session_id',
      width: 200,
      render: (text) => (
        <code className='text-xs bg-gray-100 px-2 py-1 rounded'>{text.substring(0, 20)}...</code>
      ),
    },
    {
      title: 'Thời gian còn lại',
      dataIndex: 'time_remaining',
      key: 'time_remaining',
      width: 150,
      sorter: (a, b) => a.time_remaining - b.time_remaining,
      render: (seconds) => {
        const isExpired = seconds <= 0
        const isExpiringSoon = seconds > 0 && seconds < 60
        return (
          <Tag
            color={isExpired ? 'red' : isExpiringSoon ? 'orange' : 'green'}
            icon={<ClockCircleOutlined />}
          >
            {formatTimeRemaining(seconds)}
          </Tag>
        )
      },
    },
    {
      title: 'Thời gian tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => new Date(text).toLocaleString('vi-VN'),
    },
    {
      title: 'Hết hạn lúc',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 180,
      render: (text) => new Date(text).toLocaleString('vi-VN'),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Popconfirm
          title='Giải phóng ghế'
          description={`Bạn có chắc muốn giải phóng ghế ${record.seat_number}?`}
          onConfirm={() => handleUnlock(record.id, record.seat_number)}
          okText='Giải phóng'
          cancelText='Hủy'
        >
          <Button
            size='small'
            danger
            icon={<DeleteOutlined />}
            loading={actionLoading === record.id}
          >
            Giải phóng
          </Button>
        </Popconfirm>
      ),
    },
  ]

  const activeLocks = locks.filter((l) => l.time_remaining > 0)
  const expiredLocks = locks.filter((l) => l.time_remaining <= 0)

  console.log('[SEAT LOCKS RENDER] locks:', locks)
  console.log('[SEAT LOCKS RENDER] locks.length:', locks.length)

  return (
    <AdminLayout>
      <div className='space-y-6'>
        {/* Header */}
        <div className='flex justify-between items-center'>
          <div>
            <h1 className='text-2xl font-bold'>Quản lý Seat Locks</h1>
            <p className='text-gray-600 mt-1'>Xem và quản lý ghế đang được giữ bởi khách hàng</p>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchLocks} loading={loading}>
              Làm mới
            </Button>
            {locks.length > 0 && (
              <Popconfirm
                title='Giải phóng tất cả ghế'
                description='Bạn có chắc muốn giải phóng TẤT CẢ ghế đang bị lock?'
                onConfirm={handleUnlockAll}
                okText='Giải phóng tất cả'
                cancelText='Hủy'
                okButtonProps={{danger: true}}
              >
                <Button danger icon={<DeleteOutlined />} loading={loading}>
                  Giải phóng tất cả
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>

        {/* Statistics */}
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title='Tổng ghế đang lock'
                value={locks.length}
                prefix={<LockOutlined />}
                valueStyle={{color: '#1890ff'}}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title='Ghế còn hiệu lực'
                value={activeLocks.length}
                prefix={<ClockCircleOutlined />}
                valueStyle={{color: '#52c41a'}}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title='Ghế đã hết hạn'
                value={expiredLocks.length}
                prefix={<ClockCircleOutlined />}
                valueStyle={{color: '#ff4d4f'}}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card>
          <Space>
            <span>Lọc theo sự kiện:</span>
            <Select
              style={{width: 300}}
              placeholder='Tất cả sự kiện'
              allowClear
              value={selectedEvent}
              onChange={setSelectedEvent}
              options={events.map((e) => ({label: e.name, value: e.id}))}
            />
          </Space>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={locks}
            rowKey='id'
            loading={loading}
            scroll={{x: 1200}}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} ghế`,
            }}
          />
        </Card>
      </div>
    </AdminLayout>
  )
}
