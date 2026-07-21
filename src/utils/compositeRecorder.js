/**
 * Export a facial-reaction reel from captured webcam frames.
 */

import { formatClock } from './evaluationMatch.js'

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type
  }
  return 'video/webm'
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

function coverDraw(ctx, source, dx, dy, dw, dh) {
  const sw = source.videoWidth || source.width
  const sh = source.videoHeight || source.height
  if (!sw || !sh) return
  const scale = Math.max(dw / sw, dh / sh)
  const w = sw * scale
  const h = sh * scale
  ctx.drawImage(source, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h)
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  let drawY = y
  let lines = 0
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, drawY)
      line = word
      drawY += lineHeight
      lines += 1
      if (lines >= 3) {
        ctx.fillText(`${line}…`, x, drawY)
        return
      }
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, drawY)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Build a downloadable reaction reel from captured frames + evaluation matches.
 */
export async function exportReactionReel({
  frames,
  matches = [],
  title = 'TubeTale AI',
  filename = 'insightlens-facial-reactions.webm',
}) {
  if (!frames?.length) {
    throw new Error('No facial reaction frames to export')
  }

  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const ctx = canvas.getContext('2d')
  const stream = canvas.captureStream(30)
  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2500000,
  })
  const chunks = []
  recorder.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data)
  }

  const images = []
  for (const frame of frames) {
    images.push({ frame, img: await loadImage(frame.dataUrl) })
  }

  recorder.start(200)

  const secondsPerFrame = 1.6
  const fps = 30
  const framesPerStill = Math.round(secondsPerFrame * fps)

  for (let i = 0; i < images.length; i += 1) {
    const { frame, img } = images[i]
    const note =
      matches.find((m) => m.frames.some((f) => f.id === frame.id))?.text ||
      `Facial reaction at ${formatClock(frame.timestampSeconds)}`

    for (let f = 0; f < framesPerStill; f += 1) {
      ctx.fillStyle = '#0b1118'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.save()
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      coverDraw(ctx, img, 80, 70, canvas.width - 160, canvas.height - 220)
      ctx.restore()

      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, 0, canvas.width, 58)
      ctx.fillStyle = '#e8eef4'
      ctx.font = '600 22px Avenir Next, Segoe UI, sans-serif'
      ctx.fillText(
        `${title} · Frame ${i + 1}/${images.length} · ${formatClock(frame.timestampSeconds)}`,
        24,
        38,
      )

      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect(0, canvas.height - 120, canvas.width, 120)
      ctx.fillStyle = '#d7e2ec'
      ctx.font = '18px Avenir Next, Segoe UI, sans-serif'
      wrapText(
        ctx,
        note.replace(/\s+/g, ' ').trim(),
        24,
        canvas.height - 85,
        canvas.width - 48,
        24,
      )

      await wait(1000 / fps)
    }
  }

  const blob = await new Promise((resolve) => {
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }))
    recorder.stop()
  })
  downloadBlob(blob, filename)
  return blob
}
