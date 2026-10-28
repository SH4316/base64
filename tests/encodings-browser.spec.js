import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const cp949 = Buffer.from('bec8b3e7c7cfbcbcbfe4', 'hex')
const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('hello', 'utf16le')])

async function downloaded(page, button) {
  const event = page.waitForEvent('download')
  await button.click()
  const file = await event
  const chunks = []
  for await (const chunk of await file.createReadStream()) chunks.push(Buffer.from(chunk))
  return { name: file.suggestedFilename(), bytes: Buffer.concat(chunks) }
}

async function decode(page, bytes) {
  await page.getByLabel('Base64', { exact: true }).fill(bytes.toString('base64'))
  await page.getByRole('button', { name: 'Decode', exact: true }).click()
}

test('typed text encodes and downloads with the selected legacy charset and rejects lossy text', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Text encoding', { exact: true }).selectOption('cp949')
  await page.getByLabel('Plain text', { exact: true }).fill('안녕하세요')
  await expect(page.locator('.byte-count').first()).toHaveText('10 B')
  const file = await downloaded(page, page.getByRole('button', { name: 'Download plain text or file', exact: true }))
  expect(file.bytes).toEqual(cp949)
  await page.getByRole('button', { name: 'Encode', exact: true }).click()
  await expect(page.getByLabel('Base64', { exact: true })).toHaveValue(cp949.toString('base64'))
  await page.getByLabel('Plain text', { exact: true }).fill('안녕하세요 👋')
  await page.getByRole('button', { name: 'Encode', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('cannot be represented')
  await expect(page.getByLabel('Base64', { exact: true })).toHaveValue(cp949.toString('base64'))
  const downloads = []
  page.on('download', file => downloads.push(file))
  await page.getByRole('button', { name: 'Download plain text or file', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('cannot be represented')
  expect(downloads).toHaveLength(0)
})

test('auto detects Unicode BOM, preserves bytes through charset and binary changes, then encodes edited text explicitly', async ({ page }) => {
  await page.goto('/')
  await decode(page, utf16)
  await expect(page.getByLabel('Plain text', { exact: true })).toHaveValue('\uFEFFhello')
  await expect(page.locator('#encoding-status')).toContainText('Detected UTF-16 LE')
  await page.getByLabel('Text encoding', { exact: true }).selectOption('binary')
  await expect(page.getByLabel('Binary data', { exact: true })).toHaveValue('FF FE 68 00 65 00 6C 00 6C 00 6F 00')
  await page.getByLabel('Text encoding', { exact: true }).selectOption('utf-16le')
  await expect(page.getByLabel('Plain text', { exact: true })).toHaveValue('\uFEFFhello')
  const file = await downloaded(page, page.getByRole('button', { name: 'Download plain text or file', exact: true }))
  expect(file.bytes).toEqual(utf16)
  await page.getByRole('button', { name: 'Encode', exact: true }).click()
  await expect(page.getByLabel('Base64', { exact: true })).toHaveValue(utf16.toString('base64'))
  await page.getByLabel('Plain text', { exact: true }).fill('edited')
  await page.getByRole('button', { name: 'Encode', exact: true }).click()
  await expect(page.getByLabel('Base64', { exact: true })).toHaveValue(Buffer.from('edited', 'utf16le').toString('base64'))
  await page.getByLabel('Text encoding', { exact: true }).selectOption('auto')
  await page.getByRole('button', { name: 'Encode', exact: true }).click()
  await expect(page.getByLabel('Base64', { exact: true })).toHaveValue(Buffer.from('edited').toString('base64'))
})

test('ambiguous short Korean bytes remain HEX until manual recovery and failed selection preserves prior content', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Upload source file', { exact: true }).setInputFiles({ name: 'korean.txt', mimeType: 'text/plain', buffer: cp949 })
  await expect(page.getByLabel('Binary data', { exact: true })).toHaveValue('BE C8 B3 E7 C7 CF BC BC BF E4')
  await expect(page.locator('#encoding-status')).toContainText('Choose a charset')
  await page.getByLabel('Text encoding', { exact: true }).selectOption('cp949')
  await expect(page.getByLabel('Plain text', { exact: true })).toHaveValue('안녕하세요')
  await page.getByLabel('Text encoding', { exact: true }).selectOption('utf-8')
  await expect(page.getByRole('alert')).toContainText('not valid')
  await expect(page.getByLabel('Plain text', { exact: true })).toHaveValue('안녕하세요')
  const file = await downloaded(page, page.getByRole('button', { name: 'Download plain text or file', exact: true }))
  expect(file.name).toBe('korean.txt')
  expect(file.bytes).toEqual(cp949)
  await page.getByRole('button', { name: 'Encode', exact: true }).click()
  await expect(page.getByLabel('Base64', { exact: true })).toHaveValue(cp949.toString('base64'))
  await page.getByRole('checkbox', { name: 'URL-safe' }).check()
  await expect(page.locator('#encoding-status')).toContainText('not applied')
  await expect(page.getByLabel('Plain text', { exact: true })).toHaveValue('안녕하세요')
})

test('Base64 file document encoding is independent of payload and its original BOM bytes download intact', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Text encoding', { exact: true }).selectOption('cp949')
  const document = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(cp949.toString('base64') + '\r\n', 'utf16le')])
  await page.getByLabel('Upload Base64 file', { exact: true }).setInputFiles({ name: 'encoded-utf16.txt', mimeType: 'text/plain', buffer: document })
  await expect(page.getByLabel('Base64', { exact: true })).toHaveValue('\uFEFF' + cp949.toString('base64') + '\n')
  const file = await downloaded(page, page.getByRole('button', { name: 'Download Base64', exact: true }))
  expect(file.name).toBe('encoded-utf16.txt')
  expect(file.bytes).toEqual(document)
  await page.getByRole('button', { name: 'Decode', exact: true }).click()
  await expect(page.getByLabel('Plain text', { exact: true })).toHaveValue('안녕하세요')
  await page.getByLabel('Upload Base64 file', { exact: true }).setInputFiles({ name: 'invalid.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([0xff, 0]) })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Plain text', { exact: true })).toHaveValue('안녕하세요')
  await expect(page.getByLabel('Base64', { exact: true })).toHaveValue('\uFEFF' + cp949.toString('base64') + '\n')
})

test('pending worker conversions and file reads cannot overwrite newer typed edits', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const encoded = document.querySelector('#base64-text')
    encoded.value = 'aGVsbG8='
    encoded.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('.convert-button.secondary').click()
    const plain = document.querySelector('#plain-text')
    plain.value = 'newer typed text'
    plain.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.locator('.byte-count').first()).toHaveText('16 B')
  await expect(page.getByLabel('Plain text', { exact: true })).toHaveValue('newer typed text')
  await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Upload source file"]')
    const transfer = new DataTransfer()
    transfer.items.add(new File(['old file text'], 'old.txt'))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    const plain = document.querySelector('#plain-text')
    plain.value = 'newest typed text'
    plain.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.locator('.byte-count').first()).toHaveText('17 B')
  await expect(page.getByLabel('Plain text', { exact: true })).toHaveValue('newest typed text')
  await expect(page.locator('.file-chip')).toHaveCount(0)
})

test('removed about copy is absent and the versioned favicon serves the new production asset', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByText('What is Base64?', { exact: true })).toHaveCount(0)
  await expect(page.locator('.about-section, .help')).toHaveCount(0)
  const icon = page.locator('link[rel="icon"]')
  await expect(icon).toHaveAttribute('href', /favicon\.svg\?v=/)
  const response = await request.get(await icon.getAttribute('href'))
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/svg+xml')
  expect(await response.text()).toBe(await readFile(new URL('../assets/favicon.svg', import.meta.url), 'utf8'))
})


test('large Unicode Base64 documents are accepted by character size while oversized source uploads preserve the current state', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Plain text', { exact: true }).fill('keep this text')
  const value = Buffer.alloc(4 * 1024 * 1024, 65).toString('base64')
  const document = Buffer.from(value, 'utf16le')
  expect(document.length).toBeGreaterThan(10 * 1024 * 1024)
  await page.getByLabel('Upload Base64 file', { exact: true }).setInputFiles({ name: 'large-utf16.txt', mimeType: 'text/plain', buffer: document })
  await expect(page.locator('.feedback')).toContainText('large-utf16.txt', { timeout: 15000 })
  expect(await page.getByLabel('Base64', { exact: true }).evaluate(element => element.value.length)).toBe(value.length)
  await expect(page.locator('.byte-count').first()).toHaveText('14 B')
  await page.getByLabel('Upload source file', { exact: true }).setInputFiles({ name: 'too-large.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
  await expect(page.getByRole('alert')).toContainText('too large')
  await expect(page.getByLabel('Plain text', { exact: true })).toHaveValue('keep this text')
  await expect(page.locator('.byte-count').first()).toHaveText('14 B')
  expect(await page.getByLabel('Base64', { exact: true }).evaluate(element => element.value.length)).toBe(value.length)
})
