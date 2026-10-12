export interface ShotData {
  id: string;
  number: number;
  name: string;
  startFrame: number;
  durationInFrames: number;
  color?: string;
}

export interface ElementTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export const DEFAULT_TRANSFORM: ElementTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};

export interface TextElementData {
  id: string;
  baseId?: string;
  shotId?: string;
  parentId?: string;
  isChild?: boolean;
  label?: string;
  text: string;
  fontSize: number;
  color?: string;
  startFrame: number;
  durationInFrames: number;
  track?: number;
  holdToEnd?: boolean;
  isDeleted?: boolean;
  transform?: ElementTransform;
}

export interface CardElementData {
  id: string;
  baseId?: string;
  shotId?: string;
  parentId?: string;
  isChild?: boolean;
  label?: string;
  name: string;
  title?: string;
  src?: string;
  startFrame: number;
  durationInFrames: number;
  track?: number;
  holdToEnd?: boolean;
  isDeleted?: boolean;
  transform?: ElementTransform;
}

export interface SceneData {
  durationInFrames: number;
  fps: number;
  shots: ShotData[];
  texts: TextElementData[];
  cards: CardElementData[];
  audio?: any[];
}
