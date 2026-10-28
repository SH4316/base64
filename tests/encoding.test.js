import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ENCODINGS, encodeText, decodeText, inspectBytes } from '../lib/encodings.js'
import { ConversionError, MAX_BYTES } from '../lib/base64.js'
import { verifyCodecs } from '../scripts/verify-codecs.mjs'

const bytes = (...values) => Uint8Array.from(values)
const encoded = text => new TextEncoder().encode(text)

test('encoding list labels UHC and legacy variants accurately without loading tables in the window', async () => {
  assert.equal(new Set(ENCODINGS.map(item => item.id)).size, 12)
  assert.match(ENCODINGS.find(item => item.id === 'cp949').label, /CP949.*EUC-KR.*UHC/)
  assert.match(ENCODINGS.find(item => item.id === 'shift-jis').label, /Windows-31J/)
  assert.match(ENCODINGS.find(item => item.id === 'big5').label, /HKSCS/)
  const source = await readFile(new URL('../lib/encoding-options.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /^import\s/m)
  assert.throws(() => encodeText('text', 'imaginary'), ConversionError)
  assert.throws(() => decodeText(bytes(65), 'imaginary'), ConversionError)
})

test('Unicode encoders preserve code points, byte order, and literal BOM content without adding a BOM', () => {
  const text = 'ASCII 한글 中文 日本語 😀 e\u0301 \ufffd'
  for (const id of ['utf-8', 'utf-16le', 'utf-16be', 'utf-32le', 'utf-32be']) {
    for (const value of [text, `\ufeff${text}`, '']) {
      const output = encodeText(value, id)
      assert.equal(decodeText(output, id), value, id)
      assert.deepEqual(encodeText(decodeText(output, id), id), output, id)
    }
    const inspection = inspectBytes(encodeText(`\ufeff${text}`, id))
    assert.equal(inspection.encoding, id)
    assert.equal(inspection.text, `\ufeff${text}`)
    assert.equal(inspection.confidence, 'certain')
  }
  assert.deepEqual(encodeText('A😀', 'utf-16le'), bytes(65, 0, 0x3d, 0xd8, 0, 0xde))
  assert.deepEqual(encodeText('A😀', 'utf-16be'), bytes(0, 65, 0xd8, 0x3d, 0xde, 0))
  assert.deepEqual(encodeText('A😀', 'utf-32le'), bytes(65, 0, 0, 0, 0, 0xf6, 1, 0))
  assert.deepEqual(encodeText('A😀', 'utf-32be'), bytes(0, 0, 0, 65, 0, 1, 0xf6, 0))
})

test('Unicode decoding rejects malformed UTF-8, odd UTF-16, isolated surrogates and invalid UTF-32 scalars', () => {
  for (const value of [bytes(0xc0, 0xaf), bytes(0xe0, 0x80, 0x80), bytes(0xed, 0xa0, 0x80), bytes(0xf4, 0x90, 0x80, 0x80), bytes(0x80), bytes(0xe2, 0x82)]) assert.throws(() => decodeText(value, 'utf-8'), ConversionError)
  for (const [value, id] of [[bytes(65), 'utf-16le'], [bytes(0, 65, 0), 'utf-16be'], [bytes(0, 0xd8), 'utf-16le'], [bytes(0xdc, 0), 'utf-16be'], [bytes(0, 0, 0), 'utf-32le'], [bytes(0, 0xd8, 0, 0), 'utf-32le'], [bytes(0, 0x11, 0, 0), 'utf-32be']]) assert.throws(() => decodeText(value, id), ConversionError, id)
  for (const id of ENCODINGS.map(item => item.id)) for (const text of ['\ud800', '\udfff', 'valid\ud800after', '\ud800\ud800']) assert.throws(() => encodeText(text, id), /surrogate/)
  assert.equal(decodeText(bytes(0xef, 0xbf, 0xbd), 'utf-8'), '\ufffd')
})

test('legacy encodings match known Korean, Japanese, Chinese and Windows byte mappings', () => {
  for (const [id, text, value] of [
    ['cp949', '가', bytes(0xb0, 0xa1)], ['cp949', '갂', bytes(0x81, 0x41)],
    ['shift-jis', 'こんにちは', bytes(0x82, 0xb1, 0x82, 0xf1, 0x82, 0xc9, 0x82, 0xbf, 0x82, 0xcd)],
    ['gb18030', '中文', bytes(0xd6, 0xd0, 0xce, 0xc4)], ['big5', '中文', bytes(0xa4, 0xa4, 0xa4, 0xe5)],
    ['windows-1252', '€ “café”', bytes(0x80, 0x20, 0x93, 0x63, 0x61, 0x66, 0xe9, 0x94)],
    ['iso-8859-1', 'café', bytes(0x63, 0x61, 0x66, 0xe9)], ['ascii', 'Hello\n', bytes(72, 101, 108, 108, 111, 10)],
  ]) {
    assert.deepEqual(encodeText(text, id), value, id)
    assert.equal(decodeText(value, id), text, id)
  }
  assert.equal(decodeText(bytes(0x80), 'iso-8859-1'), '\u0080')
  assert.equal(decodeText(bytes(0x80), 'windows-1252'), '€')
  assert.throws(() => encodeText('€', 'iso-8859-1'), /cannot be represented/)
  assert.throws(() => encodeText('\u0080', 'windows-1252'), /cannot be represented/)
  assert.deepEqual(encodeText('갂', 'euc-kr'), bytes(0x81, 0x41))
})

test('legacy encoding never silently replaces characters with question marks or aliases', () => {
  for (const id of ['cp949', 'shift-jis', 'big5', 'windows-1252', 'iso-8859-1', 'ascii']) assert.throws(() => encodeText('A 😀 B', id), /cannot be represented/)
  for (const id of ENCODINGS.map(item => item.id)) assert.equal(decodeText(encodeText('literal ?', id), id), 'literal ?')
  assert.throws(() => encodeText('¥', 'shift-jis'), /cannot be represented exactly/)
  assert.throws(() => encodeText('é', 'ascii'), /cannot be represented/)
  assert.equal(decodeText(encodeText('😀\ufffd', 'gb18030'), 'gb18030'), '😀\ufffd')
})

test('legacy decoding rejects truncated, undefined and lossy byte sequences', () => {
  for (const [id, value] of [['cp949', bytes(0x81)], ['cp949', bytes(0xff)], ['shift-jis', bytes(0x82)], ['shift-jis', bytes(0x82, 0x20)], ['gb18030', bytes(0x81, 0x30, 0x81)], ['big5', bytes(0xa4)], ['ascii', bytes(0x80)]]) assert.throws(() => decodeText(value, id), ConversionError, id)
  for (const value of [0x81, 0x8d, 0x8f, 0x90, 0x9d]) assert.throws(() => decodeText(bytes(value), 'windows-1252'), ConversionError)
})

test('encoding chunks preserve surrogate pairs and UTF-32 decoding handles large strings safely', () => {
  const text = 'a'.repeat(32767) + '😀中文' + 'b'.repeat(33000)
  for (const id of ['utf-8', 'utf-16le', 'utf-32be', 'gb18030']) assert.equal(decodeText(encodeText(text, id), id), text)
  const large = '한글 😀 '.repeat(12000)
  assert.equal(decodeText(encodeText(large, 'utf-32le'), 'utf-32le'), large)
})

test('auto detects strict UTF-8 and strong UTF-16/UTF-32 patterns without requiring a BOM', () => {
  assert.equal(inspectBytes(bytes()).text, '')
  assert.equal(inspectBytes(encoded('hello')).encoding, 'utf-8')
  assert.equal(inspectBytes(encoded('한글과 😀')).text, '한글과 😀')
  for (const id of ['utf-16le', 'utf-16be', 'utf-32le', 'utf-32be']) {
    const result = inspectBytes(encodeText('Hello, world! This is a text file.\n', id))
    assert.equal(result.encoding, id)
    assert.equal(result.text, 'Hello, world! This is a text file.\n')
    assert.equal(result.confidence, 'high')
  }
  const malformed = inspectBytes(bytes(0xff, 0xfe, 65))
  assert.equal(malformed.text, null)
  assert.match(malformed.reason, /malformed/)
})

test('statistical legacy estimates stay explicitly uncertain and exact across complete bytes', () => {
  const samples = [
    ['cp949', '안녕하세요. 이 문장은 한국어 인코딩을 확인하기 위한 예제입니다. 원본 파일의 내용을 정확하게 유지합니다. '.repeat(8)],
    ['shift-jis', 'こんにちは。これは日本語の文字コードを確認するための文章です。元のファイルを正確に保存します。'.repeat(8)],
    ['gb18030', '这是一段用于检查中文编码的示例文字。转换后应该保留所有字符，保证原始文件内容不丢失。'.repeat(8)],
    ['big5', '這是一段用來檢查繁體中文編碼的範例文字。轉換後應該保留所有字元，確保原始檔案內容不會遺失。'.repeat(8)],
  ]
  for (const [id, text] of samples) {
    const value = encodeText(text, id)
    const result = inspectBytes(value)
    assert.equal(result.encoding, id)
    assert.equal(result.text, text)
    assert.equal(result.confidence, 'uncertain')
    assert.match(result.reason, /statistical estimate/)
    const broken = new Uint8Array(value.length + 1)
    broken.set(value); broken[value.length] = 0x81
    assert.equal(inspectBytes(broken).text, null)
  }
})

test('short or arbitrary binary is never promoted to Latin-1/Windows-1252 just because it can decode', () => {
  for (const value of [bytes(0xff), bytes(0xe9, 0xe9, 0xe9), bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16), bytes(0x89, 80, 78, 71, 13, 10, 26, 10), encoded('%PDF-1.7'), bytes(65, 0, 66), new Uint8Array(32).fill(0xff), Uint8Array.from({ length: 2048 }, (_, index) => (index * 73 + 29) % 256)]) assert.equal(inspectBytes(value).text, null)
  for (const id of ['utf-8', 'utf-16le', 'utf-16be', 'utf-32le', 'utf-32be', 'cp949', 'shift-jis', 'gb18030', 'big5', 'windows-1252', 'iso-8859-1', 'ascii']) assert.equal(inspectBytes(bytes(0, 0, 0, 0, 0, 0, 0, 0), id).text, null, id)
  assert.equal(inspectBytes(encoded('MZ is also ordinary text'), 'utf-8').text, 'MZ is also ordinary text')
  assert.equal(inspectBytes(bytes(0xe9), 'iso-8859-1').text, 'é')
  assert.equal(inspectBytes(bytes(0x81), 'windows-1252').text, null)
  assert.match(inspectBytes(bytes(0x81), 'windows-1252').reason, /not valid/)
  assert.equal(inspectBytes(encoded('hello'), 'binary').text, null)
})

test('byte views respect offsets, remain unmodified, and enforce the 10 MiB cap before decoding', () => {
  const backing = bytes(0xff, 0xff, 0, 65, 0, 66, 0xff)
  const view = backing.subarray(2, 6)
  assert.equal(decodeText(view, 'utf-16be'), 'AB')
  assert.deepEqual(backing, bytes(0xff, 0xff, 0, 65, 0, 66, 0xff))
  const tooLarge = new Uint8Array(MAX_BYTES + 1)
  for (const operation of [() => decodeText(tooLarge), () => inspectBytes(tooLarge), () => encodeText('€'.repeat(Math.floor(MAX_BYTES / 3) + 1)), () => encodeText('a'.repeat(MAX_BYTES / 2 + 1), 'utf-16le')]) assert.throws(operation, /10 MiB/)
  assert.equal(encodeText('a'.repeat(MAX_BYTES)).length, MAX_BYTES)
})

test('all vendored runtime and transitive versions/licenses are pinned and notices survive distribution', async t => {
  const manifest = await verifyCodecs()
  assert.equal(manifest.packages.length, 8)
  assert.ok(manifest.packages.every(item => ['MIT', 'BSD-3-Clause'].includes(item.license)))
  const temporary = await mkdtemp(path.join(tmpdir(), 'base64-codec-notices-'))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  await cp('vendor', path.join(temporary, 'vendor'), { recursive: true })
  await cp('THIRD-PARTY-NOTICES.txt', path.join(temporary, 'THIRD-PARTY-NOTICES.txt'))
  await verifyCodecs(temporary)
  await writeFile(path.join(temporary, 'vendor/licenses/ieee754-LICENSE'), 'missing copyright')
  await assert.rejects(verifyCodecs(temporary), /license missing/)
})
