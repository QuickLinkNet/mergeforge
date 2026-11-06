import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  readonly variant: ButtonVariant;
  /** Extra class names after the variant class (e.g. "signalwerk-done"). */
  readonly className?: string;
  readonly children: ReactNode;
}

/** Text button: gold primary action or quiet secondary action. */
export function Button({ variant, className, type = 'button', children, ...rest }: ButtonProps) {
  const classes = className === undefined ? `${variant}-action` : `${variant}-action ${className}`;
  return <button className={classes} type={type} {...rest}>{children}</button>;
}
