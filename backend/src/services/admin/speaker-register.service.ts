import { prisma } from '../../db/prisma.js';
import { randomUUID } from 'crypto';

export interface SpeakerConfigInput {
  title: string;
  rules: string[];
  description?: string;
}

export interface SpeakerFieldInput {
  name: string;
  label: string;
  type: string; // 'text' | 'textarea' | 'email' | 'phone' | 'number'
  is_required: boolean;
  placeholder?: string;
  options?: string;
  sort_order: number;
}

/**
 * Public: Get candidate registration page config (title, rules, desc)
 */
export async function getConfig() {
  const config = await prisma.speakerRegistrationConfig.findFirst();
  if (!config) {
    return {
      title: 'Đăng ký trở thành Diễn giả TEDxFPTUniversityHCMC 2026',
      description: 'TEDx là sân chơi toàn cầu cho các ý tưởng độc đáo, truyền cảm hứng và đột phá.',
      rules: []
    };
  }
  
  let rulesList: string[] = [];
  try {
    rulesList = JSON.parse(config.rules);
  } catch {
    rulesList = [];
  }

  return {
    id: config.id,
    title: config.title,
    description: config.description,
    rules: rulesList
  };
}

/**
 * Admin: Update registration page config
 */
export async function updateConfig(input: SpeakerConfigInput) {
  const existing = await prisma.speakerRegistrationConfig.findFirst();
  const rulesString = JSON.stringify(input.rules);

  let config;
  if (existing) {
    config = await prisma.speakerRegistrationConfig.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description || null,
        rules: rulesString
      }
    });
  } else {
    config = await prisma.speakerRegistrationConfig.create({
      data: {
        id: randomUUID(),
        title: input.title,
        description: input.description || null,
        rules: rulesString
      }
    });
  }

  return {
    id: config.id,
    title: config.title,
    description: config.description,
    rules: input.rules
  };
}

/**
 * Public/Admin: List all candidate form fields ordered by sort_order
 */
export async function listFields() {
  const fields = await prisma.speakerFormField.findMany({
    orderBy: { sortOrder: 'asc' }
  });

  return fields.map(f => ({
    id: f.id,
    name: f.name,
    label: f.label,
    type: f.type,
    is_required: f.isRequired,
    placeholder: f.placeholder,
    options: f.options,
    sort_order: f.sortOrder,
    created_at: f.createdAt,
    updated_at: f.updatedAt
  }));
}

/**
 * Admin: Create a new dynamic form field
 */
export async function createField(input: SpeakerFieldInput) {
  const id = randomUUID();
  const f = await prisma.speakerFormField.create({
    data: {
      id,
      name: input.name,
      label: input.label,
      type: input.type,
      isRequired: input.is_required,
      placeholder: input.placeholder || null,
      options: input.options || null,
      sortOrder: input.sort_order ?? 0
    }
  });

  return {
    id: f.id,
    name: f.name,
    label: f.label,
    type: f.type,
    is_required: f.isRequired,
    placeholder: f.placeholder,
    options: f.options,
    sort_order: f.sortOrder,
    created_at: f.createdAt,
    updated_at: f.updatedAt
  };
}

/**
 * Admin: Update a dynamic form field
 */
export async function updateField(id: string, input: Partial<SpeakerFieldInput>) {
  const data: any = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.label !== undefined) data.label = input.label;
  if (input.type !== undefined) data.type = input.type;
  if (input.is_required !== undefined) data.isRequired = input.is_required;
  if (input.placeholder !== undefined) data.placeholder = input.placeholder;
  if (input.options !== undefined) data.options = input.options;
  if (input.sort_order !== undefined) data.sortOrder = input.sort_order;

  const f = await prisma.speakerFormField.update({
    where: { id },
    data
  });

  return {
    id: f.id,
    name: f.name,
    label: f.label,
    type: f.type,
    is_required: f.isRequired,
    placeholder: f.placeholder,
    options: f.options,
    sort_order: f.sortOrder,
    created_at: f.createdAt,
    updated_at: f.updatedAt
  };
}

/**
 * Admin: Delete a form field
 */
export async function deleteField(id: string) {
  await prisma.speakerFormField.delete({
    where: { id }
  });
  return true;
}

/**
 * Public: Candidate submits registration answers
 */
export async function createSubmission(answers: any) {
  const id = randomUUID();
  const answersString = JSON.stringify(answers);

  const sub = await prisma.speakerSubmission.create({
    data: {
      id,
      answers: answersString,
      status: 'PENDING'
    }
  });

  return {
    id: sub.id,
    answers: answers,
    status: sub.status,
    created_at: sub.createdAt,
    updated_at: sub.updatedAt
  };
}

/**
 * Admin: List candidate registration submissions
 */
export async function listSubmissions() {
  const subs = await prisma.speakerSubmission.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return subs.map(s => {
    let answersObj = {};
    try {
      answersObj = JSON.parse(s.answers);
    } catch {
      answersObj = {};
    }
    return {
      id: s.id,
      answers: answersObj,
      status: s.status,
      created_at: s.createdAt,
      updated_at: s.updatedAt
    };
  });
}

/**
 * Admin: Approve/Reject candidate submission
 */
export async function updateSubmissionStatus(id: string, status: string) {
  const sub = await prisma.speakerSubmission.update({
    where: { id },
    data: { status }
  });

  let answersObj = {};
  try {
    answersObj = JSON.parse(sub.answers);
  } catch {
    answersObj = {};
  }

  return {
    id: sub.id,
    answers: answersObj,
    status: sub.status,
    created_at: sub.createdAt,
    updated_at: sub.updatedAt
  };
}
