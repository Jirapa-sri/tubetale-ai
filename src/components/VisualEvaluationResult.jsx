import { buildEvaluationMatches, formatClock } from '../utils/evaluationMatch'
import { useSettings } from '../context/SettingsContext'

/**
 * Visual evaluation text with matched facial-reaction frames per analysis block.
 */
export default function VisualEvaluationResult({ evaluation, frames = [] }) {
  const { tr } = useSettings()
  const matches = buildEvaluationMatches(evaluation, frames)

  return (
    <div className="evaluation-panel">
      <h3>{tr('visualEvaluationResult')}</h3>
      <p className="muted evaluation-match-hint">{tr('evaluationMatchHint')}</p>

      <div className="evaluation-match-list">
        {matches.map((block) => (
          <article key={block.id} className="evaluation-match-card">
            <div className="evaluation-match-text">{block.text}</div>
            {block.frames.length > 0 ? (
              <div className="evaluation-match-frames">
                {block.frames.map((frame) => (
                  <figure key={`${block.id}-${frame.id}`}>
                    <img
                      src={frame.dataUrl}
                      alt={`Reaction at ${formatClock(frame.timestampSeconds)}`}
                    />
                    <figcaption>
                      {tr('matchedFrame')} · {formatClock(frame.timestampSeconds)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="muted">{tr('noMatchedFrame')}</p>
            )}
          </article>
        ))}
      </div>

      {frames.length > 0 && (
        <div className="evaluation-all-frames">
          <h4>{tr('allReactionFrames')}</h4>
          <div className="frame-strip">
            {frames.map((frame, index) => (
              <figure key={frame.id}>
                <img src={frame.dataUrl} alt={`Reaction frame ${index + 1}`} />
                <figcaption>{formatClock(frame.timestampSeconds)}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
