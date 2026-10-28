import { decodeBase64, encodeBase64, formatHex, ConversionError } from './lib/base64.js'
import { readBase64Document } from './lib/base64-document.js'
import { encodeText, inspectBytes } from './lib/encodings.js'

function inspect(bytes, encoding) {
  let result
  try { result = inspectBytes(bytes, encoding) }
  catch (error) { error.phase = 'encoding'; throw error }
  if (encoding !== 'auto' && encoding !== 'binary' && result.text === null) {
    const error = new ConversionError(result.reason || `These bytes cannot be decoded as ${encoding}. Choose another encoding or Binary (HEX).`)
    error.phase = 'encoding'
    throw error
  }
  return { ...result, hex: result.text === null ? formatHex(bytes) : null }
}

self.onmessage = ({ data }) => {
  try {
    const selection = data.encoding || 'auto'
    const encoding = selection === 'auto' ? 'utf-8' : selection
    if (data.direction === 'encode' || data.direction === 'download' || data.direction === 'measure') {
      let bytes
      try { bytes = typeof data.input === 'string' ? encodeText(data.input, encoding) : data.input }
      catch (error) { error.phase = 'encoding'; throw error }
      if (data.direction === 'encode') {
        self.postMessage({ id: data.id, direction: 'encode', value: encodeBase64(bytes, data.urlSafe, data.padding), byteLength: bytes.length, encoding })
      } else if (data.direction === 'measure') {
        self.postMessage({ id: data.id, direction: 'measure', byteLength: bytes.length })
      } else {
        self.postMessage({ id: data.id, direction: 'download', bytes, encoding }, { transfer: [bytes.buffer] })
      }
    } else if (data.direction === 'read-base64-file') {
      const bytes = data.input
      // A Base64 document's charset is independent of the decoded payload charset.
      const result = readBase64Document(bytes)
      self.postMessage({ id: data.id, direction: 'read-base64-file', value: result.value, bytes, documentEncoding: result.encoding }, { transfer: [bytes.buffer] })
    } else {
      const bytes = data.direction === 'inspect' ? data.input : decodeBase64(String(data.input))
      const result = { id: data.id, direction: data.direction, bytes, ...inspect(bytes, selection) }
      self.postMessage(result, { transfer: [bytes.buffer] })
    }
  } catch (error) {
    self.postMessage({ id: data.id, direction: 'error', operation: data.direction, phase: error?.phase, error: error instanceof Error ? error.message : 'Conversion failed. Check your input and try again.' })
  }
}
