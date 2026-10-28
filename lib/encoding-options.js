// Safe to import in the window: codec tables live in the worker-only module.
export const ENCODINGS = Object.freeze([
  { id: 'utf-8', label: 'UTF-8' },
  { id: 'utf-16le', label: 'UTF-16 LE' },
  { id: 'utf-16be', label: 'UTF-16 BE' },
  { id: 'utf-32le', label: 'UTF-32 LE' },
  { id: 'utf-32be', label: 'UTF-32 BE' },
  { id: 'cp949', label: 'CP949 / EUC-KR (UHC)' },
  { id: 'shift-jis', label: 'Shift_JIS / Windows-31J' },
  { id: 'gb18030', label: 'GB18030' },
  { id: 'big5', label: 'Big5 / HKSCS' },
  { id: 'windows-1252', label: 'Windows-1252' },
  { id: 'iso-8859-1', label: 'ISO-8859-1 (Latin-1)' },
  { id: 'ascii', label: 'ASCII' },
].map(Object.freeze))
