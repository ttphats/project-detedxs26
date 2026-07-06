'use client'

import {useState, useEffect} from 'react'
import {AdminLayout} from '@/components/admin'
import {Card, Button, Modal, message, Alert, Space, Divider, Input, Tag, Typography} from 'antd'
import {
  ExclamationCircleOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  WarningOutlined,
  MailOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
} from '@ant-design/icons'

const {Text, Title} = Typography

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

  // Load notification emails on mount
  useEffect(() => {
    loadOnDutyEmail()
    loadNotificationEmails()
  }, [])

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
      message.success('\u0110\u00e3 c\u1eadp nh\u1eadt email tr\u1ef1c ca! / On-duty email updated!')
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
      <div className='p-6'>
        <h1 className='text-2xl font-bold mb-6'>Cài đặt hệ thống</h1>

        {/* On-Duty Staff Email */}
        <Card
          title={
            <Space>
              <MailOutlined style={{color: '#dc2626'}} />
              <span>Email Nhân viên Trực ca / Current On-Duty Staff Email</span>
            </Space>
          }
          className='mb-6'
          style={{borderTop: '3px solid #dc2626'}}
        >
          <Alert
            description='Email này sẽ nhận thông báo ngay khi admin xác nhận thanh toán. Cập nhật mỗi ca trực. / This email receives an instant alert each time an admin confirms a payment. Update at the start of each shift.'
            type='warning'
            showIcon
            className='mb-4'
          />
          {onDutyEmailLoading ? (
            <Text type='secondary'>Đang tải... / Loading...</Text>
          ) : (
            <>
              <div className='flex gap-2 mb-2'>
                <Input
                  id='on-duty-email-input'
                  type='email'
                  placeholder='staff@example.com'
                  value={onDutyEmailInput}
                  onChange={(e) => setOnDutyEmailInput(e.target.value)}
                  onPressEnter={handleSaveOnDutyEmail}
                  prefix={<MailOutlined style={{color: '#dc2626'}} />}
                  style={{maxWidth: 420}}
                  status={onDutyEmailInput && onDutyEmailInput !== onDutyEmail ? 'warning' : ''}
                />
                <Button
                  id='on-duty-email-save-btn'
                  type='primary'
                  danger
                  icon={<SaveOutlined />}
                  loading={onDutyEmailSaving}
                  onClick={handleSaveOnDutyEmail}
                  disabled={onDutyEmailInput === onDutyEmail}
                >
                  Cập nhật / Update
                </Button>
              </div>
              {onDutyEmail && (
                <Text type='secondary' style={{fontSize: 12}}>
                  Hiện tại / Current: <strong>{onDutyEmail}</strong>
                </Text>
              )}
              {!onDutyEmail && (
                <Text type='secondary' italic style={{fontSize: 12}}>
                  Chưa có email trực ca. / No on-duty email set.
                </Text>
              )}
            </>
          )}
        </Card>

        {/* Notification Emails */}
        <Card
          title={
            <Space>
              <MailOutlined style={{color: '#1677ff'}} />
              <span>Email nhận thông báo đơn hàng / Order Notification Emails</span>
            </Space>
          }
          className='mb-6'
        >
          <Alert
            description='Khi có đơn hàng mới (PENDING), hệ thống sẽ tự động gửi thông báo đến các email bên dưới. / When a new order is created, the system will automatically send notifications to the emails below.'
            type='info'
            showIcon
            className='mb-4'
          />

          {/* Email list */}
          <div className='mb-4'>
            <Text strong className='block mb-2'>
              Danh sách email / Email list:
            </Text>
            {emailsLoading ? (
              <Text type='secondary'>Đang tải... / Loading...</Text>
            ) : notificationEmails.length === 0 ? (
              <Text type='secondary' italic>
                Chưa có email nào. Thêm email để nhận thông báo đơn hàng mới. / No emails configured.
                Add emails to receive new order notifications.
              </Text>
            ) : (
              <div className='flex flex-wrap gap-2'>
                {notificationEmails.map((email) => (
                  <Tag
                    key={email}
                    closable
                    onClose={() => handleRemoveEmail(email)}
                    color='blue'
                    style={{fontSize: 14, padding: '4px 12px'}}
                  >
                    <MailOutlined style={{marginRight: 4}} />
                    {email}
                  </Tag>
                ))}
              </div>
            )}
          </div>

          {/* Add new email */}
          <div className='flex gap-2 mb-4'>
            <Input
              placeholder='Nhập email... / Enter email...'
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onPressEnter={handleAddEmail}
              prefix={<MailOutlined style={{color: '#bfbfbf'}} />}
              style={{maxWidth: 400}}
            />
            <Button type='dashed' icon={<PlusOutlined />} onClick={handleAddEmail}>
              Thêm / Add
            </Button>
          </div>

          {/* Save button */}
          {emailsChanged && (
            <Button
              type='primary'
              icon={<SaveOutlined />}
              loading={emailsSaving}
              onClick={handleSaveEmails}
              size='large'
            >
              Lưu thay đổi / Save Changes
            </Button>
          )}
        </Card>

        {/* Database Management */}
        <Card title='Quản lý Database' className='mb-6'>
          <Alert
            title='Cảnh báo'
            description='Reset data sẽ xóa tất cả đơn hàng, seat locks và khôi phục về trạng thái mặc định. Thao tác này không thể hoàn tác!'
            type='warning'
            icon={<WarningOutlined />}
            showIcon
            className='mb-4'
          />

          <div className='mb-4'>
            <h3 className='font-semibold mb-2'>Reset Data sẽ:</h3>
            <ul className='list-disc list-inside space-y-1 text-gray-600'>
              <li>✅ Giữ nguyên: Events, Ticket Types, Email Templates</li>
              <li>✅ Giữ nguyên: Tài khoản admin và users</li>
              <li>🗑️ Xóa tất cả: Orders (đơn hàng)</li>
              <li>🗑️ Xóa tất cả: Seat Locks (ghế đang giữ)</li>
              <li>🗑️ Xóa tất cả: Email Logs</li>
              <li>🗑️ Xóa tất cả: Layout Versions (phiên bản layout)</li>
              <li>
                🔄 Reset: Tạo lại 100 ghế mới (10 rows x 10 seats với LEFT/RIGHT sections) - Tất cả
                ghế có vé Level 1 (rẻ nhất)
              </li>
            </ul>
          </div>

          <Button
            type='primary'
            danger
            size='large'
            icon={<ReloadOutlined />}
            onClick={() => setConfirmModal(true)}
          >
            Reset Data về V1
          </Button>
        </Card>

        {/* Database Info */}
        <Card
          title={
            <>
              <DatabaseOutlined /> Thông tin Database
            </>
          }
        >
          <Space orientation='vertical' size='small'>
            <div>
              <strong>Môi trường:</strong> {process.env.NODE_ENV || 'development'}
            </div>
            <div>
              <strong>Database:</strong> MySQL
            </div>
          </Space>
        </Card>

        {/* Confirmation Modal */}
        <Modal
          title={
            <Space>
              <ExclamationCircleOutlined style={{color: '#ff4d4f', fontSize: 24}} />
              <span>Xác nhận Reset Data</span>
            </Space>
          }
          open={confirmModal}
          onCancel={() => setConfirmModal(false)}
          footer={[
            <Button key='cancel' onClick={() => setConfirmModal(false)}>
              Hủy
            </Button>,
            <Button
              key='confirm'
              type='primary'
              danger
              loading={resetLoading}
              onClick={handleResetData}
            >
              Xác nhận Reset
            </Button>,
          ]}
        >
          <Alert
            title='Cảnh báo nghiêm trọng'
            description='Bạn có chắc chắn muốn reset tất cả data về trạng thái mặc định? Thao tác này sẽ XÓA TẤT CẢ đơn hàng và không thể hoàn tác!'
            type='error'
            showIcon
            className='mb-4'
          />
          <p className='text-gray-600'>
            Vui lòng gõ <strong className='text-red-500'>RESET</strong> để xác nhận (tính năng này
            sẽ được thêm vào sau)
          </p>
        </Modal>
      </div>
    </AdminLayout>
  )
}
