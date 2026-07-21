/**
 * Client helpers for YouTube URLs and metadata API.
 */

export function extractVideoId(input) {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()

  if (/^[\w-]{11}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    ) {
      const v = url.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v

      const parts = url.pathname.split('/').filter(Boolean)
      if (
        parts.length >= 2 &&
        ['embed', 'shorts', 'live', 'v'].includes(parts[0]) &&
        /^[\w-]{11}$/.test(parts[1])
      ) {
        return parts[1]
      }
    }
  } catch {
    return null
  }

  return null
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Fetch title, duration_seconds, description, and transcript for a YouTube URL.
 */
export async function fetchVideoMetadata(youtubeUrl) {
  const response = await fetch('/api/youtube-metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: youtubeUrl }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch video metadata')
  }

  return data
}
