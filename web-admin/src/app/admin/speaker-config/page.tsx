'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/admin'
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Table,
  Modal,
  Select,
  Switch,
  InputNumber,
  Space,
  Popconfirm,
  message,
  Tag,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SettingOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface SpeakerFormField {
  id: string
  name: string
  label: string
  type: 'text' | 'textarea' | 'email' | 'phone' | 'number'
  is_required: boolean
  placeholder: string | null
  options: string | null
  sort_order: number
}

interface SpeakerConfig {
  id?: string
  title: string
  description: string | null
  rules: string[]
}

export default function SpeakerConfigPage() {
  const [activeTab, setActiveTab] = useState('1')
  const [configLoading, setConfigLoading] = useState(true)
  const [fieldsLoading, setFieldsLoading] = useState(true)
  const [config, setConfig] = useState<SpeakerConfig | null>(null)
  const [fields, setFields] = useState<SpeakerFormField[]>([])
  
  // Field Modal states
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [fieldForm] = Form.useForm()
  const [configForm] = Form.useForm()

  const fetchConfig = async () => {
    setConfigLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/speakers/register/config', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success && data.data) {
        setConfig(data.data)
        configForm.setFieldsValue({
          title: data.data.title,
          description: data.data.description,
          rules: data.data.rules && data.data.rules.length > 0 ? data.data.rules : ['']
        })
      }
    } catch (error) {
      console.error('Failed to fetch config:', error)
      message.error('Failed to load rules configuration')
    } finally {
      setConfigLoading(false)
    }
  }

  const fetchFields = async () => {
    setFieldsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/speakers/register/fields', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success && data.data) {
        setFields(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch fields:', error)
      message.error('Failed to load input fields')
    } finally {
      setFieldsLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
    fetchFields()
  }, [])

  const handleConfigSubmit = async (values: any) => {
    setConfigLoading(true)
    try {
      const token = localStorage.getItem('token')
      // Clean up empty rules
      const cleanedRules = (values.rules || []).filter((r: string) => r && r.trim() !== '')
      
      const res = await fetch('/api/admin/speakers/register/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          rules: cleanedRules
        }),
      })
      const data = await res.json()
      if (data.success) {
        message.success('Rules configuration updated successfully')
        fetchConfig()
      } else {
        message.error(data.error || 'Update failed')
      }
    } catch (error) {
      message.error('An error occurred while saving configuration')
    } finally {
      setConfigLoading(false)
    }
  }

  const handleFieldSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem('token')
      const payload = {
        ...values,
        is_required: !!values.is_required
      }

      if (editingFieldId) {
        const res = await fetch(`/api/admin/speakers/register/fields/${editingFieldId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          message.success('Field updated successfully')
          setIsFieldModalOpen(false)
          setEditingFieldId(null)
          fetchFields()
        } else {
          message.error(data.error || 'Update failed')
        }
      } else {
        const res = await fetch('/api/admin/speakers/register/fields', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          message.success('Field added successfully')
          setIsFieldModalOpen(false)
          fetchFields()
        } else {
          message.error(data.error || 'Failed to add field')
        }
      }
    } catch (error) {
      message.error('An error occurred while saving the field')
    }
  }

  const handleToggleRequired = async (id: string, is_required: boolean) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/speakers/register/fields/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_required }),
      })
      const data = await res.json()
      if (data.success) {
        fetchFields()
      } else {
        message.error(data.error || 'Update failed')
      }
    } catch (error) {
      message.error('An error occurred')
    }
  }

  const handleDeleteField = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/speakers/register/fields/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        message.success('Field deleted successfully')
        fetchFields()
      } else {
        message.error(data.error || 'Cannot delete field')
      }
    } catch (error) {
      message.error('An error occurred')
    }
  }

  const handleEditField = (record: SpeakerFormField) => {
    setEditingFieldId(record.id)
    fieldForm.setFieldsValue(record)
    setIsFieldModalOpen(true)
  }

  const getFieldTypeTag = (type: string) => {
    const types: Record<string, { color: string; label: string }> = {
      text: { color: 'blue', label: 'Text' },
      textarea: { color: 'purple', label: 'Long Text' },
      email: { color: 'cyan', label: 'Email' },
      phone: { color: 'green', label: 'Phone Number' },
      number: { color: 'orange', label: 'Number' },
    }
    const match = types[type] || { color: 'default', label: type }
    return <Tag color={match.color}>{match.label}</Tag>
  }

  const columns: ColumnsType<SpeakerFormField> = [
    {
      title: 'Field Key (ID)',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name) => <code className="bg-gray-100 text-red-500 px-1.5 py-0.5 rounded font-mono text-xs">{name}</code>
    },
    {
      title: 'Display Label',
      dataIndex: 'label',
      key: 'label',
      width: 200,
      render: (text) => <span className="font-semibold text-gray-900">{text}</span>
    },
    {
      title: 'Input Type',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (type) => getFieldTypeTag(type)
    },
    {
      title: 'Placeholder',
      dataIndex: 'placeholder',
      key: 'placeholder',
      width: 250,
      render: (text) => <span className="text-gray-500 text-xs italic">{text || 'N/A'}</span>
    },
    {
      title: 'Sort Order',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 100,
    },
    {
      title: 'Required',
      dataIndex: 'is_required',
      key: 'is_required',
      width: 120,
      render: (required, record) => (
        <Switch checked={required} onChange={(checked) => handleToggleRequired(record.id, checked)} />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditField(record)} />
          <Popconfirm
            title="Delete this field?"
            description="This might affect previously submitted applications."
            onConfirm={() => handleDeleteField(record.id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Speaker Form Configuration</h1>
            <p className="text-gray-600 mt-1">Manage rules and design input fields for the speaker application form</p>
          </div>
          <Button
            type="default"
            onClick={() => window.location.href = '/admin/speaker-submissions'}
          >
            ← Back to Applications
          </Button>
        </div>

        {/* Navigation Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          items={[
            {
              key: '1',
              label: '1. Rules & Introduction Config',
              children: (
                <Card loading={configLoading}>
                  <Form
                    form={configForm}
                    layout="vertical"
                    onFinish={handleConfigSubmit}
                  >
                    <Form.Item
                      name="title"
                      label="Page Title"
                      rules={[{ required: true, message: 'Please enter page title' }]}
                    >
                      <Input placeholder="Ex: Become a Speaker for TEDxFPTUniversityHCMC 2026" />
                    </Form.Item>

                    <Form.Item
                      name="description"
                      label="Short Introduction"
                    >
                      <Input.TextArea rows={3} placeholder="Short description to encourage potential speakers..." />
                    </Form.Item>

                    <Form.List name="rules">
                      {(rules, { add, remove }) => (
                        <div className="space-y-4">
                          <label className="block text-sm font-semibold text-gray-700">Application Rules</label>
                          {rules.map((rule, index) => {
                            const { key, ...restRule } = rule;
                            return (
                              <Form.Item
                                required={false}
                                key={key}
                                className="mb-2"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-500 font-bold w-6">{index + 1}.</span>
                                  <Form.Item
                                    {...restRule}
                                    validateTrigger={['onChange', 'onBlur']}
                                    rules={[{ required: true, whitespace: true, message: "Please fill in the rule or delete this row" }]}
                                    noStyle
                                  >
                                    <Input placeholder="Enter a new rule..." style={{ width: '90%' }} />
                                  </Form.Item>
                                  {rules.length > 1 ? (
                                    <MinusCircleOutlined
                                      className="dynamic-delete-button text-red-500 hover:text-red-400 text-lg cursor-pointer"
                                      onClick={() => remove(rule.name)}
                                    />
                                  ) : null}
                                </div>
                              </Form.Item>
                            )})}
                          <Form.Item>
                            <Button
                              type="dashed"
                              onClick={() => add()}
                              icon={<PlusOutlined />}
                              className="w-full sm:w-1/3"
                            >
                              Add Rule
                            </Button>
                          </Form.Item>
                        </div>
                      )}
                    </Form.List>

                    <Form.Item className="mt-8 border-t pt-6 mb-0">
                      <Space>
                        <Button type="primary" htmlType="submit" style={{ backgroundColor: '#e62b1e' }}>
                          Save Configuration
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={fetchConfig}>
                          Reload
                        </Button>
                      </Space>
                    </Form.Item>
                  </Form>
                </Card>
              )
            },
            {
              key: '2',
              label: '2. Dynamic Form Builder',
              children: (
                <Card>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-0">List of Input Fields</h3>
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={fetchFields}>
                        Refresh
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setEditingFieldId(null)
                          fieldForm.resetFields()
                          fieldForm.setFieldsValue({ sort_order: fields.length + 1, is_required: true })
                          setIsFieldModalOpen(true)
                        }}
                        style={{ backgroundColor: '#e62b1e' }}
                      >
                        Add Field
                      </Button>
                    </Space>
                  </div>

                  <Table
                    columns={columns}
                    dataSource={fields}
                    rowKey="id"
                    loading={fieldsLoading}
                    pagination={false}
                  />
                </Card>
              )
            }
          ]}
        />

        {/* Modal Form Builder */}
        <Modal
          title={editingFieldId ? 'Edit Input Field' : 'Add New Input Field'}
          open={isFieldModalOpen}
          onCancel={() => {
            setIsFieldModalOpen(false)
            setEditingFieldId(null)
          }}
          footer={null}
          width={550}
          forceRender
        >
          <Form
            form={fieldForm}
            layout="vertical"
            onFinish={handleFieldSubmit}
          >
            <Form.Item
              name="name"
              label="Field Name (ID Key - No Spaces)"
              rules={[
                { required: true, message: 'Please enter a field key' },
                { pattern: /^[a-zA-Z0-9_]+$/, message: 'Only alphanumeric characters or underscores allowed' }
              ]}
            >
              <Input placeholder="Ex: fullName, email, projectLink, selfIntro..." disabled={!!editingFieldId} />
            </Form.Item>

            <Form.Item
              name="label"
              label="Display Label"
              rules={[{ required: true, message: 'Please enter the display label' }]}
            >
              <Input placeholder="Ex: Full Name, Introduction Video Link..." />
            </Form.Item>

            <Form.Item
              name="type"
              label="Input Type"
              rules={[{ required: true, message: 'Please select an input type' }]}
            >
              <Select placeholder="Select input type">
                <Select.Option value="text">Text Box (Short text)</Select.Option>
                <Select.Option value="textarea">Text Area (Multiple lines)</Select.Option>
                <Select.Option value="email">Email Input</Select.Option>
                <Select.Option value="phone">Phone Input</Select.Option>
                <Select.Option value="number">Number Box</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="placeholder" label="Placeholder Text">
              <Input placeholder="Faded text shown inside the input box..." />
            </Form.Item>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="sort_order" label="Sort Order">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="is_required" label="Required" valuePropName="checked">
                <Switch />
              </Form.Item>
            </div>

            <Form.Item name="options" label="Additional Options (Optional)">
              <Input.TextArea placeholder="Additional config if any..." rows={2} />
            </Form.Item>

            <Form.Item className="mb-0 mt-6">
              <Space className="w-full justify-end">
                <Button onClick={() => setIsFieldModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" style={{ backgroundColor: '#e62b1e' }}>
                  {editingFieldId ? 'Update' : 'Create'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AdminLayout>
  )
}
