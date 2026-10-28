import { formatBytes, MAX_BASE64_FILE_BYTES, MAX_BASE64_LENGTH, MAX_BYTES } from './lib/base64.js'
import { ENCODINGS } from './lib/encoding-options.js'

const $ = selector => document.querySelector(selector)
const text = $('#plain-text')
const base64 = $('#base64-text')
const panels = [...document.querySelectorAll('.editor-panel')]
const counters = [...document.querySelectorAll('.byte-count')]
const encode = $('.convert-button.primary')
const decode = $('.convert-button.secondary')
const clear = $('.reset-button')
const example = $('.sample-button')
const copyText = $('[aria-label="Copy plain text"]')
const copyBase64 = $('[aria-label="Copy Base64"]')
const downloadText = $('[aria-label="Download plain text or file"]')
const downloadBase64 = $('[aria-label="Download Base64"]')
const [urlSafe, padding] = document.querySelectorAll('.options input')
const encodingSelect = $('#text-encoding')
const encodingStatus = $('#encoding-status')
const fileInputs = [...document.querySelectorAll('input[type="file"]')]
const uploads = [...document.querySelectorAll('.text-button')]
const feedback = $('.feedback')
const sample = 'Hello, world!\n안녕하세요 👋\nA little text. A whole lot of possibilities.'
let source = null
let base64Source = null
let busy = null
let pending = null
let requestId = 0
let timer
let measureTimer
let measuredBytes = 0
let encodingError = ''
let worker

const encoding = () => encodingSelect.value
const textEncoding = () => encoding() === 'auto' ? 'utf-8' : encoding()
const label = id => ENCODINGS.find(item => item.id === id)?.label || id
encodingSelect.replaceChildren(
  new Option('Auto detect', 'auto'),
  ...ENCODINGS.map(item => new Option(item.label, item.id)),
  new Option('Binary (HEX)', 'binary'),
)
encodingSelect.value = 'auto'

function notify(kind, message) {
  feedback.className = `feedback ${kind}`
  feedback.setAttribute('role', kind === 'error' ? 'alert' : 'status')
  feedback.textContent = message
}

function describeEncoding() {
  if (encodingError) return `${encodingError}${source ? ' Original bytes and the previous view are kept.' : ''}`
  if (source) {
    if (source.selection !== encoding()) return `Showing ${source.binary ? 'Binary (HEX)' : label(source.encoding)}. The selected encoding is not applied to this view; original bytes kept.`
    if (source.binary) return encoding() === 'binary'
      ? 'Binary (HEX) selected. Original bytes kept for Encode and download.'
      : 'Encoding uncertain. Choose a charset to try text, or keep Binary (HEX). Original bytes kept.'
    const mode = encoding() === 'auto'
      ? `${source.confidence === 'uncertain' ? 'Likely' : 'Detected'} ${label(source.encoding)}${source.confidence === 'uncertain' ? ' (uncertain; check the text)' : ''}`
      : `${label(source.encoding)} selected`
    return `${mode}. Original bytes kept. ${encoding() === 'auto' ? 'Editing uses UTF-8; choose a charset to change that.' : 'Edit text to change encoded bytes.'}`
  }
  if (encoding() === 'binary') return 'Binary view is available after uploading or decoding bytes. Choose a text encoding to encode typed text.'
  return encoding() === 'auto'
    ? 'Auto detection applies to bytes; typed text uses UTF-8.'
    : `Typed and edited text uses ${label(textEncoding())}. Unrepresentable characters are rejected.`
}

function render() {
  const hasText = Boolean(text.value || source)
  const binary = Boolean(source?.binary)
  encode.disabled = !hasText || Boolean(busy) || !worker || (!source && encoding() === 'binary')
  decode.disabled = !base64.value.trim() || Boolean(busy) || !worker
  encode.setAttribute('aria-busy', String(busy === 'encode'))
  decode.setAttribute('aria-busy', String(busy === 'decode'))
  clear.disabled = !hasText && !base64.value && !busy
  copyText.disabled = !text.value
  const copyLabel = binary ? 'Copy hex' : 'Copy plain text'
  copyText.setAttribute('aria-label', copyLabel)
  copyText.title = copyLabel
  copyBase64.disabled = !base64.value
  downloadText.disabled = !hasText || Boolean(busy) || (!source && (!worker || encoding() === 'binary'))
  downloadBase64.disabled = !base64.value
  uploads.forEach(button => { button.disabled = busy === 'file' })
  text.readOnly = binary
  panels[0].querySelector('label').textContent = binary ? 'Binary data' : 'Plain text'
  panels[0].querySelector('.format-tag').textContent = binary ? 'HEX' : label(source?.encoding || (textEncoding() === 'binary' ? 'utf-8' : textEncoding()))
  example.hidden = hasText
  counters[0].textContent = source ? formatBytes(source.bytes.length) : measuredBytes === null ? 'Calculating…' : measuredBytes < 0 ? 'Not representable' : formatBytes(measuredBytes)
  counters[1].textContent = `${base64.value.length.toLocaleString('en-US')} chars`
  encodingStatus.textContent = describeEncoding()
  encodingSelect.setAttribute('aria-invalid', String(Boolean(encodingError || source && source.selection !== encoding() && busy !== 'inspect')))
  $('.file-chip')?.remove()
  if (source) {
    const chip = document.createElement('div')
    chip.className = 'file-chip'
    const name = document.createElement('span')
    name.textContent = source.name
    name.title = source.name
    const size = document.createElement('span')
    size.textContent = formatBytes(source.bytes.length)
    const remove = document.createElement('button')
    remove.textContent = 'Remove'
    remove.setAttribute('aria-label', 'Remove file')
    remove.onclick = () => {
      invalidate()
      if (source?.binary) text.value = ''
      source = null
      measure()
      render()
    }
    chip.append(name, size, remove)
    panels[0].querySelector('.editor-content').prepend(chip)
  }
}

function invalidate() {
  requestId++
  busy = null
  pending = null
  encodingError = ''
  clearTimeout(measureTimer)
  notify('', 'Use Encode or Decode to choose your conversion direction.')
}

function measure() {
  clearTimeout(measureTimer)
  if (source) return
  if (!text.value) { measuredBytes = 0; return }
  if (encoding() === 'binary') { measuredBytes = -1; return }
  measuredBytes = null
  const id = requestId
  measureTimer = setTimeout(() => {
    if (id !== requestId || !worker || source || busy) return
    worker.postMessage({ id, direction: 'measure', input: text.value, encoding: textEncoding() })
  }, 180)
}

function send(direction, input, details = {}) {
  if (!worker) return
  clearTimeout(measureTimer)
  busy = direction
  pending = { direction, ...details }
  worker.postMessage({ id: ++requestId, direction, input, encoding: encoding(), urlSafe: urlSafe.checked, padding: padding.checked })
  render()
}

function convert(direction) {
  if (!worker || busy || (direction === 'encode' ? !text.value && !source || !source && encoding() === 'binary' : !base64.value.trim())) return
  encodingError = ''
  notify('', direction === 'encode' ? 'Encoding…' : 'Decoding…')
  send(direction, direction === 'encode' ? source?.bytes ?? text.value : base64.value)
}

function applyView(data, name) {
  text.value = data.text ?? data.hex
  source = { name, bytes: data.bytes, binary: data.text === null, encoding: data.encoding, confidence: data.confidence, reason: data.reason, selection: encoding() }
  encodingError = ''
}

try {
  worker = new Worker(new URL('./converter.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }) => {
    if (data.id !== requestId) return
    if (data.direction === 'measure' || data.direction === 'error' && data.operation === 'measure') {
      measuredBytes = data.direction === 'measure' ? data.byteLength : -1
      encodingError = data.direction === 'measure' ? '' : data.error
      render()
      return
    }
    const job = pending
    busy = null
    pending = null
    if (data.direction === 'error') {
      if (data.phase === 'encoding') {
        encodingError = data.error
        if (!source) measuredBytes = -1
      } else if (!source) measure()
      notify('error', data.error)
    } else if (data.direction === 'encode') {
      base64.value = data.value
      base64Source = null
      if (!source) measuredBytes = data.byteLength
      notify('success', source ? 'Encoded the original bytes. Your Base64 is ready.' : `Encoded as ${label(data.encoding)}. Your Base64 is ready.`)
    } else if (data.direction === 'download') {
      measuredBytes = data.bytes.length
      download(data.bytes, 'text.txt')
      notify('success', `Downloaded text encoded as ${label(data.encoding)}.`)
    } else if (data.direction === 'read-base64-file') {
      base64.value = data.value
      base64Source = { bytes: data.bytes, name: job.name }
      if (!source) measure()
      notify('success', `“${job.name}” loaded as ${label(data.documentEncoding)}. Select Decode to interpret the Base64 payload. Original file bytes kept for download.`)
    } else {
      applyView(data, job?.name || (data.text === null ? 'decoded.bin' : 'decoded.txt'))
      notify('success', data.text === null
        ? 'Decoded binary data. Hex is shown on the left; download saves the original bytes. Choose an encoding to try a text view.'
        : `${job?.direction === 'inspect' ? 'Text view updated' : 'Decoded'}. ${data.confidence === 'uncertain' ? 'Encoding is uncertain; check the text or choose an encoding. ' : ''}Original bytes kept for Encode and download.`)
    }
    render()
  }
  worker.onerror = () => { busy = null; pending = null; worker.terminate(); worker = null; notify('error', 'The converter could not start. Reload the page and try again.'); render() }
} catch { notify('error', 'The converter could not start. Serve this folder over HTTP and reload the page.') }

async function loadFile(file, target) {
  invalidate()
  const id = requestId
  if (file.size > (target === 0 ? MAX_BYTES : MAX_BASE64_FILE_BYTES)) {
    notify('error', 'This file is too large. Source files and decoded payloads must be smaller than 10 MiB. Base64 documents allow Unicode character storage overhead.'); measure(); render(); return
  }
  busy = 'file'
  notify('', 'Reading your file…')
  render()
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (id !== requestId) return
    if (!worker) throw new Error('The converter is unavailable. Reload the page and try again.')
    send(target === 0 ? 'inspect' : 'read-base64-file', bytes, { name: file.name })
  } catch (error) {
    if (id !== requestId) return
    busy = null
    notify('error', error.message || 'Could not read this file.')
    measure()
    render()
  }
}

function download(content, name) {
  const url = URL.createObjectURL(new Blob([content], { type: typeof content === 'string' ? 'text/plain;charset=utf-8' : 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function copy(input, button) {
  try {
    await navigator.clipboard.writeText(input.value)
    clearTimeout(timer)
    button.title = 'Copied!'
    notify('success', 'Copied to clipboard.')
    timer = setTimeout(() => { button.title = button.getAttribute('aria-label') }, 2000)
  } catch { input.focus(); input.select(); notify('error', 'Clipboard access is unavailable. The text is selected; use Ctrl+C or ⌘C to copy.') }
}

text.maxLength = base64.maxLength = MAX_BASE64_LENGTH
text.addEventListener('input', () => { invalidate(); source = null; measure(); render() })
base64.addEventListener('input', () => { invalidate(); base64Source = null; measure(); render() })
urlSafe.addEventListener('change', () => { invalidate(); measure(); render() })
padding.addEventListener('change', () => { invalidate(); measure(); render() })
encodingSelect.addEventListener('change', () => {
  invalidate()
  if (source) {
    notify('', 'Reinterpreting the original bytes…')
    send('inspect', source.bytes, { name: source.name })
  } else { measure(); render() }
})
encode.onclick = () => convert('encode')
decode.onclick = () => convert('decode')
clear.onclick = () => { invalidate(); source = base64Source = null; text.value = ''; base64.value = ''; measuredBytes = 0; render(); text.focus() }
example.onclick = () => { invalidate(); text.value = sample; source = null; measure(); render(); text.focus() }
copyText.onclick = () => copy(text, copyText)
copyBase64.onclick = () => copy(base64, copyBase64)
downloadText.onclick = () => {
  if (source) download(source.bytes, source.name)
  else if (!busy && worker && text.value && encoding() !== 'binary') {
    notify('', 'Preparing your encoded text…')
    send('download', text.value)
  }
}
downloadBase64.onclick = () => download(base64Source?.bytes ?? base64.value, base64Source?.name ?? 'encoded.txt')
$('.workbench').addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.isComposing) { event.preventDefault(); convert(event.target === base64 ? 'decode' : 'encode') }
})
panels.forEach((panel, index) => {
  uploads[index].onclick = () => fileInputs[index].click()
  fileInputs[index].onchange = event => { const file = event.target.files[0]; if (file) void loadFile(file, index); event.target.value = '' }
  panel.ondragover = event => { if (!event.dataTransfer.types.includes('Files')) return; event.preventDefault(); panel.classList.add('dragging') }
  panel.ondragleave = event => { if (!panel.contains(event.relatedTarget)) panel.classList.remove('dragging') }
  panel.ondrop = event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); panel.classList.remove('dragging'); void loadFile(event.dataTransfer.files[0], index) }
})
render()
