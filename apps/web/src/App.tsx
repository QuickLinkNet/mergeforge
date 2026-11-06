import { useGame } from './hooks/useGame';
import type { OnlineSession } from './online';
import { GamePage } from './pages/GamePage';

/**
 * Game entry: wires one session (online or the local sandbox) to the playing screen.
 * State and commands live in hooks/useGame, the markup in pages/GamePage.
 */
export function App({ online }: { readonly online?: OnlineSession | undefined } = {}) {
  const game = useGame(online);
  return <GamePage game={game} />;
}
