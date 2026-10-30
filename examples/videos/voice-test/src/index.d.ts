export interface AvatarPackManifest {
  id: string;
  gridSize: [number, number];
  layers: {
    base: string;
    eyes: { open: string; blink: string; surprised?: string };
    mouth: { closed: string; half: string; open: string; smile?: string };
    poses: Record<string, string> & { idle: string };
  };
}
export interface PoseKeyframe { time: number; pose: string; emotion?: 'open' | 'surprised'; bounce?: boolean }
export interface SpriteAvatarProps {
  pack: AvatarPackManifest;
  position?: 'bottom-right' | 'bottom-left' | { x: number; y: number };
  scale?: number;
  audioEnvelope?: number[];
  audioFps?: number;
  poseKeyframes?: PoseKeyframe[];
  stickerStyle?: { outlineWidth?: number; outlineColor?: string; shadowBlur?: number; shadowOpacity?: number };
  label?: string;
}
export interface AvatarState {
  pose: string; mouth: 'closed' | 'half' | 'open'; eyes: 'open' | 'blink' | 'surprised';
  amplitude: number; scaleY: number; translateY: number;
}
export interface PreparedAvatar {
  pack: AvatarPackManifest; scale: number; position: NonNullable<SpriteAvatarProps['position']>;
  audioEnvelope: number[]; audioFps: number; poseKeyframes: PoseKeyframe[];
  stickerStyle: Required<NonNullable<SpriteAvatarProps['stickerStyle']>>;
}
export interface SpriteAvatar {
  element: HTMLDivElement; ready: Promise<HTMLImageElement[]>;
  renderAt(time: number): AvatarState;
  whenFrameReady(): Promise<void[]>;
}
export function prepareAvatar(props: SpriteAvatarProps): PreparedAvatar;
export function resolveAvatarState(config: PreparedAvatar, currentTime: number): AvatarState;
export function createSpriteAvatar(props: SpriteAvatarProps, document?: Document): SpriteAvatar;
export function bindHyperframes(avatar: SpriteAvatar, options?: { target?: Window; offset?: number }): () => void;
export function tagGestures(segments: Array<{ time: number; text: string; finale?: boolean }>, availablePoses?: string[]): PoseKeyframe[];
