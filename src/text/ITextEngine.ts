import type { ITransform } from '../types/ITransform';

export type TextHandle = unknown; // defined by each Engine implementqtion, no common type
export type TextStyle = { color?: string; size?: number };

export interface ITextEngine {
  create(text: string, anchor?: ITransform, style?: TextStyle): TextHandle;
  setText(handle: TextHandle, text: string): void;
  setVisible?(handle: TextHandle, visible: boolean): void;
  sync?(handle: TextHandle, anchor: ITransform): void;
  destroy(handle: TextHandle): void;
  dispose?(): void;
}