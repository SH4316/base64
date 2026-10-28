// Import this module in the converter worker, not in the window.
import { iconv, Buffer, analyse } from '../vendor/codecs.js'
import { ConversionError, MAX_BYTES } from './base64.js'
import { ENCODINGS } from './encoding-options.js'
export { ENCODINGS }

const labels = new Map(ENCODINGS.map(item => [item.id, item.label]))
const aliases = new Map(ENCODINGS.map(item => [item.id.replace(/[^a-z0-9]/g, ''), item.id]))
for (const [name, id] of Object.entries({ euckr: 'cp949', uhc: 'cp949', windows949: 'cp949', shiftjis: 'shift-jis', windows31j: 'shift-jis', cp932: 'shift-jis', latin1: 'iso-8859-1', usascii: 'ascii', win1252: 'windows-1252', big5hkscs: 'big5' })) aliases.set(name, id)
const legacy = new Set(['cp949', 'shift-jis', 'gb18030', 'big5'])
const windows1252 = [0x20ac, -1, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, -1, 0x017d, -1, -1, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, -1, 0x017e, 0x0178]
const windowsReverse = new Map(windows1252.flatMap((point, index) => point < 0 ? [] : [[point, index + 0x80]]))
const maximum = () => new ConversionError('This input is too large. Encoded text and decoded files must be no larger than 10 MiB.')

function encodingId(value) {
  const id = typeof value === 'string' && aliases.get(value.toLowerCase().replace(/[^a-z0-9]/g, ''))
  if (!id) throw new ConversionError('Choose a supported text encoding.')
  return id
}

function byteInput(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new ConversionError('Provide a byte array to decode.')
  if (bytes.byteLength > MAX_BYTES) throw maximum()
  return bytes
}

function validateText(text, id) {
  if (typeof text !== 'string') throw new ConversionError('Provide text to encode.')
  if (text.length > MAX_BYTES) throw maximum()
  let size = 0
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index)
    let point = unit
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = text.charCodeAt(++index)
      if (!(low >= 0xdc00 && low <= 0xdfff)) throw new ConversionError('The text contains an incomplete Unicode surrogate pair.')
      point = 0x10000 + ((unit - 0xd800) << 10) + low - 0xdc00
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new ConversionError('The text contains an incomplete Unicode surrogate pair.')
    size += id === 'utf-8' ? point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4
      : id.startsWith('utf-32') ? 4 : id.startsWith('utf-16') ? point > 0xffff ? 4 : 2 : 1
    if (size > MAX_BYTES) throw maximum()
  }
  return size
}

function sameBytes(left, right) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return false
  return true
}

function legacyEncode(text, id) {
  const encoder = iconv.getEncoder(id, { addBOM: false })
  const chunks = []
  let length = 0
  const append = chunk => {
    if (!chunk?.length) return
    length += chunk.length
    if (length > MAX_BYTES) throw maximum()
    chunks.push(chunk)
  }
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset + 32768, text.length)
    const unit = text.charCodeAt(end - 1)
    if (end < text.length && unit >= 0xd800 && unit <= 0xdbff) end--
    append(encoder.write(text.slice(offset, end)))
    offset = end
  }
  append(encoder.end())
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return bytes
}

export function encodeText(text, encoding = 'utf-8') {
  const id = encodingId(encoding)
  const size = validateText(text, id)
  if (id === 'utf-8') return new TextEncoder().encode(text)
  if (id.startsWith('utf-16') || id.startsWith('utf-32')) {
    const bytes = new Uint8Array(size)
    const view = new DataView(bytes.buffer)
    const littleEndian = id.endsWith('le')
    if (id.startsWith('utf-16')) {
      for (let index = 0; index < text.length; index++) view.setUint16(index * 2, text.charCodeAt(index), littleEndian)
    } else {
      let offset = 0
      for (const character of text) { view.setUint32(offset, character.codePointAt(0), littleEndian); offset += 4 }
    }
    return bytes
  }
  if (legacy.has(id)) {
    const bytes = legacyEncode(text, id)
    if (iconv.decode(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), id, { stripBOM: false }) !== text) {
      throw new ConversionError(`Some characters cannot be represented exactly in ${labels.get(id)}. Choose UTF-8 or another encoding.`)
    }
    return bytes
  }
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index)
    const value = id === 'windows-1252' && unit >= 0x80 && unit <= 0x9f ? undefined
      : unit <= (id === 'ascii' ? 0x7f : 0xff) ? unit : id === 'windows-1252' ? windowsReverse.get(unit) : undefined
    if (value === undefined) throw new ConversionError(`Some characters cannot be represented in ${labels.get(id)}. Choose UTF-8 or another encoding.`)
    bytes[index] = value
  }
  return bytes
}

export function decodeText(input, encoding = 'utf-8') {
  const bytes = byteInput(input)
  const id = encodingId(encoding)
  try {
    if (id === 'utf-8' || id.startsWith('utf-16')) return new TextDecoder(id, { fatal: true, ignoreBOM: true }).decode(bytes)
    if (id.startsWith('utf-32')) {
      if (bytes.length % 4) throw new Error('Incomplete UTF-32 unit')
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      const chunks = []
      let points = []
      for (let offset = 0; offset < bytes.length; offset += 4) {
        const point = view.getUint32(offset, id.endsWith('le'))
        if (point > 0x10ffff || point >= 0xd800 && point <= 0xdfff) throw new Error('Invalid UTF-32 scalar')
        points.push(point)
        if (points.length === 8192) { chunks.push(String.fromCodePoint(...points)); points = [] }
      }
      if (points.length) chunks.push(String.fromCodePoint(...points))
      return chunks.join('')
    }
    if (legacy.has(id)) {
      const text = iconv.decode(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), id, { stripBOM: false })
      if (!sameBytes(legacyEncode(text, id), bytes)) throw new Error('Malformed or noncanonical byte sequence')
      return text
    }
    const chunks = []
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      const units = []
      for (const byte of bytes.subarray(offset, offset + 8192)) {
        if (id === 'ascii' && byte > 0x7f) throw new Error('Not ASCII')
        const unit = id === 'windows-1252' && byte >= 0x80 && byte <= 0x9f ? windows1252[byte - 0x80] : byte
        if (unit < 0) throw new Error('Undefined Windows-1252 byte')
        units.push(unit)
      }
      chunks.push(String.fromCharCode(...units))
    }
    return chunks.join('')
  } catch (error) {
    if (error instanceof ConversionError) throw error
    throw new ConversionError(`The bytes are not valid, lossless ${labels.get(id)} text. Choose another encoding or keep the original bytes.`)
  }
}

function binarySignature(bytes) {
  const prefix = String.fromCharCode(...bytes.subarray(0, 16))
  return /^(?:\x89PNG\r\n\x1a\n|GIF8[79]a|%PDF-|PK\x03\x04|PK\x05\x06|\x1f\x8b|7z\xbc\xaf\x27\x1c|Rar!|\x7fELF|\x00asm|MZ|SQLite format 3|RIFF|OggS|fLaC|ID3|\xff\xd8\xff|II\x2a\x00|MM\x00\x2a|\x00\x00\x01\x00|\xca\xfe\xba\xbe)/.test(prefix)
}

function readable(text) {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(text)) return false
  for (const character of text) {
    const point = character.codePointAt(0)
    if (point >= 0xfdd0 && point <= 0xfdef || (point & 0xffff) >= 0xfffe) return false
  }
  return true
}

function strongUnicode(bytes) {
  const length = Math.min(bytes.length, 65536)
  if (bytes.length >= 16 && bytes.length % 4 === 0) {
    const zeros = [0, 0, 0, 0]
    for (let index = 0; index < length - length % 4; index++) if (bytes[index] === 0) zeros[index % 4]++
    const units = Math.floor(length / 4)
    if (zeros[2] / units > 0.95 && zeros[3] / units > 0.95 && zeros[0] / units < 0.25) return 'utf-32le'
    if (zeros[0] / units > 0.95 && zeros[1] / units > 0.95 && zeros[3] / units < 0.25) return 'utf-32be'
  }
  if (bytes.length >= 8 && bytes.length % 2 === 0) {
    let even = 0
    let odd = 0
    for (let index = 0; index < length - 1; index += 2) { if (bytes[index] === 0) even++; if (bytes[index + 1] === 0) odd++ }
    const units = Math.floor(length / 2)
    if (odd / units >= 0.6 && even / units <= 0.1) return 'utf-16le'
    if (even / units >= 0.6 && odd / units <= 0.1) return 'utf-16be'
  }
  return null
}

export function inspectBytes(input, selection = 'auto') {
  const bytes = byteInput(input)
  const none = reason => ({ text: null, encoding: null, confidence: 'none', reason })
  if (selection === 'binary') return none('Showing the original bytes without interpreting them as text.')
  if (selection !== 'auto') {
    const id = encodingId(selection)
    try {
      const text = decodeText(bytes, id)
      return readable(text) ? { text, encoding: id, confidence: 'certain', reason: `Decoded using your selected ${labels.get(id)} encoding.` }
        : none('The decoded content contains binary control characters. The original bytes are preserved.')
    } catch (error) { return none(error.message) }
  }
  if (binarySignature(bytes)) return none('A binary file signature was found. The original bytes are preserved.')
  let bom = null
  if (bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0 && bytes[3] === 0) bom = 'utf-32le'
  else if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xfe && bytes[3] === 0xff) bom = 'utf-32be'
  else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bom = 'utf-8'
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) bom = 'utf-16le'
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) bom = 'utf-16be'
  const unicode = bom || strongUnicode(bytes)
  if (unicode) {
    try {
      const text = decodeText(bytes, unicode)
      if (readable(text)) return { text, encoding: unicode, confidence: bom ? 'certain' : 'high', reason: bom ? `A ${labels.get(unicode)} byte-order mark was found and preserved.` : `Strong byte patterns indicate ${labels.get(unicode)} text.` }
    } catch { /* A malformed BOM is not reinterpreted as a legacy encoding. */ }
    if (bom) return none('A Unicode byte-order mark was found, but the remaining bytes are malformed or binary.')
  }
  try {
    const text = decodeText(bytes, 'utf-8')
    return readable(text) ? { text, encoding: 'utf-8', confidence: 'high', reason: bytes.length ? 'The bytes form valid UTF-8 text. ASCII text is also compatible with UTF-8.' : 'Empty text is compatible with UTF-8.' }
      : none('The decoded content contains binary control characters. The original bytes are preserved.')
  } catch { /* Legacy guesses require statistical evidence, not just decodability. */ }
  if (bytes.length < 16 || bytes.some(byte => byte < 0x20 && ![9, 10, 13].includes(byte) || byte === 0x7f)) return none('There is not enough reliable text evidence. Choose an encoding or keep the original bytes.')
  const sample = bytes.subarray(0, 65536)
  const highBytes = sample.reduce((count, byte) => count + (byte >= 0x80), 0)
  if (highBytes < 4) return none('There is not enough reliable text evidence. Choose an encoding or keep the original bytes.')
  const guesses = analyse(sample)
  const supported = guesses.flatMap(guess => {
    let id
    try { id = encodingId(guess.name) } catch { return [] }
    return !id.startsWith('utf-') && id !== 'ascii' && guess.confidence >= 60 ? [{ id, score: guess.confidence }] : []
  }).filter((guess, index, list) => list.findIndex(item => item.id === guess.id) === index)
  if (!supported.length || guesses[0].confidence > supported[0].score + 5) return none('No supported text encoding can be identified reliably. Choose an encoding or keep the original bytes.')
  const candidates = supported.slice(0, 3).map(guess => guess.id)
  if (supported[1] && supported[0].score - supported[1].score < 10) return { ...none('Several text encodings fit these bytes. Choose the correct encoding before editing.'), confidence: 'uncertain', candidates }
  try {
    const id = supported[0].id
    const text = decodeText(bytes, id)
    if (readable(text)) return { text, encoding: id, confidence: 'uncertain', reason: `${labels.get(id)} is a statistical estimate. Verify the text or choose its encoding before editing.`, candidates }
  } catch { /* Failed exact decoding remains a byte view. */ }
  return none('The bytes could not be decoded as reliable text. Choose an encoding or keep the original bytes.')
}
