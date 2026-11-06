import './SignalList.css';

export interface SignalListItem {
  readonly id: string;
  /** Compass angle of the arrow in degrees (0 = north). */
  readonly angle: number;
  readonly kicker: string;
  readonly title: string;
  readonly detail: string;
}

/** Direction arrows with a coarse description: far signals and radio contacts. */
export function SignalList({ items }: { readonly items: readonly SignalListItem[] }) {
  return (
    <ul className="signal-list">
      {items.map((item) => (
        <li className="signal-item" key={item.id}>
          <span className="signal-arrow" aria-hidden="true" style={{ transform: `rotate(${item.angle}deg)` }}>↑</span>
          <span>
            <small>{item.kicker}</small>
            <strong>{item.title}</strong>
            <em>{item.detail}</em>
          </span>
        </li>
      ))}
    </ul>
  );
}
