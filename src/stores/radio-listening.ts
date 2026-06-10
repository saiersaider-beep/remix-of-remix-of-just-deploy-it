// Stub: radio-live feature removed. Always returns "not listening".
type State = {
  hostArtistId: string | null;
  hostArtistName: string | null;
  leave: () => void;
};
const STATE: State = { hostArtistId: null, hostArtistName: null, leave: () => {} };
export const useRadioListeningStore = (<T,>(selector: (s: State) => T): T => selector(STATE)) as {
  <T>(selector: (s: State) => T): T;
  getState: () => State;
};
useRadioListeningStore.getState = () => STATE;
