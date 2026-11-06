import { createRoot } from 'react-dom/client';
// Design system first (tokens, then base); component styles follow with their components.
import './design-system/tokens.css';
import './design-system/base.css';
import { OnlineGate } from './pages/OnlineGate';

const rootElement = document.querySelector<HTMLElement>('#root');

if (rootElement === null) {
  throw new Error('MERGEFORGE konnte den App-Container nicht finden.');
}

createRoot(rootElement).render(<OnlineGate />);
