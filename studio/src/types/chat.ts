export interface AttachedImage {
  id: string;
  dataUrl: string;
  name: string;
  size?: number;
  source: 'snapshot' | 'upload' | 'paste';
  frame?: number;
  timeSeconds?: string;
  serverUrl?: string;
}

export interface AttachedAudio {
  id: string;
  dataUrl: string;
  name: string;
  durationSeconds: number;
  durationFrames: number;
  transcript?: string;
  size?: number;
  source: 'recorded' | 'upload';
  serverUrl?: string;
  mode?: 'voiceover' | 'command';
}

export interface VideoKeyframe {
  timeSeconds: number;
  frameIndex: number;
  dataUrl: string;
  serverUrl?: string;
  fullPath?: string;
}

export interface AttachedVideo {
  id: string;
  dataUrl?: string;
  name: string;
  durationSeconds: number;
  durationFrames: number;
  size?: number;
  source: 'upload' | 'drop';
  serverUrl?: string;
  relativePath?: string;
  fullPath?: string;
  thumbnailUrl?: string;
  keyframes: VideoKeyframe[];
  isExtracting?: boolean;
}

export interface AgentStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed';
  detail?: string;
}

export interface DiffHunkLine {
  type: 'add' | 'delete' | 'context' | 'separator';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface FileDiffSummary {
  file: string;
  additions: number;
  deletions: number;
  changed: boolean;
  hunks: DiffHunkLine[];
}

export interface ToolExecutionInfo {
  toolName: string;
  actionTitle: string;
  target?: string;
  state: 'ACTIVE' | 'DONE' | 'ERROR';
  durationSeconds?: number;
}

export interface VerificationResult {
  passed: boolean;
  message: string;
  errors?: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  tools?: string[];
  duration?: number;
  timestamp: string;
  isStreaming?: boolean;
  steps?: AgentStep[];
  stepNumber?: number;
  thinkingTokens?: number;
  outputTokens?: number;
  activeTool?: ToolExecutionInfo;
  diffSummary?: FileDiffSummary[];
  verificationResult?: VerificationResult;
  images?: AttachedImage[];
  audio?: AttachedAudio;
  video?: AttachedVideo;
}
