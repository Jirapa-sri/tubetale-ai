/**
 * Trigger a browser download for a text (or other) Blob.
 */
export function downloadTextFile(filename, text, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function safeFilenamePart(value, fallback = 'file') {
  return String(value || fallback)
    .replace(/[^\w-]+/g, '_')
    .slice(0, 40) || fallback
}

/**
 * Format interview messages (user/assistant only) as readable text.
 */
export function formatInterviewTranscript(messages, labels = {}) {
  const interviewer = labels.interviewer || 'Interviewer'
  const you = labels.you || 'You'
  const lines = (messages || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const who = m.role === 'assistant' ? interviewer : you
      return `${who}:\n${m.content}`
    })
  return lines.join('\n\n')
}
