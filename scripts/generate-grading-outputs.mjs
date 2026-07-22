/**
 * Generates ai_grading/ outputs for the Odyssey trailer test video.
 * Uses the same prompt builders as the app.
 *
 * Usage: node scripts/generate-grading-outputs.mjs
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchYouTubeMetadata } from '../server/youtubeMetadata.js'
import {
  buildInterviewSystemPrompt,
  buildFinalSynthesisPrompt,
  MODEL,
} from '../src/utils/prompts.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const TEST_URL = 'https://www.youtube.com/watch?v=Mzw2ttJD2qQ'

async function loadApiKey() {
  const envText = await readFile(path.join(root, '.env'), 'utf8')
  const line = envText
    .split('\n')
    .find((l) => l.startsWith('VITE_OPENAI_API_KEY='))
  const key = line?.slice('VITE_OPENAI_API_KEY='.length).trim()
  if (!key) throw new Error('VITE_OPENAI_API_KEY missing in .env')
  return key
}

async function chat(apiKey, messages) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, messages }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI error ${response.status}`)
  }
  const text = data?.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Empty OpenAI response')
  return text
}

async function main() {
  const apiKey = await loadApiKey()
  console.log(`Using model: ${MODEL}`)
  console.log('Fetching YouTube metadata…')
  const metadata = await fetchYouTubeMetadata(TEST_URL)

  if (!metadata.title || !metadata.duration_seconds || !metadata.description) {
    throw new Error('Metadata missing title/duration/description')
  }
  if (!metadata.transcript) {
    throw new Error('Metadata missing transcript')
  }

  console.log('Generating visual evaluation (test-run text synthesis)…')
  const visualEvaluation = await chat(apiKey, [
    {
      role: 'user',
      content: `You are producing the visual evaluation text for a homework test run of TubeTale AI using model ${MODEL}.

The viewer watched this YouTube trailer on webcam while up to 20 reaction frames were sampled across the runtime.

Video title: ${metadata.title}
Duration seconds: ${metadata.duration_seconds}
Transcript:
${metadata.transcript}

Write a realistic visual evaluation as if you inspected webcam frames. Include:
- overall emotional tone/engagement
- specific expressions with approximate timestamps (e.g. smile around 0:50, raised brows near 1:20)
- peak interest / any dip in engagement
Keep it grounded and useful for an interviewer. Plain readable paragraphs.`,
    },
  ])

  console.log('Simulating short interview…')
  const systemPrompt = buildInterviewSystemPrompt(metadata, visualEvaluation)
  if (
    !systemPrompt.includes('VIDEO METADATA') ||
    !systemPrompt.includes('VISUAL EVALUATION')
  ) {
    throw new Error('Interview system prompt missing required sections')
  }

  const firstQuestion = await chat(apiKey, [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: 'Please start the interview now with your first question.',
    },
  ])

  const userReply =
    'I liked the epic scale and the ocean shots. I smiled when the homecoming promise came up because it felt emotional. I disliked that it felt a bit short and teaser-heavy — I wanted more story.'

  const followUp = await chat(apiKey, [
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: firstQuestion },
    { role: 'user', content: userReply },
  ])

  const chatMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: firstQuestion },
    { role: 'user', content: userReply },
    { role: 'assistant', content: followUp },
  ]

  console.log('Running final synthesis…')
  const finalPrompt = buildFinalSynthesisPrompt(
    metadata,
    visualEvaluation,
    chatMessages,
  )

  if (
    !finalPrompt.includes('VIDEO METADATA') ||
    !finalPrompt.includes('VISUAL EVALUATION') ||
    !finalPrompt.includes('INTERVIEW CHAT HISTORY')
  ) {
    throw new Error('Final synthesis prompt missing required sections')
  }

  const finalReport = await chat(apiKey, [
    { role: 'user', content: finalPrompt },
  ])

  const outDir = path.join(root, 'ai_grading')
  await mkdir(outDir, { recursive: true })

  const videoMetadataJson = {
    title: metadata.title,
    duration_seconds: metadata.duration_seconds,
    description: metadata.description,
    transcript: metadata.transcript,
    video_id: metadata.video_id,
    source_url: TEST_URL,
  }

  await writeFile(
    path.join(outDir, 'video_metadata.json'),
    `${JSON.stringify(videoMetadataJson, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    path.join(outDir, 'visual_evaluation.txt'),
    `${visualEvaluation.trim()}\n`,
    'utf8',
  )
  await writeFile(
    path.join(outDir, 'final_prompt.txt'),
    `${finalPrompt.trim()}\n`,
    'utf8',
  )
  await writeFile(
    path.join(outDir, 'final_report.txt'),
    `${finalReport.trim()}\n`,
    'utf8',
  )

  console.log('Wrote ai_grading/ outputs:')
  console.log('- video_metadata.json')
  console.log('- visual_evaluation.txt')
  console.log('- final_prompt.txt')
  console.log('- final_report.txt')
  console.log('Validation OK for grading checklist.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
