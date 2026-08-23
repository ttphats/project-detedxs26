'use client'

import {useState, useEffect} from 'react'
import {AdminLayout} from '@/components/admin'
import {Card, Button, Modal, message, Input, Tag, Typography, Radio} from 'antd'
import {ReloadOutlined, MailOutlined, PlusOutlined, SaveOutlined} from '@ant-design/icons'

const {Text} = Typography

export default function SettingsPage() {
  const [resetLoading, setResetLoading] = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)

  // On-duty staff email state
  const [onDutyEmail, setOnDutyEmail] = useState('')
  const [onDutyEmailInput, setOnDutyEmailInput] = useState('')
  const [onDutyEmailLoading, setOnDutyEmailLoading] = useState(true)
  const [onDutyEmailSaving, setOnDutyEmailSaving] = useState(false)

  // Notification emails state
  const [notificationEmails, setNotificationEmails] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [emailsLoading, setEmailsLoading] = useState(true)
  const [emailsSaving, setEmailsSaving] = useState(false)
  const [emailsChanged, setEmailsChanged] = useState(false)

  const [salesOverride, setSalesOverride] = useState<'auto' | 'open' | 'closed'>('auto')
  const [opensAtLocal, setOpensAtLocal] = useState('')
  const [salesLoading, setSalesLoading] = useState(true)
  const [salesSaving, setSalesSaving] = useState(false)

  // Load notification emails on mount
  useEffect(() => {
    loadOnDutyEmail()
    loadNotificationEmails()
    loadTicketSales()
  }, [])

  const toDatetimeLocal = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const loadTicketSales = async () => {
    setSalesLoading(true)
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
      const res = await fetch(`${apiUrl}/admin/settings/ticket-sales`, {
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        const next = data.data.override
        setSalesOverride(next === 'open' || next === 'closed' ? next : 'auto')
        setOpensAtLocal(toDatetimeLocal(data.data.opensAt))
      }
    } catch (err) {
      console.error('Failed to load ticket sales:', err)
    } finally {
      setSalesLoading(false)
    }
  }

  const handleSaveTicketSales = async () => {
    if (!opensAtLocal) {
      message.error('Vui lòng chọn thời điểm mở bán / Please pick an open time')
      return
    }
    const parsed = new Date(opensAtLocal)
    if (Number.isNaN(parsed.getTime())) {
      message.error('Thời gian không hợp lệ / Invalid date-time')
      return
    }
    setSalesSaving(true)
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
      const res = await fetch(`${apiUrl}/admin/settings/ticket-sales`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          override: salesOverride,
          opensAt: parsed.toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save')
      }
      const next = data.data.override
      setSalesOverride(next === 'open' || next === 'closed' ? next : 'auto')
      setOpensAtLocal(toDatetimeLocal(data.data.opensAt))
      message.success('Đã lưu cấu hình bán vé! / Ticket sales setup saved!')
    } catch (err: any) {
      message.error(err.message || 'Lỗi khi lưu / Error saving')
    } finally {
      setSalesSaving(false)
    }
  }

  const loadOnDutyEmail = async () => {
    setOnDutyEmailLoading(true)
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
      const res = await fetch(`${apiUrl}/admin/settings/on-duty-email`, {
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        const val = data.data.email || ''
        setOnDutyEmail(val)
        setOnDutyEmailInput(val)
      }
    } catch (err) {
      console.error('Failed to load on-duty email:', err)
    } finally {
      setOnDutyEmailLoading(false)
    }
  }

  const handleSaveOnDutyEmail = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const trimmed = onDutyEmailInput.trim()
    if (trimmed.length > 0 && !emailRegex.test(trimmed)) {
      message.error('Email kh\u00f4ng h\u1ee3p l\u1ec7 / Invalid email format')
      return
    }
    setOnDutyEmailSaving(true)
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
      const res = await fetch(`${apiUrl}/admin/settings/on-duty-email`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({email: trimmed}),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save')
      }
      const saved = data.data.email || ''
      setOnDutyEmail(saved)
      setOnDutyEmailInput(saved)
      message.success(
        '\u0110\u00e3 c\u1eadp nh\u1eadt email tr\u1ef1c ca! / On-duty email updated!'
      )
    } catch (err: any) {
      message.error(err.message || 'L\u1ed7i khi l\u01b0u / Error saving')
    } finally {
      setOnDutyEmailSaving(false)
    }
  }

  const loadNotificationEmails = async () => {
    setEmailsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
      const res = await fetch(`${apiUrl}/admin/settings/notification-emails`, {
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        setNotificationEmails(data.data.emails || [])
      }
    } catch (err) {
      console.error('Failed to load notification emails:', err)
    } finally {
      setEmailsLoading(false)
    }
  }

  const handleAddEmail = () => {
    const email = newEmail.trim()
    if (!email) return

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      message.error('Email không hợp lệ / Invalid email format')
      return
    }

    // Check duplicate
    if (notificationEmails.includes(email)) {
      message.warning('Email đã tồn tại / Email already exists')
      return
    }

    setNotificationEmails([...notificationEmails, email])
    setNewEmail('')
    setEmailsChanged(true)
  }

  const handleRemoveEmail = (emailToRemove: string) => {
    setNotificationEmails(notificationEmails.filter((e) => e !== emailToRemove))
    setEmailsChanged(true)
  }

  const handleSaveEmails = async () => {
    setEmailsSaving(true)
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
      const res = await fetch(`${apiUrl}/admin/settings/notification-emails`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({emails: notificationEmails}),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save')
      }

      setNotificationEmails(data.data.emails)
      setEmailsChanged(false)
      message.success('Đã lưu danh sách email thông báo! / Notification emails saved!')
    } catch (err: any) {
      message.error(err.message || 'Lỗi khi lưu / Error saving')
    } finally {
      setEmailsSaving(false)
    }
  }

  const handleResetData = async () => {
    setResetLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/settings/reset-data', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Reset data failed')
      }

      message.success('Reset data thành công! Database đã về trạng thái mặc định.')
      setConfirmModal(false)

      // Reload page after 2 seconds
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error: any) {
      message.error(error.message || 'Có lỗi xảy ra khi reset data')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Settings</h1>
          <p className='text-gray-600 mt-1'>Ticket sales, notifications, and system tools</p>
        </div>

        <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>
          <Card title='Ticket sales'>
            {salesLoading ? (
              <Text type='secondary'>Loading...</Text>
            ) : (
              <div className='space-y-4'>
                <div>
                  <Text type='secondary' className='block mb-2'>
                    Mode
                  </Text>
                  <Radio.Group
                    value={salesOverride}
                    onChange={(e) => setSalesOverride(e.target.value)}
                    options={[
                      {value: 'auto', label: 'Auto'},
                      {value: 'open', label: 'Open now'},
                      {value: 'closed', label: 'Keep closed'},
                    ]}
                  />
                </div>
                <div>
                  <Text type='secondary' className='block mb-2'>
                    Open at
                  </Text>
                  <div className='flex flex-wrap gap-2'>
                    <Input
                      type='datetime-local'
                      value={opensAtLocal}
                      onChange={(e) => setOpensAtLocal(e.target.value)}
                      style={{maxWidth: 240}}
                    />
                    <Button
                      icon={<SaveOutlined />}
                      loading={salesSaving}
                      onClick={handleSaveTicketSales}
                    >
                      Save
                    </Button>
                  </div>
                </div>
                <Text type='secondary'>
                  Auto opens when the time is reached. Use Open now or Keep closed to test.
                </Text>
              </div>
            )}
          </Card>

          <Card title='On-duty email'>
            <Text type='secondary' className='block mb-3'>
              Gets an alert when a customer starts checkout.
            </Text>
            {onDutyEmailLoading ? (
              <Text type='secondary'>Loading...</Text>
            ) : (
              <div className='flex flex-wrap gap-2'>
                <Input
                  type='email'
                  placeholder='staff@example.com'
                  value={onDutyEmailInput}
                  onChange={(e) => setOnDutyEmailInput(e.target.value)}
                  onPressEnter={handleSaveOnDutyEmail}
                  prefix={<MailOutlined />}
                  style={{maxWidth: 320}}
                />
                <Button
                  icon={<SaveOutlined />}
                  loading={onDutyEmailSaving}
                  onClick={handleSaveOnDutyEmail}
                  disabled={onDutyEmailInput === onDutyEmail}
                >
                  Save
                </Button>
              </div>
            )}
          </Card>
        </div>

        <Card title='Order notification emails'>
          <Text type='secondary' className='block mb-4'>
            These addresses get a copy when a new order is created.
          </Text>
          {emailsLoading ? (
            <Text type='secondary'>Loading...</Text>
          ) : (
            <div className='space-y-4'>
              {notificationEmails.length === 0 ? (
                <Text type='secondary'>No emails yet.</Text>
              ) : (
                <div className='flex flex-wrap gap-2'>
                  {notificationEmails.map((email) => (
                    <Tag key={email} closable onClose={() => handleRemoveEmail(email)}>
                      {email}
                    </Tag>
                  ))}
                </div>
              )}
              <div className='flex flex-wrap gap-2'>
                <Input
                  placeholder='name@example.com'
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onPressEnter={handleAddEmail}
                  prefix={<MailOutlined />}
                  style={{maxWidth: 320}}
                />
                <Button icon={<PlusOutlined />} onClick={handleAddEmail}>
                  Add
                </Button>
                {emailsChanged && (
                  <Button
                    type='primary'
                    icon={<SaveOutlined />}
                    loading={emailsSaving}
                    onClick={handleSaveEmails}
                  >
                    Save changes
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card title='Database'>
          <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'>
            <div>
              <p className='text-gray-900 font-medium'>Reset operational data</p>
              <p className='text-gray-500 text-sm mt-1 max-w-xl'>
                Deletes orders, seat locks, email logs, and layout versions. Events, tickets,
                templates, and accounts stay. Cannot be undone.
              </p>
              <p className='text-gray-400 text-sm mt-3'>
                {process.env.NODE_ENV || 'development'} · MySQL
              </p>
            </div>
            <Button danger icon={<ReloadOutlined />} onClick={() => setConfirmModal(true)}>
              Reset data
            </Button>
          </div>
        </Card>

        <Modal
          title='Reset data?'
          open={confirmModal}
          onCancel={() => setConfirmModal(false)}
          okText='Reset'
          okButtonProps={{danger: true, loading: resetLoading}}
          onOk={handleResetData}
        >
          <p className='text-gray-600'>
            This permanently deletes all orders and seat locks, then restores a default seat layout.
          </p>
        </Modal>
      </div>
    </AdminLayout>
  )
}
