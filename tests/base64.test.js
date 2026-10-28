import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeBase64, encodeBase64, formatHex, readUtf8, MAX_BYTES } from '../lib/base64.js'
const utf8 = value => new TextEncoder().encode(value)

for (const [plain, encoded] of [['',''],['f','Zg=='],['fo','Zm8='],['foo','Zm9v'],['foobar','Zm9vYmFy']]) {
  test(`RFC 4648 vector: ${plain || 'empty'}`, () => { assert.equal(encodeBase64(utf8(plain)), encoded); assert.deepEqual(decodeBase64(encoded), utf8(plain)) })
}
for (const text of ['안녕하세요 👋','日本語 / 中文','café\r\nnaïve','\uFEFFkeep the BOM']) {
  test(`Unicode round-trip: ${text}`, () => assert.equal(readUtf8(decodeBase64(encodeBase64(utf8(text)))), text))
}
test('preserves every byte and large chunk boundaries', () => {
  const bytes = Uint8Array.from({ length: 65539 }, (_, index) => index % 256)
  assert.deepEqual(decodeBase64(encodeBase64(bytes)), bytes)
  assert.equal(readUtf8(bytes), null)
})
test('supports URL-safe values with optional padding', () => {
  const bytes = new Uint8Array([251, 255])
  assert.equal(encodeBase64(bytes), '+/8=')
  assert.equal(encodeBase64(bytes, true), '-_8=')
  assert.equal(encodeBase64(bytes, true, false), '-_8')
  assert.deepEqual(decodeBase64('-_8'), bytes)
  assert.deepEqual(decodeBase64('-_8='), bytes)
})
test('accepts whitespace, unpadded input, and data URLs', () => {
  for (const value of [' aG Vs\nbG8=\r\n','aGVsbG8','data:text/plain;charset=utf-8;base64,aGVsbG8=']) assert.equal(readUtf8(decodeBase64(value)), 'hello')
})
for (const value of ['A','Zg=','Zg===','Zm=9v','abcd!','====','+_8=','Zh==','Zm9=','data:text/plain,hello','data:text/plain;base64,']) {
  test(`rejects malformed input: ${value}`, () => assert.throws(() => decodeBase64(value)))
}
test('recognizes binary controls and invalid UTF-8', () => {
  assert.equal(readUtf8(new Uint8Array([255])), null)
  assert.equal(readUtf8(new Uint8Array([0])), null)
  assert.equal(readUtf8(utf8('line\n\ttab')), 'line\n\ttab')
})
test('formats binary bytes as uppercase, zero-padded hex', () => {
  assert.equal(formatHex(new Uint8Array([0, 1, 15, 16, 127, 128, 171, 255])), '00 01 0F 10 7F 80 AB FF')
  assert.equal(formatHex(new Uint8Array()), '')
})
test('wraps hex at 16 bytes without trailing spaces or an extra line', () => {
  const bytes = Uint8Array.from({ length: 17 }, (_, index) => index)
  assert.equal(formatHex(bytes.subarray(0, 16)), '00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F')
  assert.equal(formatHex(bytes), '00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F\n10')
})
test('enforces the input size limit', () => assert.throws(() => encodeBase64(new Uint8Array(MAX_BYTES + 1)), /too large/))
