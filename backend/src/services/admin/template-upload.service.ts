import { FastifyRequest } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import AdmZip from 'adm-zip';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'email-templates');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

interface UploadResult {
  templateId: string;
  htmlContent: string;
  images: string[];
}

/**
 * Process uploaded HTML file and images (or ZIP file from Canva)
 * Replaces local image paths with uploaded URLs
 */
export async function processTemplateUpload(
  request: FastifyRequest,
  baseUrl: string
): Promise<UploadResult> {
  const parts = request.parts();

  const templateId = randomUUID();
  const templateDir = path.join(UPLOAD_DIR, templateId);
  fs.mkdirSync(templateDir, { recursive: true });

  let htmlContent = '';
  const uploadedImages: string[] = [];
  const imageMap: Record<string, string> = {};

  for await (const part of parts) {
    if (part.type === 'file') {
      const filename = part.filename || 'unnamed';
      const ext = path.extname(filename).toLowerCase();

      // Handle ZIP file (Canva export)
      if (ext === '.zip') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        const zipBuffer = Buffer.concat(chunks);

        const result = await processZipFile(zipBuffer, templateId, templateDir, baseUrl);
        htmlContent = result.htmlContent;
        uploadedImages.push(...result.images);
        Object.assign(imageMap, result.imageMap);
      }
      else if (ext === '.html' || ext === '.htm') {
        // Read HTML content
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        htmlContent = Buffer.concat(chunks).toString('utf-8');
      } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
        // Save image file
        const safeFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filepath = path.join(templateDir, safeFilename);

        await pipeline(part.file, fs.createWriteStream(filepath));

        const publicUrl = `${baseUrl}/uploads/email-templates/${templateId}/${safeFilename}`;
        uploadedImages.push(publicUrl);

        // Map original filename to new URL
        imageMap[filename] = publicUrl;

        // Also map with common path patterns from Canva exports
        imageMap[`images/${filename}`] = publicUrl;
        imageMap[`./images/${filename}`] = publicUrl;
        imageMap[`./${filename}`] = publicUrl;
      }
    }
  }

  // Replace image paths in HTML
  let processedHtml = htmlContent;
  for (const [originalPath, newUrl] of Object.entries(imageMap)) {
    // Replace various path formats
    processedHtml = processedHtml.replace(
      new RegExp(`(src|href)=["']${escapeRegex(originalPath)}["']`, 'gi'),
      `$1="${newUrl}"`
    );
    // Also handle url() in CSS
    processedHtml = processedHtml.replace(
      new RegExp(`url\\(["']?${escapeRegex(originalPath)}["']?\\)`, 'gi'),
      `url("${newUrl}")`
    );
  }

  return {
    templateId,
    htmlContent: processedHtml,
    images: uploadedImages,
  };
}

/**
 * Process ZIP file from Canva export
 */
async function processZipFile(
  zipBuffer: Buffer,
  templateId: string,
  templateDir: string,
  baseUrl: string
): Promise<{ htmlContent: string; images: string[]; imageMap: Record<string, string> }> {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  let htmlContent = '';
  const images: string[] = [];
  const imageMap: Record<string, string> = {};

  for (const entry of entries) {
    const entryName = entry.entryName;
    const ext = path.extname(entryName).toLowerCase();
    const basename = path.basename(entryName);

    if (entry.isDirectory) continue;

    if (ext === '.html' || ext === '.htm') {
      htmlContent = entry.getData().toString('utf-8');
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
      // Save image
      const safeFilename = `${Date.now()}-${basename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filepath = path.join(templateDir, safeFilename);

      fs.writeFileSync(filepath, entry.getData());

      const publicUrl = `${baseUrl}/uploads/email-templates/${templateId}/${safeFilename}`;
      images.push(publicUrl);

      // Map various path patterns
      imageMap[entryName] = publicUrl;
      imageMap[basename] = publicUrl;
      imageMap[`images/${basename}`] = publicUrl;
      imageMap[`./images/${basename}`] = publicUrl;
      imageMap[`./${basename}`] = publicUrl;

      // Handle nested paths like "email_files/images/img.png"
      const parts = entryName.split('/');
      if (parts.length > 1) {
        imageMap[parts.slice(-2).join('/')] = publicUrl;
        imageMap['./' + parts.slice(-2).join('/')] = publicUrl;
      }
    }
  }

  return { htmlContent, images, imageMap };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Save processed template to database
 */
export async function saveUploadedTemplate(
  data: {
    name: string;
    subject: string;
    htmlContent: string;
    purpose: string;
    description?: string;
  }
) {
  const id = randomUUID();
  
  return prisma.emailTemplate.create({
    data: {
      id,
      name: data.name,
      subject: data.subject,
      htmlContent: data.htmlContent,
      purpose: data.purpose,
      description: data.description || '',
      isActive: false,
      isDefault: false,
      variables: JSON.stringify(extractVariables(data.htmlContent)),
    },
  });
}

function extractVariables(html: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match;
  while ((match = regex.exec(html)) !== null) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

/**
 * Delete template and its uploaded files
 */
export async function deleteTemplateFiles(templateId: string) {
  const templateDir = path.join(UPLOAD_DIR, templateId);
  if (fs.existsSync(templateDir)) {
    fs.rmSync(templateDir, { recursive: true });
  }
}
