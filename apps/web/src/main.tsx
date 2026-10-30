import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const rootElement = document.querySelector<HTMLElement>('#root');

if (rootElement === null) {
  throw new Error('MERGEFORGE konnte den App-Container nicht finden.');
}

createRoot(rootElement).render(<App />);
