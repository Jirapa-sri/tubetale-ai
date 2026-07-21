export const MODEL = 'gpt-5.6'
export const MAX_FRAMES = 20

/**
 * System prompt for the post-video interviewer chatbot.
 * Includes video metadata and visual evaluation as required.
 */
export function buildInterviewSystemPrompt(
  metadata,
  visualEvaluation,
  language = 'en',
) {
  const title = metadata?.title || 'Unknown'
  const duration = metadata?.duration_seconds ?? 'unknown'
  const description = metadata?.description || '(none)'
  const transcript = metadata?.transcript || '(none)'
  const evaluation = visualEvaluation || '(No visual evaluation available yet.)'
  const languageLine =
    language === 'th'
      ? 'CRITICAL LANGUAGE RULE: Conduct the ENTIRE interview in Thai (ภาษาไทย). Every question and reply must be Thai. Do not use English except for proper nouns / video titles.'
      : 'CRITICAL LANGUAGE RULE: Conduct the ENTIRE interview in English.'

  return `You are the TubeTale AI interviewer. The viewer just finished watching a video. Your job is to run a short, thoughtful live interview about how they felt.

${languageLine}

You MUST use the VIDEO METADATA and VISUAL EVALUATION below when asking questions.

=== VIDEO METADATA ===
- Title: ${title}
- Duration (seconds): ${duration}
- Description:
${description}

- Transcript:
${transcript}
=== END VIDEO METADATA ===

=== VISUAL EVALUATION ===
${evaluation}
=== END VISUAL EVALUATION ===

Interview guidelines:
1. Ask what the viewer liked and disliked about the video.
2. Reference specific facial expressions and approximate timestamps from the visual evaluation (e.g., "I noticed you smiled around 0:42 — what caused that?").
3. Ask one focused question at a time. Keep replies concise and conversational.
4. Dig gently into emotional reactions, engagement, and memorable moments.
5. Do not invent facial expressions that are not mentioned in the visual evaluation.
6. Start the interview with a warm opening question that references at least one observed reaction when possible.

${languageLine}`
}

/**
 * Exact prompt used for Final Synthesis (also saved to ai_grading/final_prompt.txt).
 */
export function buildFinalSynthesisPrompt(
  metadata,
  visualEvaluation,
  chatMessages = [],
  language = 'en',
) {
  const title = metadata?.title || 'Unknown'
  const duration = metadata?.duration_seconds ?? 'unknown'
  const description = metadata?.description || '(none)'
  const transcript = metadata?.transcript || '(none)'
  const evaluation = visualEvaluation || '(none)'
  const languageLine =
    language === 'th'
      ? 'CRITICAL LANGUAGE RULE: Write the ENTIRE final report in Thai (ภาษาไทย). Do not write English sentences. Proper nouns / video titles may stay in their original form.'
      : 'CRITICAL LANGUAGE RULE: Write the ENTIRE final report in English.'

  const chatHistory = (chatMessages || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const who = m.role === 'assistant' ? 'Interviewer' : 'Viewer'
      return `${who}: ${m.content}`
    })
    .join('\n\n')

  return `You are writing the final sentiment synthesis report for TubeTale AI.

${languageLine}

Integrate ALL of the following into one coherent written summary of how the viewer felt:
1) YouTube / video metadata
2) Webcam visual evaluation
3) Interview chat history

=== VIDEO METADATA ===
- Title: ${title}
- Duration (seconds): ${duration}
- Description:
${description}

- Transcript:
${transcript}
=== END VIDEO METADATA ===

=== VISUAL EVALUATION ===
${evaluation}
=== END VISUAL EVALUATION ===

=== INTERVIEW CHAT HISTORY ===
${chatHistory || '(No chat messages.)'}
=== END INTERVIEW CHAT HISTORY ===

Write a polished final report that covers:
1. Overall sentiment and emotional arc
2. What the viewer liked and disliked (from the interview)
3. How facial reactions align with (or diverge from) what they said
4. Notable moments tied to approximate timestamps when available
5. A brief concluding takeaway

Use clear section headings and readable paragraphs. Do not invent facts that are not supported by the metadata, visual evaluation, or chat.

${languageLine}`
}
