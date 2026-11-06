import { Button } from '../../atoms/Button/Button';
import './MissionHint.css';

export interface MissionHintProps {
  readonly text: string;
  /** When given, a button lets the player highlight the matching map fields. */
  readonly onHighlight?: (() => void) | undefined;
  /** When given, a button scrolls the map to those fields. */
  readonly onShow?: (() => void) | undefined;
}

/** Next-step hint inside the mission card. */
export function MissionHint({ text, onHighlight, onShow }: MissionHintProps) {
  return (
    <div className="mission-hint" role="status">
      <p>{text}</p>
      {onShow !== undefined && (
        <Button variant="primary" onClick={onShow}>Zum Ziel springen</Button>
      )}
      {onHighlight !== undefined && (
        <Button variant="secondary" onClick={onHighlight}>Felder markieren</Button>
      )}
    </div>
  );
}
