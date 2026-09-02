import { config } from '../config/env.js';

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sends a text message to the configured Telegram chat using HTML formatting.
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const { botToken, chatId } = config.telegram;

  if (!botToken || !chatId) {
    console.log('[TELEGRAM] Telegram Bot token or Chat ID is missing. Skipping notification.');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[TELEGRAM] Failed to send Telegram message: ${response.status} - ${errText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[TELEGRAM] Error sending Telegram message:', error);
    return false;
  }
}

/**
 * Notifies the team that a customer has requested payment confirmation.
 */
export async function notifyNewOrderPendingConfirmation(order: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  eventName: string;
  totalAmount: number;
  seats: Array<{ seatNumber: string; seatType: string }>;
}): Promise<boolean> {
  const seatList = order.seats.map((s) => `${s.seatNumber} (${s.seatType})`).join(', ');
  const amountFormatted = order.totalAmount.toLocaleString('en-US') + ' VND';

  const message = `
🔔 <b>NEW PAYMENT CONFIRMATION REQUEST</b>

<b>Order Number:</b> <code>${escapeHtml(order.orderNumber)}</code>
<b>Customer Name:</b> ${escapeHtml(order.customerName)}
<b>Phone Number:</b> <code>${escapeHtml(order.customerPhone)}</code>
<b>Email:</b> ${escapeHtml(order.customerEmail)}

<b>Event Name:</b> ${escapeHtml(order.eventName)}
<b>Seats:</b> <code>${escapeHtml(seatList)}</code>
<b>Total Amount:</b> <b>${escapeHtml(amountFormatted)}</b>

<i>Please access the Web Admin to check the transaction and approve the ticket.</i>
  `.trim();

  return sendTelegramMessage(message);
}

/**
 * Notifies the team that an order has been successfully approved/paid.
 */
export async function notifyOrderConfirmed(order: {
  orderNumber: string;
  customerName: string;
  eventName: string;
  totalAmount: number;
  seats: Array<{ seatNumber: string; seatType: string }>;
}): Promise<boolean> {
  const seatList = order.seats.map((s) => `${s.seatNumber} (${s.seatType})`).join(', ');
  const amountFormatted = order.totalAmount.toLocaleString('en-US') + ' VND';

  const message = `
✅ <b>ORDER CONFIRMED SUCCESSFULLY</b>

<b>Order Number:</b> <code>${escapeHtml(order.orderNumber)}</code>
<b>Customer Name:</b> ${escapeHtml(order.customerName)}
<b>Event Name:</b> ${escapeHtml(order.eventName)}
<b>Seats:</b> <code>${escapeHtml(seatList)}</code>
<b>Total Amount:</b> <b>${escapeHtml(amountFormatted)}</b>

<i>The system has generated the QR tickets and sent a confirmation email to the customer.</i>
  `.trim();

  return sendTelegramMessage(message);
}

/** Per-value cap, applied before escaping. The summary textarea is unbounded. */
const MAX_ANSWER_LENGTH = 300;
/** Per-label cap. Field names are admin-authored free text. */
const MAX_LABEL_LENGTH = 64;
/** Rows in the "Other answers" block before it is summarised. */
const MAX_EXTRA_FIELDS = 20;
/**
 * Budget under Telegram's hard 4096. The headroom absorbs the truncation
 * notice and the fact that escaping expands text — one `&` becomes five
 * characters — so a per-value cap alone cannot bound the total.
 */
const MAX_MESSAGE_LENGTH = 3800;

/**
 * The fields worth pulling to the top of the message, each with the spellings
 * seen in practice. The form is admin-configurable, so a key can be renamed;
 * the fallback chains follow the precedent in speaker-register.service.ts,
 * which already reads `answers.fullName || answers.name`.
 */
const KNOWN_SPEAKER_FIELDS: Array<{label: string; keys: string[]; code?: boolean}> = [
  { label: 'Full Name', keys: ['fullName', 'full_name', 'name'] },
  { label: 'Email', keys: ['email', 'emailAddress', 'email_address'] },
  { label: 'Phone', keys: ['phone', 'phoneNumber', 'phone_number', 'tel'], code: true },
  { label: 'Topic', keys: ['topic', 'talkTopic', 'talk_topic', 'subject'] },
];

/**
 * One answer as a single line of text.
 *
 * Coerces before escaping: escapeHtml is typed for strings and its
 * `if (!text) return ''` would blank a legitimate 0 or false. Collapsing all
 * whitespace — newlines included — is what keeps every rendered line
 * self-contained, which is what makes the line-boundary truncation below safe.
 */
function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (Array.isArray(value)) {
    text = value.map(formatAnswerValue).filter(Boolean).join(', ');
  } else if (typeof value === 'object') {
    text = JSON.stringify(value);
  } else {
    text = String(value);
  }
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

/** `videoUrl` → `Video Url`. Cosmetic only; the raw key is the fallback. */
function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return key;
  // \p{L} with the u flag so Vietnamese field names capitalise correctly.
  return spaced.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/**
 * Both halves are escaped: values are applicant input, and labels come from
 * admin-authored field names, so a field called `<b>` would otherwise corrupt
 * the message and earn a 400 from Telegram.
 */
function renderLine(label: string, value: string, code = false): string {
  const safeLabel = escapeHtml(truncate(label, MAX_LABEL_LENGTH));
  const safeValue = escapeHtml(truncate(value, MAX_ANSWER_LENGTH));
  return `<b>${safeLabel}:</b> ${code && value ? `<code>${safeValue}</code>` : safeValue}`;
}

/**
 * Last line of defence against Telegram's 4096 limit.
 *
 * Cuts at a newline: every value has had its whitespace collapsed, so each
 * line opens and closes its own tags and holds no partial HTML entity. A
 * mid-line slice could orphan a `<b>` or leave `&am`, both of which Telegram
 * rejects with "can't parse entities".
 */
function capMessage(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) return message;
  const cut = message.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
  const body = message.slice(0, cut > 0 ? cut : MAX_MESSAGE_LENGTH);
  return `${body}\n<i>… message truncated</i>`;
}

/**
 * Notifies the team that someone has applied to speak.
 *
 * A submission has no name or email column — every answer lives in one JSON
 * blob whose keys the admin can rename, add to or delete. So the known fields
 * are pulled to the top by best effort and everything else is appended
 * verbatim: an admin renaming a field should make the message uglier, never
 * make an applicant's answer vanish from it.
 */
export async function notifyNewSpeakerSubmission(submission: {
  id: string;
  answers: unknown;
}): Promise<boolean> {
  // Straight off an unvalidated request body. Anything that is not a plain
  // object degrades to "no answers" rather than throwing — a notification that
  // arrives empty is easier to diagnose than one that never arrives.
  const answers =
    submission.answers &&
    typeof submission.answers === 'object' &&
    !Array.isArray(submission.answers)
      ? (submission.answers as Record<string, unknown>)
      : {};

  const used = new Set<string>();
  const knownLines = KNOWN_SPEAKER_FIELDS.map((field) => {
    for (const key of field.keys) {
      const value = formatAnswerValue(answers[key]);
      if (value) {
        // Only the key that actually matched is consumed, so a form carrying
        // both `fullName` and `name` still shows the second one below.
        used.add(key);
        return renderLine(field.label, value, field.code);
      }
    }
    return renderLine(field.label, '—');
  });

  const extras = Object.entries(answers)
    .filter(([key]) => !used.has(key))
    .map(([key, value]) => [key, formatAnswerValue(value)] as const)
    .filter(([, value]) => value !== '');

  // Insertion order is the admin's sort_order — the client posts the fields in
  // the order the form renders them.
  const shown = extras.slice(0, MAX_EXTRA_FIELDS);
  const hidden = extras.length - shown.length;

  const lines = [
    '🎤 <b>NEW SPEAKER APPLICATION</b>',
    '',
    ...knownLines,
  ];

  if (shown.length > 0) {
    lines.push('', '<b>Other answers:</b>');
    for (const [key, value] of shown) lines.push(renderLine(humanizeKey(key), value));
    if (hidden > 0) lines.push(`<i>… and ${hidden} more answer(s) not shown</i>`);
  }

  lines.push(
    '',
    `<b>Submission ID:</b> <code>${escapeHtml(submission.id)}</code>`,
    '<i>Please access the Web Admin to review this application.</i>'
  );

  return sendTelegramMessage(capMessage(lines.join('\n').trim()));
}
