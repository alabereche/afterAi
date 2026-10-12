export interface AudioClip {
  id: string;
  name: string;
  src: string;
  filename?: string;
  startFrame: number;
  durationInFrames: number;
  volume: number; // 0 to 1
  isMuted?: boolean;
  color?: string;
}

export interface AudioPreset {
  id: string;
  name: string;
  category: string;
  duration: number;
  durationFrames: number;
  filename: string;
  url: string;
  color: string;
  description: string;
}
