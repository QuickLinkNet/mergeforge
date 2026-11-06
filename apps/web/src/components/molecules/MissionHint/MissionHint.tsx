import { Button } from '../../atoms/Button/Button';
import './MissionHint.css';

export interface MissionHintProps {
  readonly text: string;
  /** When given, a button lets the player highlight the matching map fields. */
  readonly onHighlight?: (() => void) | undefined;
}

/** Next-step hint inside the mission card. */
export function MissionHint({ text, onHighlight }: MissionHintProps) {
  return (
    <div className="mission-hint" role="status">
      <p>{text}</p>
      {onHighlight !== undefined && (
        <Button variant="secondary" onClick={onHighlight}>Felder markieren</Button>
      )}
    </div>
  );
}
