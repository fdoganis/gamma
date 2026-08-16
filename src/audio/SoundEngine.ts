export type SoundHandle = {
  source: AudioScheduledSourceNode; // call .start() on this
  output: AudioNode;                // connect this to wherever the sound should go
};

export interface SoundEngine {
  createSource(id: string, context: AudioContext): SoundHandle | null;
  activate?(): void;
  dispose?(): void;
}
