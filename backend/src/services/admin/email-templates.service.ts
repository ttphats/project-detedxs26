import { prisma } from '../../db/prisma.js';
import { randomUUID } from 'crypto';
import { extractVariables } from '../email.service.js';

export interface CreateTemplateInput {
  name: string;
  purpose: string;
  category?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  description?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  description?: string;
}

/**
 * List email templates with optional filters
 */
export async function listTemplates(category?: string, activeOnly?: boolean) {
  const where: any = {};
  if (category) where.category = category;
  if (activeOnly) where.isActive = true;

  return prisma.emailTemplate.findMany({
    where,
    orderBy: [{ purpose: 'asc' }, { version: 'desc' }],
  });
}

/**
 * Get template by ID
 */
export async function getTemplateById(id: string) {
  return prisma.emailTemplate.findUnique({
    where: { id },
  });
}

/**
 * Create new email template
 */
export async function createTemplate(input: CreateTemplateInput) {
  const id = randomUUID();

  // Extract variables from content
  const variables = [
    ...extractVariables(input.subject),
    ...extractVariables(input.htmlContent),
  ];

  // Get latest version for this purpose
  const latestVersion = await prisma.emailTemplate.findFirst({
    where: { purpose: input.purpose },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const version = (latestVersion?.version || 0) + 1;

  return prisma.emailTemplate.create({
    data: {
      id,
      name: input.name,
      purpose: input.purpose,
      category: input.category || 'TRANSACTIONAL',
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
      description: input.description,
      variables: JSON.stringify([...new Set(variables)]),
      version,
      isActive: true,
      isDefault: false,
    },
  });
}

/** `name` is UNIQUE (email_templates_name_key), and VarChar(100). */
const NAME_MAX = 100;

/**
 * A free name to file the superseded version under.
 *
 * The old row is kept as history rather than deleted, so it still holds the
 * name the new version wants. Move it aside — "Vé hợp lệ" becomes "Vé hợp lệ
 * (v2)" — and the live template keeps the clean name.
 */
async function archivedName(base: string, version: number): Promise<string> {
  const build = (suffix: string) =>
    base.slice(0, Math.max(0, NAME_MAX - suffix.length)) + suffix;

  let candidate = build(` (v${version})`);
  for (let n = 2; n < 50; n++) {
    const clash = await prisma.emailTemplate.findUnique({
      where: { name: candidate },
      select: { id: true },
    });
    if (!clash) break;
    candidate = build(` (v${version}-${n})`);
  }
  return candidate;
}

/**
 * Update email template
 * If template is active, clone it as new version
 */
export async function updateTemplate(id: string, input: UpdateTemplateInput) {
  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) throw new Error('Template not found');

  // If template is active and default, create new version
  if (template.isActive && template.isDefault) {
    const newId = randomUUID();
    const variables = [
      ...extractVariables(input.subject || template.subject),
      ...extractVariables(input.htmlContent || template.htmlContent),
    ];

    const nextName = input.name || template.name;
    // Only move the old row aside when the new version reuses its name; an
    // edit that also renames leaves the old name free anyway.
    const freedName =
      nextName === template.name
        ? await archivedName(template.name, template.version)
        : template.name;

    // One transaction: the old version was previously deactivated before the
    // clone was written, so a failure here (a duplicate name, most often)
    // left the purpose with no active template at all and stopped those
    // emails going out.
    const [, created] = await prisma.$transaction([
      prisma.emailTemplate.update({
        where: { id },
        data: { isActive: false, isDefault: false, name: freedName },
      }),
      prisma.emailTemplate.create({
        data: {
          id: newId,
          name: nextName,
          purpose: template.purpose,
          category: template.category,
          subject: input.subject || template.subject,
          htmlContent: input.htmlContent || template.htmlContent,
          textContent: input.textContent || template.textContent,
          description: input.description || template.description,
          variables: JSON.stringify([...new Set(variables)]),
          version: template.version + 1,
          isActive: true,
          isDefault: true,
        },
      }),
    ]);

    return created;
  }

  // Otherwise just update
  const data: any = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.subject !== undefined) data.subject = input.subject;
  if (input.htmlContent !== undefined) {
    data.htmlContent = input.htmlContent;
    data.variables = JSON.stringify(extractVariables(input.htmlContent));
  }
  if (input.textContent !== undefined) data.textContent = input.textContent;
  if (input.description !== undefined) data.description = input.description;

  return prisma.emailTemplate.update({ where: { id }, data });
}

/**
 * Delete email template (only if not active default)
 */
export async function deleteTemplate(id: string) {
  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) throw new Error('Template not found');

  if (template.isActive && template.isDefault) {
    throw new Error('Cannot delete active default template');
  }

  return prisma.emailTemplate.delete({ where: { id } });
}

/**
 * Set template as default for its purpose
 */
export async function setDefaultTemplate(id: string) {
  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) throw new Error('Template not found');

  // Unset other defaults for this purpose
  await prisma.emailTemplate.updateMany({
    where: { purpose: template.purpose, isDefault: true },
    data: { isDefault: false },
  });

  // Set this as default
  return prisma.emailTemplate.update({
    where: { id },
    data: { isDefault: true, isActive: true },
  });
}

/**
 * Activate/deactivate template
 */
export async function activateTemplate(id: string, active: boolean) {
  return prisma.emailTemplate.update({
    where: { id },
    data: { isActive: active },
  });
}

