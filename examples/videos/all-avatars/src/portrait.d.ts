import type { AvatarState } from './index.js';

export interface TalkingPortraitLayer {
  id: string;
  src: string;
  placement?: 'behind' | 'front';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  origin?: [number, number];
  /** Oscillates the layer around `origin`: swings for `active` seconds of every `cycle`, rests (at `rest` strength) otherwise. */
  motion?: { type: 'sway'; amplitude: number; period: number; cycle?: number; active?: number; rest?: number };
}

export interface TalkingPortraitManifest {
  kind: 'talking-portrait';
  id: string;
  base: string;
  mouthlessBase: true;
  size: [number, number];
  mouth: { style: 'human' | 'cat'; x: number; y: number; width: number; height: number; ink: string; teeth: string; tongue: string };
  /** Optional blinking: normalized eye boxes covered by a `color` lid with a `line` lash curve. */
  eyes?: { color: string; line: string; boxes: Array<{ x: number; y: number; width: number; height: number }> };
  layers?: TalkingPortraitLayer[];
}

export interface TalkingPortraitProps {
  pack: TalkingPortraitManifest;
  width?: number;
  position?: 'bottom-left' | 'bottom-right' | { x: number; y: number };
  audioEnvelope?: number[];
  audioFps?: number;
  accentKeyframes?: Array<{ time: number }>;
  enableBounce?: boolean;
  label?: string;
}

export interface PortraitState extends AvatarState {
  /** 0 open … 1 closed. */
  blink: number;
  /** Fraction of portrait width. */
  translateX: number;
  /** Degrees per layer id, for layers with `motion`. */
  layerAngles: Record<string, number>;
}

export function prepareTalkingPortrait(props: TalkingPortraitProps): Required<TalkingPortraitProps>;
export function resolvePortraitState(config: Required<TalkingPortraitProps>, time: number): PortraitState;
export function createTalkingPortrait(props: TalkingPortraitProps, document?: Document): {
  element: HTMLDivElement;
  ready: Promise<HTMLImageElement[]>;
  renderAt(time: number): PortraitState;
  whenFrameReady(): Promise<void[]>;
};
