export const MAX_BYTES = 10 * 1024 * 1024
export const MAX_BASE64_LENGTH = Math.ceil(MAX_BYTES / 3) * 4 + 4096

export class ConversionError extends Error {}

export function encodeBase64(bytes            , urlSafe = false, padding = true)         {
  if (bytes.byteLength > MAX_BYTES) {
    throw new ConversionError('This input is too large. Choose a file or text smaller than 10 MiB.')
  }
  const chunks           = []
  for (let offset = 0; offset < bytes.length; offset += 16384) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 16384)))
  }
  let result = btoa(chunks.join(''))
  if (urlSafe) result = result.replace(/\+/g, '-').replace(/\//g, '_')
  return padding ? result : result.replace(/=+$/, '')
}

export function decodeBase64(input        )                          {
  if (input.length > MAX_BASE64_LENGTH) {
    throw new ConversionError('This input is too large. Decoded files must be smaller than 10 MiB.')
  }
  let value = input.trim()
  if (/^data:/i.test(value)) {
    const prefix = /^data:[^,]*;base64,/i.exec(value)
    if (!prefix) throw new ConversionError('This data URL is not Base64. Use a data URL containing “;base64,”.')
    value = value.slice(prefix[0].length)
  }
  value = value.replace(/[\t\n\r\f ]/g, '')
  if (!value && input.trim()) throw new ConversionError('This Base64 value is empty. Paste the encoded content after the comma.')
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(value)) {
    throw new ConversionError('Invalid Base64 characters. Use letters, numbers, + / or - _, with = only at the end.')
  }
  if (/[+/]/.test(value) && /[-_]/.test(value)) {
    throw new ConversionError('This value mixes standard and URL-safe characters. Use one Base64 alphabet throughout.')
  }
  const bare = value.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/')
  if (bare.length % 4 === 1 || (value.includes('=') && value.length % 4 !== 0)) {
    throw new ConversionError('Incomplete Base64 value. Check for missing characters or extra padding (=).')
  }
  const binary = atob(bare + '='.repeat((4 - bare.length % 4) % 4))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (encodeBase64(bytes, false, false) !== bare) {
    throw new ConversionError('Invalid Base64 ending. Check the final characters and try again.')
  }
  return bytes
}

export function readUtf8(bytes            )                {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    // Valid UTF-8 can still be binary. Keep control bytes out of the text editor.
    return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text) ? null : text
  } catch {
    return null
  }
}

export function formatHex(bytes) {
  const hex = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0').toUpperCase())
  const lines = []
  for (let offset = 0; offset < bytes.length; offset += 16) {
    lines.push(Array.from(bytes.subarray(offset, offset + 16), value => hex[value]).join(' '))
  }
  return lines.join('\n')
}

export function formatBytes(bytes        )         {
  if (bytes < 1024) return `${bytes.toLocaleString('en-US')} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}
