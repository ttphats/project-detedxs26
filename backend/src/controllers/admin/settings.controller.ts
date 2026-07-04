import { FastifyRequest, FastifyReply } from 'fastify'
import { successResponse } from '../../utils/helpers.js'
import { BadRequestError } from '../../utils/errors.js'
import * as settingsService from '../../services/settings.service.js'

// GET /admin/settings
export async function getSettings(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const settings = await settingsService.getAllSettings()
  return reply.send(successResponse(settings))
}

// PUT /admin/settings
export async function updateSettings(
  request: FastifyRequest<{
    Body: Record<string, string>
  }>,
  reply: FastifyReply
) {
  const body = request.body

  if (!body || typeof body !== 'object') {
    throw new BadRequestError('Invalid settings data')
  }

  // Only allow known setting keys
  const allowedKeys = ['notification_emails']

  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.includes(key)) {
      throw new BadRequestError(`Unknown setting key: ${key}`)
    }
    await settingsService.setSetting(key, String(value))
  }

  const settings = await settingsService.getAllSettings()
  return reply.send(successResponse(settings))
}

// GET /admin/settings/notification-emails
export async function getNotificationEmails(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const emails = await settingsService.getNotificationEmails()
  return reply.send(successResponse({ emails }))
}

// PUT /admin/settings/notification-emails
export async function updateNotificationEmails(
  request: FastifyRequest<{
    Body: { emails: string[] }
  }>,
  reply: FastifyReply
) {
  const { emails } = request.body

  if (!Array.isArray(emails)) {
    throw new BadRequestError('emails must be an array')
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const email of emails) {
    if (!emailRegex.test(email.trim())) {
      throw new BadRequestError(`Invalid email format: ${email}`)
    }
  }

  await settingsService.setNotificationEmails(
    emails.map((e) => e.trim()).filter((e) => e.length > 0)
  )

  const updatedEmails = await settingsService.getNotificationEmails()
  return reply.send(successResponse({ emails: updatedEmails }))
}
