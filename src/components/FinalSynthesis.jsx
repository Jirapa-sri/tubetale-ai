import { useState } from 'react'
import { synthesizeFinalReport } from '../utils/openai'
import { useSettings } from '../context/SettingsContext'
import { downloadTextFile, safeFilenamePart } from '../utils/download'

export default function FinalSynthesis({
  metadata,
  visualEvaluation,
  chatMessages,
  report,
  onReportComplete,
}) {
  const { tr, lang } = useSettings()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canEnd =
    Boolean(visualEvaluation) &&
    (chatMessages || []).some((m) => m.role === 'user' || m.role === 'assistant')

  async function handleEndChat() {
    setError('')
    setBusy(true)
    try {
      const { prompt, report: text } = await synthesizeFinalReport(
        metadata,
        visualEvaluation,
        chatMessages,
        lang,
      )
      onReportComplete?.({ prompt, report: text })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Final synthesis failed')
    } finally {
      setBusy(false)
    }
  }

  function handleDownloadReport() {
    if (!report?.trim()) return
    const title = safeFilenamePart(metadata?.title, 'report')
    const body = [
      `TubeTale AI — ${tr('sentimentReport')}`,
      `Video: ${metadata?.title || '(unknown)'}`,
      `Language: ${lang}`,
      '',
      report,
    ].join('\n')
    downloadTextFile(`tubetale-sentiment-report-${title}.txt`, body)
  }

  return (
    <section className="synthesis-panel">
      <div className="section-heading">
        <h2>{tr('finalSynthesis')}</h2>
        <p>{tr('finalSynthesisHelp')}</p>
      </div>

      <button
        type="button"
        className="primary-btn"
        onClick={handleEndChat}
        disabled={busy || !canEnd}
      >
        {busy ? tr('writingReport') : tr('endChat')}
      </button>

      {!canEnd && <p className="muted hint">{tr('endChatHint')}</p>}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {report && (
        <article className="final-report">
          <div className="final-report-header">
            <h3>{tr('sentimentReport')}</h3>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleDownloadReport}
            >
              {tr('downloadSentimentReport')}
            </button>
          </div>
          <div className="final-report-body">{report}</div>
        </article>
      )}
    </section>
  )
}
