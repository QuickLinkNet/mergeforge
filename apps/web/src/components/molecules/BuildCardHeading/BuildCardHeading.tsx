import type { ReactNode } from 'react';
import './BuildCardHeading.css';

export interface BuildCardHeadingProps {
  /** Usually a Symbol atom; module cards pass their icon image. */
  readonly icon: ReactNode;
  /** Small caps line above the title. */
  readonly kicker: ReactNode;
  readonly title: ReactNode;
  /** Id of the h2, referenced by the card's aria-labelledby. */
  readonly titleId: string;
}

export function BuildCardHeading({ icon, kicker, title, titleId }: BuildCardHeadingProps) {
  return (
    <div className="build-card-heading">
      {icon}
      <span><small>{kicker}</small><h2 id={titleId}>{title}</h2></span>
    </div>
  );
}
