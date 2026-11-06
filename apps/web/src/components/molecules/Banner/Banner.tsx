import type { ReactNode } from 'react';
import './Banner.css';

export interface BannerProps {
  /** "system": notice below the top bar; "chapter": golden chapter announcement. */
  readonly variant: 'system' | 'chapter';
  readonly role: 'status' | 'alert';
  readonly message: ReactNode;
  /** Action or close button(s) after the message. */
  readonly children?: ReactNode;
}

/** Centered message strip at the top of the map. */
export function Banner({ variant, role, message, children }: BannerProps) {
  if (variant === 'chapter') {
    return (
      <div className="chapter-banner" role={role}>
        <span>{message}</span>
        {children}
      </div>
    );
  }
  return (
    <section className="system-notice" role={role}>
      <span>{message}</span>
      {children}
    </section>
  );
}
