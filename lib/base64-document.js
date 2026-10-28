import { ConversionError, decodeBase64, MAX_BASE64_FILE_BYTES, MAX_BASE64_LENGTH } from './base64.js'

const ascii = value => value === 9 || value === 10 || value === 12 || value === 13 || value >= 32 && value <= 126

function pattern(bytes, width, littleEndian) {
  if (bytes.length % width || bytes.length < width * 2) return false
  const end = Math.min(bytes.length, 512 - 512 % width)
  let matching = 0
  for (let offset = 0; offset < end; offset += width) {
    const low = littleEndian ? offset : offset + width - 1
    if (!ascii(bytes[low])) continue
    let clean = true
    for (let part = 0; part < width; part++) if (offset + part !== low && bytes[offset + part] !== 0) clean = false
    if (clean) matching++
  }
  return matching >= end / width * 0.95
}

function utf32(bytes, littleEndian) {
  if (bytes.length % 4) throw new ConversionError('This UTF-32 Base64 document has an incomplete character.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks = []
  let points = []
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const value = view.getUint32(offset, littleEndian)
    if (value > 0x10ffff || value >= 0xd800 && value <= 0xdfff) throw new ConversionError('This UTF-32 Base64 document contains an invalid character.')
    points.push(value)
    if (points.length === 8192) { chunks.push(String.fromCodePoint(...points)); points = [] }
  }
  if (points.length) chunks.push(String.fromCodePoint(...points))
  return chunks.join('')
}

export function readBase64Document(bytes) {
  if (bytes.length > MAX_BASE64_FILE_BYTES) throw new ConversionError('This Base64 document is too large. Decoded files must be smaller than 10 MiB.')
  let encoding = 'utf-8'
  if (bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0 && bytes[3] === 0) encoding = 'utf-32le'
  else if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xfe && bytes[3] === 0xff) encoding = 'utf-32be'
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le'
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be'
  else if (pattern(bytes, 4, true)) encoding = 'utf-32le'
  else if (pattern(bytes, 4, false)) encoding = 'utf-32be'
  else if (pattern(bytes, 2, true)) encoding = 'utf-16le'
  else if (pattern(bytes, 2, false)) encoding = 'utf-16be'
  let value
  try {
    value = encoding.startsWith('utf-32') ? utf32(bytes, encoding === 'utf-32le') : new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch (error) {
    if (error instanceof ConversionError) throw error
    throw new ConversionError('Could not read this Base64 document. Save it as UTF-8 or a Unicode file with a BOM, then upload it again.')
  }
  if (value.length > MAX_BASE64_LENGTH) throw new ConversionError('This Base64 document is too large. Decoded files must be smaller than 10 MiB.')
  decodeBase64(value)
  return { value, encoding }
}
