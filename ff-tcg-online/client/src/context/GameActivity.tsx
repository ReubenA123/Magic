import { createContext, useContext, useEffect } from 'react';

// ============================================================================
// context/GameActivity.tsx
//
// Lets a deeply-nested component (GameBoard) tell the top-level App that a
// live match is currently on screen, without prop-drilling that flag through
// VersusPage/VsAiPage. App uses it to hide the top nav bar entirely during a
// game, since My View/Opponent View need every pixel of height to fit the
// board without scrolling.
// ============================================================================

const GameActivityContext = createContext<(active: boolean) => void>(() => {});

export const GameActivityProvider = GameActivityContext.Provider;

/** Call from a component that should count as "actively in a game" for as
 * long as it's mounted - marks active on mount, inactive again on unmount. */
export function useMarkGameActive() {
  const setActive = useContext(GameActivityContext);
  useEffect(() => {
    setActive(true);
    return () => setActive(false);
  }, [setActive]);
}
