export interface ElectronAPI {
  isElectron?: boolean;
  capturePage?: (rect?: { x: number; y: number; width: number; height: number }) => Promise<string | null>;
  minimize?: () => void;
  maximize?: () => void;
  close?: () => void;
  isMaximized?: () => Promise<boolean>;
  onWindowStateChange?: (callback: (state: { isMaximized: boolean }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
