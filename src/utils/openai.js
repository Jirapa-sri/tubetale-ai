/**
 * OpenAI helpers for TubeTale AI.
 * All AI processing uses: const MODEL = 'gpt-5.6'
 */
import {
  MODEL,
  MAX_FRAMES,
  buildInterviewSystemPrompt,
  buildFinalSynthesisPrompt,
} from './prompts'

export {
  MODEL,
  MAX_FRAMES,
  buildInterviewSystemPrompt,
  buildFinalSynthesisPrompt,
}

function getApiKey() {
  const key = import.meta.env.VITE_OPENAI_API_KEY
  if (!key) {
    throw new Error(
      'Missing VITE_OPENAI_API_KEY. Add it to a local .env file and restart the dev server.',
    )
  }
  return key
}

async function chatCompletion(messages) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    const message =
      data?.error?.message || `OpenAI request failed (${response.status})`
    throw new Error(message)
  }

  const text = data?.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new Error('OpenAI returned an empty response.')
  }

  return text
}

/**
 * @param {Array<{role: 'user'|'assistant'|'system', content: string}>} messages
 */
export async function sendInterviewChat(messages) {
  return chatCompletion(messages)
}

/**
 * Translate stored analysis/report/chat text when the UI language changes.
 */
export async function translateText(text, targetLang) {
  if (!text?.trim()) return text
  const target =
    targetLang === 'th' ? 'Thai (ภาษาไทย)' : 'English'
  return chatCompletion([
    {
      role: 'user',
      content: `You are a professional translator.

Translate the TEXT below into ${target}.

Rules:
- Return ONLY the translated text (no preface, quotes, or notes).
- Keep the same meaning, tone, and structure (headings, bullets, paragraphs, timestamps).
- Keep proper nouns / video titles as-is when appropriate.
- Do NOT leave the text in the original language.

TEXT:
${text}`,
    },
  ])
}

/**
 * Translate interview chat messages (user/assistant only; keep system as-is or rebuild later).
 */
export async function translateChatMessages(messages, targetLang) {
  if (!messages?.length) return messages

  const jobs = messages.map(async (message) => {
    if (message.role === 'system') return message
    const content = await translateText(message.content, targetLang)
    return { ...message, content }
  })
  return Promise.all(jobs)
}

/**
 * End Chat → final written sentiment summary.
 */
export async function synthesizeFinalReport(
  metadata,
  visualEvaluation,
  chatMessages = [],
  language = 'en',
) {
  const prompt = buildFinalSynthesisPrompt(
    metadata,
    visualEvaluation,
    chatMessages,
    language,
  )
  const report = await chatCompletion([{ role: 'user', content: prompt }])
  return { prompt, report }
}

/**
 * @param {Array<{ dataUrl: string, timestampSeconds: number }>} frames
 * @param {{ title?: string, duration_seconds?: number }} metadata
 * @param {'en'|'th'} language
 */
export async function evaluateVisualReactions(
  frames,
  metadata = {},
  language = 'en',
) {
  if (!frames?.length) {
    throw new Error(
      'No webcam frames to evaluate. Capture reactions while watching first.',
    )
  }

  const limited = frames.slice(0, MAX_FRAMES)
  const frameList = limited
    .map(
      (f, i) =>
        `Frame ${i + 1}: video timestamp ~${formatClock(f.timestampSeconds)} (${f.timestampSeconds.toFixed(1)}s)`,
    )
    .join('\n')

  const languageLine =
    language === 'th'
      ? 'CRITICAL LANGUAGE RULE: Write the ENTIRE visual evaluation in Thai (ภาษาไทย). Do not write English sentences. Proper nouns / video titles may stay in their original form.'
      : 'CRITICAL LANGUAGE RULE: Write the ENTIRE visual evaluation in English.'

  const prompt = `You are analyzing a viewer's facial reactions while they watch a video.

${languageLine}

Video title: ${metadata.title || 'Unknown'}
Video duration: ${metadata.duration_seconds ?? 'unknown'} seconds
Number of webcam frames provided: ${limited.length} (maximum ${MAX_FRAMES})

Frame timing reference:
${frameList}

Carefully inspect each image in order. Write a clear visual evaluation that includes:
1. Overall emotional tone and engagement across the viewing session
2. Notable facial expressions (smile, frown, surprise, confusion, boredom, etc.) with approximate video timestamps
3. Moments of peak interest or disengagement
4. Any shifts in reaction over time

Be specific about timestamps so an interviewer can ask follow-up questions like "I noticed you smiled around 0:42 — what caused that?"
Use plain readable paragraphs or short bullet-style lines. Do not invent expressions that are not visible.

${languageLine}`

  const content = [
    { type: 'text', text: prompt },
    ...limited.map((frame) => ({
      type: 'image_url',
      image_url: {
        url: frame.dataUrl,
        detail: 'low',
      },
    })),
  ]

  return chatCompletion([{ role: 'user', content }])
}

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
