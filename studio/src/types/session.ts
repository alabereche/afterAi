import { ChatMessage } from './chat';
import { AudioClip } from './audio';

export interface SessionMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  messageCount: number;
}

export interface SessionData extends SessionMetadata {
  messages: ChatMessage[];
  sceneCode?: string;
  sceneData?: any;
  audioClips?: AudioClip[];
}
