/**
 * Server-side YouTube metadata + transcript helpers (Innertube / timedtext).
 * Used by the Vite middleware so the browser avoids CORS.
 */

const ANDROID_CLIENT = {
  clientName: 'ANDROID',
  clientVersion: '20.10.38',
  androidSdkVersion: 34,
  hl: 'en',
  gl: 'US',
}

const USER_AGENT =
  'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip'

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

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
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

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
}

function parseTranscriptXml(xml) {
  const segments = []
  const pattern = /<p\s+t="(\d+)"[^>]*d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
  let match

  while ((match = pattern.exec(xml)) !== null) {
    const startMs = Number(match[1])
    const durationMs = Number(match[2])
    const raw = match[3]
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
    const text = decodeXmlEntities(raw).replace(/\s+/g, ' ').trim()
    if (!text) continue
    segments.push({
      start: startMs / 1000,
      duration: durationMs / 1000,
      text,
    })
  }

  return segments
}

function parseTranscriptJson3(jsonText) {
  const data = JSON.parse(jsonText)
  const segments = []

  for (const event of data.events || []) {
    if (!event.segs) continue
    const text = event.segs
      .map((s) => s.utf8 || '')
      .join('')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue
    segments.push({
      start: (event.tStartMs || 0) / 1000,
      duration: (event.dDurationMs || 0) / 1000,
      text,
    })
  }

  return segments
}

async function fetchPlayer(videoId) {
  const response = await fetch(
    'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        context: { client: ANDROID_CLIENT },
        videoId,
        contentPlaybackContext: {
          html5Preference: 'HTML5_PREF_WANTS',
        },
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`YouTube player request failed (${response.status})`)
  }

  return response.json()
}

async function fetchCaptionTracks(baseUrl) {
  const urls = [
    baseUrl.includes('fmt=') ? baseUrl : `${baseUrl}&fmt=json3`,
    baseUrl.includes('fmt=') ? baseUrl.replace(/fmt=[^&]+/, 'fmt=srv3') : `${baseUrl}&fmt=srv3`,
    baseUrl,
  ]

  let lastError = null
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      if (!response.ok) {
        lastError = new Error(`Caption fetch failed (${response.status})`)
        continue
      }
      const body = await response.text()
      if (body.trim().startsWith('{')) {
        return parseTranscriptJson3(body)
      }
      if (body.includes('<timedtext') || body.includes('<p ')) {
        return parseTranscriptXml(body)
      }
      lastError = new Error('Unrecognized caption format')
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('Could not download captions')
}

function pickCaptionTrack(tracks) {
  if (!tracks?.length) return null
  const preferred = ['en', 'en-US', 'en-GB']
  for (const lang of preferred) {
    const match = tracks.find(
      (t) =>
        t.languageCode === lang ||
        t.languageCode?.toLowerCase().startsWith(lang.toLowerCase()),
    )
    if (match) return match
  }
  return tracks[0]
}

/**
 * @param {string} urlOrId
 * @returns {Promise<{
 *   video_id: string,
 *   title: string,
 *   duration_seconds: number,
 *   description: string,
 *   transcript: string,
 *   transcript_segments: Array<{start:number,duration:number,text:string}>
 * }>}
 */
export async function fetchYouTubeMetadata(urlOrId) {
  const videoId = extractVideoId(urlOrId)
  if (!videoId) {
    throw new Error('Invalid YouTube URL or video ID')
  }

  const player = await fetchPlayer(videoId)
  const status = player?.playabilityStatus?.status
  if (status && status !== 'OK') {
    const reason =
      player?.playabilityStatus?.reason ||
      player?.playabilityStatus?.messages?.[0] ||
      status
    throw new Error(`Video is not playable: ${reason}`)
  }

  const details = player?.videoDetails
  if (!details?.title) {
    throw new Error('Could not read video details from YouTube')
  }

  const tracks =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
  const track = pickCaptionTrack(tracks)

  let transcriptSegments = []
  let transcript = ''

  if (track?.baseUrl) {
    transcriptSegments = await fetchCaptionTracks(track.baseUrl)
    transcript = transcriptSegments
      .map((s) => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  } else {
    transcript = '(No captions / transcript available for this video.)'
  }

  return {
    video_id: videoId,
    title: details.title,
    duration_seconds: Number(details.lengthSeconds) || 0,
    description: details.shortDescription || '',
    transcript,
    transcript_segments: transcriptSegments,
  }
}
