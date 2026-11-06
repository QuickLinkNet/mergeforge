import type { Mission } from '../../../game/mission';
import type { PathfinderGuidance } from '../../../game/pathfinderGuidance';
import { Badge } from '../../atoms/Badge/Badge';
import { MissionHint } from '../../molecules/MissionHint/MissionHint';
import './MissionPanel.css';

export interface MissionPanelProps {
  readonly mission: Mission;
  readonly guidance: PathfinderGuidance | null;
  /** Highlights map fields named by the guidance. */
  readonly onHighlight: (keys: readonly string[]) => void;
}

/** Chapter card on the left: story, goal and progress. */
export function MissionPanel({ mission, guidance, onHighlight }: MissionPanelProps) {
  return (
    <section className="mission-card" aria-labelledby="mission-title">
      <div className="mission-kicker"><span>Kapitel {mission.chapterNumber}</span><Badge variant="prototype">Lokaler Prototyp</Badge></div>
      <h1 id="mission-title">{mission.title}</h1>
      <p>{mission.description}</p>
      <div className={`objective ${mission.complete ? 'complete' : ''}`} aria-label="Kapitelziel">
        <span className="objective-icon" aria-hidden="true">{mission.complete ? '✓' : '◇'}</span>
        <span><small>{mission.complete ? 'Kapitelziel erreicht' : 'Aktuelles Kapitelziel'}</small>{mission.objective}</span>
        <strong aria-live="polite">{mission.progress}</strong>
      </div>
      <p className="mission-note">{mission.note}</p>
      {guidance !== null && (
        <MissionHint
          text={guidance.text}
          onHighlight={guidance.highlightKeys.length > 0 ? () => onHighlight(guidance.highlightKeys) : undefined}
        />
      )}
    </section>
  );
}
