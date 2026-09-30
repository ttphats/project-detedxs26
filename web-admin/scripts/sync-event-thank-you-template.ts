/**
 * Upsert the default EVENT_THANK_YOU email template (post-event thank-you + survey link).
 * Run from web-admin/: npx tsx scripts/sync-event-thank-you-template.ts
 */
import {PrismaClient} from '@prisma/client'
import {
  EVENT_THANK_YOU_HTML,
  EVENT_THANK_YOU_SUBJECT,
  EVENT_THANK_YOU_TEXT,
  EVENT_THANK_YOU_VARIABLES,
} from '../src/lib/email-templates/event-thank-you'

const prisma = new PrismaClient()
const purpose = 'EVENT_THANK_YOU'

async function main() {
  const existing = await prisma.emailTemplate.findFirst({where: {purpose, isDefault: true}})
  const payload = {
    name: existing?.name || 'TEDx Season 06 — Thank You & Survey',
    purpose,
    category: 'EVENT',
    description: 'Cảm ơn người giữ vé / người tham dự sau sự kiện, kèm link khảo sát Google Forms.',
    subject: EVENT_THANK_YOU_SUBJECT,
    htmlContent: EVENT_THANK_YOU_HTML,
    textContent: EVENT_THANK_YOU_TEXT,
    variables: JSON.stringify(EVENT_THANK_YOU_VARIABLES),
    isActive: true,
    isDefault: true,
  }

  if (existing) {
    await prisma.emailTemplate.update({
      where: {id: existing.id},
      data: {...payload, version: (existing.version || 1) + 1},
    })
    console.log('Updated', existing.id)
  } else {
    const created = await prisma.emailTemplate.create({data: payload})
    console.log('Created', created.id)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
