/**
 * Match captured webcam frames to visual-evaluation text by timestamp.
 */

export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Parse timestamps like 0:42, 1:05, 0:55–1:15, around 0:40 from evaluation text.
 * @returns {number[]} seconds
 */
export function extractTimestampsFromText(text) {
  if (!text) return []
  const found = []
  const range = /(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/g
  let match
  while ((match = range.exec(text)) !== null) {
    found.push(Number(match[1]) * 60 + Number(match[2]))
    found.push(Number(match[3]) * 60 + Number(match[4]))
  }
  const single = /(?:around\s+|near\s+|at\s+|~)?(\d{1,2}):(\d{2})/gi
  while ((match = single.exec(text)) !== null) {
    found.push(Number(match[1]) * 60 + Number(match[2]))
  }
  return [...new Set(found)].sort((a, b) => a - b)
}

function closestFrame(frames, targetSeconds) {
  if (!frames?.length) return null
  let best = frames[0]
  let bestDist = Math.abs(frames[0].timestampSeconds - targetSeconds)
  for (const frame of frames) {
    const dist = Math.abs(frame.timestampSeconds - targetSeconds)
    if (dist < bestDist) {
      best = frame
      bestDist = dist
    }
  }
  return best
}

/**
 * Split evaluation into paragraphs/bullets and attach nearest frame(s).
 */
export function buildEvaluationMatches(evaluation, frames = []) {
  if (!evaluation?.trim()) return []

  const blocks = evaluation
    .split(/\n{2,}|\n(?=[-*•]|\d+\.)/)
    .map((b) => b.trim())
    .filter(Boolean)

  return blocks.map((text, index) => {
    const times = extractTimestampsFromText(text)
    const matchedFrames = []
    if (times.length && frames.length) {
      for (const t of times) {
        const frame = closestFrame(frames, t)
        if (frame && !matchedFrames.some((f) => f.id === frame.id)) {
          matchedFrames.push(frame)
        }
      }
    } else if (frames.length) {
      // Evenly map leftover blocks onto frames
      const frame = frames[Math.min(index, frames.length - 1)]
      matchedFrames.push(frame)
    }
    return {
      id: `block-${index}`,
      text,
      timestamps: times,
      frames: matchedFrames,
    }
  })
}

export function frameAtPlaybackTime(frames, timeSeconds) {
  if (!frames?.length) return null
  const eligible = frames.filter((f) => f.timestampSeconds <= timeSeconds + 0.5)
  if (eligible.length) return eligible[eligible.length - 1]
  return closestFrame(frames, timeSeconds)
}
