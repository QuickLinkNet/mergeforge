import { createRoot } from 'react-dom/client';
import { OnlineGate } from './OnlineGate';
import './styles.css';

const rootElement = document.querySelector<HTMLElement>('#root');

if (rootElement === null) {
  throw new Error('MERGEFORGE konnte den App-Container nicht finden.');
}

createRoot(rootElement).render(<OnlineGate />);
