import type { AvatarPackManifest, SpriteAvatarProps, SpriteAvatar, AvatarState } from './index.js';
export interface AvatarCatalog {
  packs: Record<string, AvatarPackManifest>;
  animations: Record<string, Pick<SpriteAvatarProps, 'audioEnvelope' | 'audioFps' | 'poseKeyframes'>>;
}
export interface AvatarVariables {
  pack?: string; animation?: string; label?: string; scale?: number;
  position?: 'bottom-left' | 'bottom-right' | 'custom'; x?: number; y?: number;
  outlineWidth?: number; outlineColor?: string; shadowBlur?: number; shadowOpacity?: number;
}
export interface AvatarTimeline {
  time(): number;
  time(seconds: number, suppressEvents?: boolean): AvatarTimeline;
  to(target: object, vars: object): AvatarTimeline;
  kill(): void;
}
export interface HyperframesAvatar {
  element: HTMLDivElement; timeline: AvatarTimeline; ready: Promise<SpriteAvatar>;
  renderAt(localTime: number): AvatarState;
  destroy(): void;
}
export function avatarPropsFromVariables(variables: AvatarVariables, catalog: AvatarCatalog): SpriteAvatarProps;
export function mountHyperframesAvatar(root: HTMLElement, props: SpriteAvatarProps, options?: {
  target?: Window; compositionId?: string; duration?: number;
  gsap?: { timeline(options: { paused: boolean }): AvatarTimeline };
}): HyperframesAvatar;
