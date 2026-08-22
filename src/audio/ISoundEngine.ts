export type SoundHandle = {
  source: AudioScheduledSourceNode; // already started, source is useful for end  cleanup
  output: AudioNode;                // connect this to wherever the sound should go
};

export interface ISoundEngine {
  createSource(id: string, context: AudioContext): SoundHandle | null;
  activate?(): void;
  dispose?(): void;
}
