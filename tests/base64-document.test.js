import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readBase64Document } from '../lib/base64-document.js'
import { MAX_BASE64_LENGTH, MAX_BASE64_FILE_BYTES, MAX_BYTES, encodeBase64 } from '../lib/base64.js'

function unicode(value, width, littleEndian) {
  const points = width === 4 ? [...value].map(character => character.codePointAt(0)) : [...value].map(character => character.charCodeAt(0))
  const bytes = new Uint8Array(points.length * width)
  const view = new DataView(bytes.buffer)
  points.forEach((point, index) => width === 4 ? view.setUint32(index * width, point, littleEndian) : view.setUint16(index * width, point, littleEndian))
  return bytes
}

for (const [encoding, width, littleEndian] of [['utf-16le', 2, true], ['utf-16be', 2, false], ['utf-32le', 4, true], ['utf-32be', 4, false]]) {
  test(`reads Base64 document ${encoding} with or without BOM, independently of payload`, () => {
    for (const bom of ['', '\uFEFF']) {
      const value = `${bom}SGVsbG8=\r\n`
      assert.deepEqual(readBase64Document(unicode(value, width, littleEndian)), { value, encoding })
    }
  })
}

test('reads UTF-8 BOM, ASCII-compatible legacy files, whitespace and data URLs', () => {
  for (const value of ['\uFEFFSGVsbG8=\n', 'SGVsbG8=\r\n', 'data:text/plain;base64,SGVsbG8=']) {
    assert.deepEqual(readBase64Document(new TextEncoder().encode(value)), { value, encoding: 'utf-8' })
  }
})

test('rejects malformed document encodings and invalid Base64 without guessing a legacy payload charset', () => {
  for (const bytes of [new Uint8Array([0xff, 0xfe, 0x41]), new Uint8Array([0, 0, 0xfe, 0xff, 0]), new Uint8Array([0xff]), new TextEncoder().encode('not Base64!')]) {
    assert.throws(() => readBase64Document(bytes))
  }
})

test('Base64 document character and physical byte limits remain bounded', () => {
  assert.throws(() => readBase64Document(new Uint8Array(MAX_BASE64_FILE_BYTES + 1)), /too large/)
  assert.throws(() => readBase64Document(new TextEncoder().encode(' '.repeat(MAX_BASE64_LENGTH + 1))), /too large/)
})

test('Unicode Base64 document may exceed 10 MiB on disk while its decoded payload remains bounded', () => {
  const value = encodeBase64(new Uint8Array(4 * 1024 * 1024).fill(65))
  const document = Buffer.from(value, 'utf16le')
  assert.ok(document.byteLength > MAX_BYTES)
  assert.deepEqual(readBase64Document(document), { value, encoding: 'utf-16le' })
  const tooLarge = Buffer.alloc(MAX_BYTES + 1, 65).toString('base64')
  assert.throws(() => readBase64Document(new TextEncoder().encode(tooLarge)), /too large/)
})
