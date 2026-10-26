import { formatBytes, MAX_BASE64_LENGTH, MAX_BYTES, readUtf8 } from './lib/base64.js'

const $ = (selector) => document.querySelector(selector)
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
const fileInputs = [...document.querySelectorAll('input[type="file"]')]
const uploads = [...document.querySelectorAll('.text-button')]
const feedback = $('.feedback')
const sample = 'Hello, world!\n안녕하세요 👋\nA little text. A whole lot of possibilities.'
let source = null
let busy = null
let requestId = 0
let timer
let worker

function notify(kind, message) {
  feedback.className = `feedback ${kind}`
  feedback.setAttribute('role', kind === 'error' ? 'alert' : 'status')
  feedback.textContent = message
}

function render() {
  const hasText = Boolean(text.value || source)
  encode.disabled = !hasText || Boolean(busy) || !worker
  decode.disabled = !base64.value.trim() || Boolean(busy) || !worker
  encode.setAttribute('aria-busy', String(busy === 'encode'))
  decode.setAttribute('aria-busy', String(busy === 'decode'))
  clear.disabled = !hasText && !base64.value && !busy
  copyText.disabled = !text.value || Boolean(source?.binary)
  copyBase64.disabled = !base64.value
  downloadText.disabled = !hasText
  downloadBase64.disabled = !base64.value
  uploads.forEach(button => { button.disabled = busy === 'file' })
  text.readOnly = source?.binary ?? false
  text.placeholder = source?.binary ? 'Binary file ready.\nSelect Encode to convert it to Base64.' : 'Type or paste your text here…\n\nHello, world!'
  example.hidden = hasText
  counters[0].textContent = formatBytes(source?.bytes.length ?? new TextEncoder().encode(text.value).length)
  counters[1].textContent = `${base64.value.length.toLocaleString('en-US')} chars`
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
    remove.onclick = () => { invalidate(); if (source?.binary) text.value = ''; source = null; render() }
    chip.append(name, size, remove)
    panels[0].querySelector('.editor-content').prepend(chip)
  }
}

function invalidate() {
  requestId++
  busy = null
  notify('', 'Both panels are editable. Use the arrows to choose your direction.')
}

function convert(direction) {
  if (!worker || busy || (direction === 'encode' ? !text.value && !source : !base64.value.trim())) return
  busy = direction
  notify('', direction === 'encode' ? 'Encoding…' : 'Decoding…')
  worker.postMessage({ id: ++requestId, direction, input: direction === 'encode' ? source?.bytes ?? text.value : base64.value, urlSafe: urlSafe.checked, padding: padding.checked })
  render()
}

try {
  worker = new Worker(new URL('./converter.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }) => {
    if (data.id !== requestId) return
    busy = null
    if (data.direction === 'error') notify('error', data.error)
    else if (data.direction === 'encode') { base64.value = data.value; notify('success', 'Encoded. Your Base64 is ready.') }
    else {
      text.value = data.text ?? ''
      source = { name: data.text === null ? 'decoded.bin' : 'decoded.txt', bytes: data.bytes, binary: data.text === null }
      notify('success', data.text === null ? 'Decoded a binary file. Download it from the left panel.' : 'Decoded. Your text is ready.')
    }
    render()
  }
  worker.onerror = () => { busy = null; worker.terminate(); worker = null; notify('error', 'The converter could not start. Reload the page and try again.'); render() }
} catch { notify('error', 'The converter could not start. Serve this folder over HTTP and reload the page.') }

async function loadFile(file, target) {
  invalidate()
  const id = requestId
  if (file.size > (target === 0 ? MAX_BYTES : MAX_BASE64_LENGTH)) {
    notify('error', 'This file is too large. Choose a source smaller than 10 MiB, or Base64 smaller than 14 MiB.'); render(); return
  }
  busy = 'file'; notify('', 'Reading your file…'); render()
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (id !== requestId) return
    const value = readUtf8(bytes)
    if (target === 0) { text.value = value ?? ''; source = { name: file.name, bytes, binary: value === null } }
    else { if (value === null) throw new Error('This file is not UTF-8 text. Upload a text file containing Base64.'); base64.value = value }
    busy = null
    notify('success', `“${file.name}” loaded. Select ${target === 0 ? 'Encode' : 'Decode'} to convert it.`)
  } catch (error) { if (id !== requestId) return; busy = null; notify('error', error.message || 'Could not read this file.') }
  render()
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
text.addEventListener('input', () => { invalidate(); source = null; render() })
base64.addEventListener('input', () => { invalidate(); render() })
urlSafe.addEventListener('change', () => { invalidate(); render() })
padding.addEventListener('change', () => { invalidate(); render() })
encode.onclick = () => convert('encode')
decode.onclick = () => convert('decode')
clear.onclick = () => { invalidate(); source = null; text.value = ''; base64.value = ''; render(); text.focus() }
example.onclick = () => { invalidate(); text.value = sample; source = null; render(); text.focus() }
copyText.onclick = () => copy(text, copyText)
copyBase64.onclick = () => copy(base64, copyBase64)
downloadText.onclick = () => download(source?.bytes ?? text.value, source?.name ?? 'text.txt')
downloadBase64.onclick = () => download(base64.value, 'encoded.txt')
$('.workbench').addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); convert(event.target === base64 ? 'decode' : 'encode') }
})
panels.forEach((panel, index) => {
  uploads[index].onclick = () => fileInputs[index].click()
  fileInputs[index].onchange = event => { const file = event.target.files[0]; if (file) void loadFile(file, index); event.target.value = '' }
  panel.ondragover = event => { if (!event.dataTransfer.types.includes('Files')) return; event.preventDefault(); panel.classList.add('dragging') }
  panel.ondragleave = event => { if (!panel.contains(event.relatedTarget)) panel.classList.remove('dragging') }
  panel.ondrop = event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); panel.classList.remove('dragging'); void loadFile(event.dataTransfer.files[0], index) }
})
render()
