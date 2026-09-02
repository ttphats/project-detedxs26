import {describe, it, expect, vi, beforeEach} from 'vitest'

/**
 * Mutable on purpose: sendTelegramMessage destructures config.telegram inside
 * the function body, not at import, so blanking a field here takes effect on
 * the next call and lets one file cover both the configured and the
 * unconfigured path.
 */
const telegram: {botToken?: string; chatId?: string} = {
  botToken: 'test-token',
  chatId: '-1001234567890',
}

const fetchMock = vi.fn()

vi.mock('../config/env.js', () => ({config: {telegram}}))

vi.stubGlobal('fetch', fetchMock)

const {notifyNewSpeakerSubmission} = await import('../services/telegram.service.js')

/** The text Telegram would have received on the most recent call. */
function sentText(): string {
  const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
  return JSON.parse(init.body).text
}

const seeded = {
  fullName: 'Nguyễn Văn A',
  email: 'a@example.com',
  phone: '0900000000',
  topic: 'Ideas worth spreading',
  summary: 'A short talk about time.',
  videoUrl: 'https://example.com/v',
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ok: true, text: async () => 'ok'})
  telegram.botToken = 'test-token'
  telegram.chatId = '-1001234567890'
})

describe('notifyNewSpeakerSubmission — message building', () => {
  it('renders the default seeded fields at the top', async () => {
    await notifyNewSpeakerSubmission({id: 'sub-1', answers: seeded})
    const text = sentText()
    expect(text).toContain('NEW SPEAKER APPLICATION')
    expect(text).toContain('<b>Full Name:</b> Nguyễn Văn A')
    expect(text).toContain('<b>Email:</b> a@example.com')
    expect(text).toContain('<b>Phone:</b> <code>0900000000</code>')
    expect(text).toContain('<b>Topic:</b> Ideas worth spreading')
    expect(text).toContain('<code>sub-1</code>')
  })

  it('falls back to alternate spellings of the known keys', async () => {
    await notifyNewSpeakerSubmission({
      id: 'sub-2',
      answers: {full_name: 'Tran B', phoneNumber: '0911111111', subject: 'Courage'},
    })
    const text = sentText()
    expect(text).toContain('<b>Full Name:</b> Tran B')
    expect(text).toContain('<b>Phone:</b> <code>0911111111</code>')
    expect(text).toContain('<b>Topic:</b> Courage')
  })

  it('renders an em dash for a known field left blank', async () => {
    await notifyNewSpeakerSubmission({id: 'sub-3', answers: {fullName: 'Solo'}})
    const text = sentText()
    // Not wrapped in <code>: an absent phone is a dash, not an empty code span.
    expect(text).toContain('<b>Phone:</b> —')
    expect(text).not.toContain('<code>—</code>')
  })

  it('appends admin-added answers after the known fields', async () => {
    await notifyNewSpeakerSubmission({
      id: 'sub-4',
      answers: {...seeded, linkedinProfile: 'https://in.test/a'},
    })
    const text = sentText()
    expect(text).toContain('<b>Linkedin Profile:</b> https://in.test/a')
    expect(text.indexOf('Linkedin Profile')).toBeGreaterThan(text.indexOf('<b>Topic:</b>'))
  })

  it('does not repeat a matched known field in the other-answers block', async () => {
    await notifyNewSpeakerSubmission({id: 'sub-5', answers: seeded})
    expect(sentText().match(/Full Name/g)).toHaveLength(1)
  })

  it('keeps an unmatched alternate spelling rather than dropping it', async () => {
    await notifyNewSpeakerSubmission({
      id: 'sub-6',
      answers: {fullName: 'Primary', name: 'Secondary'},
    })
    const text = sentText()
    expect(text).toContain('<b>Full Name:</b> Primary')
    // `name` lost the race but is still someone's answer.
    expect(text).toContain('Secondary')
  })

  it('preserves the order the answers arrived in', async () => {
    await notifyNewSpeakerSubmission({
      id: 'sub-7',
      answers: {fullName: 'A', zeta: 'first', alpha: 'second'},
    })
    const text = sentText()
    expect(text.indexOf('first')).toBeLessThan(text.indexOf('second'))
  })

  it('keeps a number or false answer instead of blanking it', async () => {
    await notifyNewSpeakerSubmission({id: 'sub-8', answers: {years: 0, agreed: false}})
    const text = sentText()
    expect(text).toContain('<b>Years:</b> 0')
    expect(text).toContain('<b>Agreed:</b> false')
  })

  it('truncates a single very long answer', async () => {
    await notifyNewSpeakerSubmission({
      id: 'sub-9',
      answers: {fullName: 'A', summary: 'x'.repeat(5000)},
    })
    const text = sentText()
    expect(text).toContain('…')
    expect(text.length).toBeLessThanOrEqual(4096)
  })

  it('stays under the Telegram limit with many long answers', async () => {
    const answers: Record<string, string> = {fullName: 'A'}
    for (let i = 0; i < 40; i++) answers[`field${i}`] = 'y'.repeat(500)
    await notifyNewSpeakerSubmission({id: 'sub-10', answers})
    const text = sentText()
    expect(text.length).toBeLessThanOrEqual(4096)
    // Cut at a line boundary, so no tag is left unclosed.
    expect((text.match(/<b>/g) || []).length).toBe((text.match(/<\/b>/g) || []).length)
  })

  it('escapes HTML in answer values', async () => {
    await notifyNewSpeakerSubmission({
      id: 'sub-11',
      answers: {fullName: '<script>alert(1)</script>'},
    })
    const text = sentText()
    expect(text).toContain('&lt;script&gt;')
    expect(text).not.toContain('<script>')
  })

  it('escapes HTML in admin-defined field keys', async () => {
    await notifyNewSpeakerSubmission({
      id: 'sub-12',
      answers: {fullName: 'A', '<b>evil</b>': 'value'},
    })
    const text = sentText()
    // The label is title-cased before escaping, so match case-insensitively —
    // what matters is that the angle brackets became entities and no injected
    // tag survived into the markup.
    expect(text.toLowerCase()).toContain('&lt;b&gt;evil&lt;/b&gt;')
    expect(text).not.toContain('<b>evil')
    // Every <b> in the output is one this module opened and closed itself.
    expect((text.match(/<b>/g) || []).length).toBe((text.match(/<\/b>/g) || []).length)
  })

  it.each([
    ['null', null],
    ['an array', ['a', 'b']],
    ['a string', 'not-an-object'],
  ])('does not throw when answers is %s', async (_label, answers) => {
    await expect(notifyNewSpeakerSubmission({id: 'sub-13', answers})).resolves.toBe(true)
  })
})

describe('notifyNewSpeakerSubmission — delivery', () => {
  it('skips the request entirely when the bot token is missing', async () => {
    telegram.botToken = undefined
    await expect(notifyNewSpeakerSubmission({id: 'sub-14', answers: seeded})).resolves.toBe(
      false
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resolves false rather than rejecting when Telegram returns non-2xx', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request: can't parse entities",
    })
    await expect(notifyNewSpeakerSubmission({id: 'sub-15', answers: seeded})).resolves.toBe(
      false
    )
  })

  it('resolves false rather than rejecting when the request throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    await expect(notifyNewSpeakerSubmission({id: 'sub-16', answers: seeded})).resolves.toBe(
      false
    )
  })
})
