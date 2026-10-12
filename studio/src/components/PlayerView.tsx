import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import * as SceneModule from '@active-template/Scene';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import {
  Monitor,
  Smartphone,
  Square,
  RotateCcw,
  Layers,
  AlertTriangle,
  Camera,
  Move,
} from 'lucide-react';
import { Timeline } from './Timeline';
import { CanvasGizmo } from './CanvasGizmo';
import { AudioClip } from '../types/audio';
import { AttachedImage } from '../types/chat';
import { SceneData, ElementTransform, TextElementData } from '../types/sceneData';
import { mergeTransformOverride } from '../utils/canvasTransform';
import { useLanguage } from '../i18n/LanguageContext';

interface PlayerViewProps {
  playerKey: number;
  onRefresh: () => void;
  pinnedFrame?: { frame: number; timeSeconds: string } | null;
  onPinFrame?: (frame: number, timeSeconds: string) => void;
  onUnpinFrame?: () => void;
  audioClips?: AudioClip[];
  onAddAudioClip?: (clip: AudioClip) => void;
  onUpdateAudioClip?: (clipId: string, updates: Partial<AudioClip>) => void;
  onDeleteAudioClip?: (clipId: string) => void;
  onClearAllAudio?: () => void;
  onCaptureSnapshot?: (image: AttachedImage) => void;
  sceneData?: SceneData | null;
  onUpdateTextElement?: (updated: {
    id: string;
    text: string;
    fontSize: number;
    color?: string;
    isDeleted?: boolean;
  }) => Promise<void>;
  onUpdateElementTiming?: (payload: {
    kind: 'text' | 'card';
    id: string;
    startFrame?: number;
    durationInFrames?: number;
    track?: number;
    holdToEnd?: boolean;
    isDeleted?: boolean;
  }) => Promise<boolean>;
  onUndoSceneData?: () => Promise<void>;
  isBusy?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  onUpdateElementTransform?: (payload: {
    kind: 'text' | 'card';
    id: string;
    transform: ElementTransform;
  }) => Promise<boolean | void>;
  onDeleteElement?: (kind: 'text' | 'card', id: string) => Promise<boolean | void>;
  onSplitElement?: (
    kind: 'text' | 'card',
    id: string,
    splitFrame: number
  ) => Promise<{ success: boolean; rightPieceId?: string; error?: string }>;
  onOpenTextInspector?: (element: TextElementData) => void;
  isTextInspectorActive?: boolean;
}

type AspectRatio = '16:9' | '9:16' | '1:1';
type ViewScale = 'fit' | 'fit-width' | '100%';

export const PlayerView: React.FC<PlayerViewProps> = ({
  playerKey,
  onRefresh,
  pinnedFrame,
  onPinFrame,
  onUnpinFrame,
  audioClips = [],
  onAddAudioClip,
  onUpdateAudioClip,
  onDeleteAudioClip,
  onClearAllAudio,
  onCaptureSnapshot,
  sceneData,
  onUpdateTextElement,
  onUpdateElementTiming,
  onUndoSceneData,
  isBusy = false,
  selectedElementId = null,
  onSelectElement,
  onUpdateElementTransform,
  onDeleteElement,
  onSplitElement,
  onOpenTextInspector,
  isTextInspectorActive = false,
}) => {
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [viewScale, setViewScale] = useState<ViewScale>('fit');
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [isGizmoEnabled, setIsGizmoEnabled] = useState(true);
  const [liveOverride, setLiveOverride] = useState<{ id: string; transform: ElementTransform } | null>(null);
  const { t, format } = useLanguage();

  const effectiveSceneData = useMemo(() => {
    return mergeTransformOverride(sceneData, liveOverride);
  }, [sceneData, liveOverride]);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef | null>(null);
  const [playerInstance, setPlayerInstance] = useState<PlayerRef | null>(null);

  const setPlayerRef = useCallback((ref: PlayerRef | null) => {
    playerRef.current = ref;
    setPlayerInstance(ref);
  }, []);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoop, setIsLoop] = useState(true);

  const fallbackScene = (SceneModule as any).Scene || (SceneModule as any)['default'];
  const rawFallbackDuration = (SceneModule as any).DURATION_IN_FRAMES;
  const fallbackDuration = typeof rawFallbackDuration === 'number' && rawFallbackDuration > 0 ? rawFallbackDuration : 240;

  const [dynamicScene, setDynamicScene] = useState<React.ComponentType<any> | null>(null);
  const [dynamicDuration, setDynamicDuration] = useState<number | null>(null);

  // Dynamic Scene Bundle Loader for runtime live-preview
  useEffect(() => {
    let isCancelled = false;
    const loadDynamicScene = async () => {
      try {
        const res = await fetch(`/api/scene-bundle.js?v=${playerKey}-${Date.now()}`);
        if (!res.ok) return;
        const code = await res.text();
        if (isCancelled || !code || code.startsWith('/* Compilation error')) return;

        // Evaluate bundle in window context
        const runner = new Function('window', code);
        runner(window);

        const mod = (window as any).DynamicSceneModule;
        if (mod && mod.Scene && !isCancelled) {
          setDynamicScene(() => mod.Scene);
          if (typeof mod.DURATION_IN_FRAMES === 'number' && mod.DURATION_IN_FRAMES > 0) {
            setDynamicDuration(mod.DURATION_IN_FRAMES);
          }
        }
      } catch (err) {
        console.warn('[PlayerView] Using static fallback scene:', err);
      }
    };

    loadDynamicScene();
    return () => {
      isCancelled = true;
    };
  }, [playerKey]);

  const Scene = dynamicScene || fallbackScene;
  const durationInFrames = dynamicDuration || fallbackDuration;
  const durationInSeconds = (durationInFrames / 30).toFixed(1).replace('.0', '');

  const dimensions = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
  }[aspectRatio];

  // Observe canvas container dimensions dynamically
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    updateSize();

    const ro = new ResizeObserver(() => {
      updateSize();
    });
    ro.observe(el);

    window.addEventListener('resize', updateSize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Compute responsive dimensions to maximize player canvas
  const paddingX = 24;
  const paddingY = 24;
  const targetRatio = dimensions.width / dimensions.height;

  // Sensible initial fallbacks if container not measured yet
  const fallbackW = aspectRatio === '9:16' ? 380 : aspectRatio === '1:1' ? 600 : 1080;
  const availW = containerSize.width > 0 ? Math.max(160, containerSize.width - paddingX) : fallbackW;
  const availH = containerSize.height > 0 ? Math.max(160, containerSize.height - paddingY) : Math.round(fallbackW / targetRatio);

  let playerW = availW;
  let playerH = Math.round(availW / targetRatio);

  if (viewScale === 'fit') {
    if (playerH > availH) {
      playerH = availH;
      playerW = Math.round(availH * targetRatio);
    }
  } else if (viewScale === 'fit-width') {
    playerW = availW;
    playerH = Math.round(availW / targetRatio);
  } else if (viewScale === '100%') {
    playerW = dimensions.width;
    playerH = dimensions.height;
  }

  const currentScalePercent = Math.round((playerW / dimensions.width) * 100);

  // Responsive thresholds based on available player canvas width
  const isNarrow = containerSize.width < 1180;
  const isCompact = containerSize.width < 980;
  const isUltraCompact = containerSize.width < 720;

  useEffect(() => {
    if (!playerInstance) return;

    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      setCurrentFrame(e.detail.frame);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onSeeked = (e: { detail: { frame: number } }) => {
      setCurrentFrame(e.detail.frame);
    };

    playerInstance.addEventListener('frameupdate', onFrameUpdate);
    playerInstance.addEventListener('play', onPlay);
    playerInstance.addEventListener('pause', onPause);
    playerInstance.addEventListener('seeked', onSeeked);

    // Sync initial state immediately
    try {
      const initialFrame = playerInstance.getCurrentFrame();
      if (typeof initialFrame === 'number') {
        setCurrentFrame(initialFrame);
      }
      setIsPlaying(playerInstance.isPlaying());
    } catch {
      // Ignore if player not fully ready yet
    }

    return () => {
      playerInstance.removeEventListener('frameupdate', onFrameUpdate);
      playerInstance.removeEventListener('play', onPlay);
      playerInstance.removeEventListener('pause', onPause);
      playerInstance.removeEventListener('seeked', onSeeked);
    };
  }, [playerInstance]);

  const handlePlay = () => {
    if (playerRef.current) {
      if (currentFrame >= durationInFrames - 1) {
        playerRef.current.seekTo(0);
      }
      playerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (playerRef.current) {
      playerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (frame: number) => {
    setCurrentFrame(frame);
    playerRef.current?.seekTo(frame);
  };

  const handleToggleLoop = () => {
    setIsLoop((prev) => !prev);
  };

  const handleToggleFullscreen = () => {
    if (playerRef.current?.isFullscreen()) {
      playerRef.current?.exitFullscreen();
    } else {
      playerRef.current?.requestFullscreen();
    }
  };

  // Capture frame screenshot to attach into chat with pixel-perfect accuracy
  const captureFrameSnapshot = useCallback(async () => {
    const el = playerWrapperRef.current;
    if (!el || isCapturing) return;

    try {
      setIsCapturing(true);
      // Allow React to re-render without Gizmo handles before capturing pixels
      await new Promise((r) => setTimeout(r, 50));

      let dataUrl: string | null = null;
      const electronAPI = (window as any).electronAPI;

      // Tier 1: Electron Native Compositor Capture (100% pixel-perfect GPU framebuffer)
      if (electronAPI && typeof electronAPI.capturePage === 'function') {
        try {
          const rect = el.getBoundingClientRect();
          dataUrl = await electronAPI.capturePage({
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        } catch (ipcErr) {
          console.warn('[PlayerView] Electron capturePage failed, falling back to DOM rasterizer:', ipcErr);
        }
      }

      // Tier 2: Native SVG ForeignObject rasterization via html-to-image
      if (!dataUrl) {
        try {
          dataUrl = await toPng(el, {
            quality: 1,
            backgroundColor: '#050507',
            pixelRatio: Math.min(2, window.devicePixelRatio || 1),
            cacheBust: true,
          });
        } catch (svgErr) {
          console.warn('[PlayerView] html-to-image failed, falling back to html2canvas:', svgErr);
        }
      }

      // Tier 3: html2canvas fallback with 1x scale and clean background
      if (!dataUrl) {
        const canvas = await html2canvas(el, {
          backgroundColor: '#050507',
          useCORS: true,
          logging: false,
          scale: 1,
        });
        dataUrl = canvas.toDataURL('image/png');
      }

      // Visual feedback: trigger shutter flash AFTER snapshot has been captured
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 180);

      if (dataUrl) {
        const timeSec = (currentFrame / 30).toFixed(1).replace('.0', '');
        const attachedImg: AttachedImage = {
          id: `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          dataUrl,
          name: `${t.player.snapshotName} ${currentFrame} (${timeSec}${t.common.seconds})`,
          source: 'snapshot',
          frame: currentFrame,
          timeSeconds: timeSec,
        };

        onCaptureSnapshot?.(attachedImg);
      }
    } catch (err) {
      console.error('[PlayerView] Failed to capture snapshot:', err);
    } finally {
      setIsCapturing(false);
    }
  }, [currentFrame, isCapturing, onCaptureSnapshot]);

  // Global keyboard shortcut for snapshot (Ctrl+Shift+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        captureFrameSnapshot();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [captureFrameSnapshot]);

  return (
    <main
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0e0e11',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Studio View Toolbar */}
      <div
        style={{
          height: isCompact ? '40px' : '44px',
          padding: isCompact ? '0 8px' : '0 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          backgroundColor: '#121215',
          flexShrink: 0,
          gap: isCompact ? '4px' : '8px',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {/* Left: Resolution & Aspect Ratio Selectors & View Scaling */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isCompact ? '4px' : '6px',
            flexWrap: 'nowrap',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              backgroundColor: '#18181c',
              borderRadius: '7px',
              padding: '2px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              onClick={() => setAspectRatio('16:9')}
              title={t.player.ratio16_9}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: isCompact ? '3px 6px' : '4px 9px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: aspectRatio === '16:9' ? '#27272a' : 'transparent',
                color: aspectRatio === '16:9' ? '#ffffff' : '#71717a',
                fontSize: isCompact ? '10.5px' : '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {!isNarrow && <Monitor size={12} />}
              <span>16:9</span>
            </button>

            <button
              onClick={() => setAspectRatio('9:16')}
              title={t.player.ratio9_16}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: isCompact ? '3px 6px' : '4px 9px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: aspectRatio === '9:16' ? '#27272a' : 'transparent',
                color: aspectRatio === '9:16' ? '#ffffff' : '#71717a',
                fontSize: isCompact ? '10.5px' : '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {!isNarrow && <Smartphone size={12} />}
              <span>9:16</span>
            </button>

            <button
              onClick={() => setAspectRatio('1:1')}
              title={t.player.ratio1_1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: isCompact ? '3px 6px' : '4px 9px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: aspectRatio === '1:1' ? '#27272a' : 'transparent',
                color: aspectRatio === '1:1' ? '#ffffff' : '#71717a',
                fontSize: isCompact ? '10.5px' : '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {!isNarrow && <Square size={12} />}
              <span>1:1</span>
            </button>
          </div>

          {!isNarrow && !isCompact && (
            <div
              dir="ltr"
              style={{
                fontSize: '11px',
                color: '#71717a',
                padding: '0 4px',
                fontFamily: 'monospace',
                direction: 'ltr',
              }}
            >
              {dimensions.width} × {dimensions.height}
            </div>
          )}

          {!isNarrow && !isCompact && (
            <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '0 2px' }} />
          )}

          {/* Preview Scale Mode Selector */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#18181c',
              borderRadius: '7px',
              padding: '2px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              onClick={() => setViewScale('fit')}
              title={t.player.fitTooltip}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: isCompact ? '3px 6px' : '4px 8px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: viewScale === 'fit' ? '#27272a' : 'transparent',
                color: viewScale === 'fit' ? '#ffffff' : '#71717a',
                fontSize: isCompact ? '10px' : '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{isCompact ? 'Fit' : t.player.fit}</span>
            </button>

            {!isUltraCompact && (
              <button
                onClick={() => setViewScale('fit-width')}
                title={t.player.widthTooltip}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: isCompact ? '3px 6px' : '4px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: viewScale === 'fit-width' ? '#27272a' : 'transparent',
                  color: viewScale === 'fit-width' ? '#ffffff' : '#71717a',
                  fontSize: isCompact ? '10px' : '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{isCompact ? 'Width' : t.player.width}</span>
              </button>
            )}

            <button
              onClick={() => setViewScale('100%')}
              title={t.player.zoom100}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: isCompact ? '3px 6px' : '4px 8px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: viewScale === '100%' ? '#27272a' : 'transparent',
                color: viewScale === '100%' ? '#ffffff' : '#71717a',
                fontSize: isCompact ? '10px' : '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>100%</span>
            </button>
          </div>

          {!isCompact && !isNarrow && (
            <div
              dir="ltr"
              style={{
                fontSize: '11px',
                color: '#a1a1aa',
                padding: '0 4px',
                fontFamily: 'monospace',
                direction: 'ltr',
              }}
            >
              {`${currentScalePercent}%`}
            </div>
          )}

          {!isCompact && !isNarrow && (
            <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '0 2px' }} />
          )}

          {/* Gizmo Toggle Button */}
          <button
            onClick={() => setIsGizmoEnabled((prev) => !prev)}
            title={isGizmoEnabled ? t.player.freeTransformDisable : t.player.freeTransformEnable}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: isCompact ? '3px 7px' : '4px 9px',
              borderRadius: '6px',
              border: isGizmoEnabled ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: isGizmoEnabled ? 'rgba(56, 189, 248, 0.15)' : '#18181c',
              color: isGizmoEnabled ? '#38bdf8' : '#71717a',
              fontSize: isCompact ? '10.5px' : '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <Move size={12} />
            {!isCompact && !isNarrow && <span>{t.player.freeTransform}</span>}
          </button>
        </div>

        {/* Right: Snapshot Button, Info & Reload */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isCompact ? '4px' : '6px',
            flexShrink: 0,
          }}
        >
          {/* Snapshot to Chat Button */}
          <button
            onClick={captureFrameSnapshot}
            disabled={isCapturing}
            title={t.player.snapshotTooltip}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: isCompact ? '3px 7px' : '4px 9px',
              borderRadius: '6px',
              backgroundColor: isCapturing ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#d4d4d8',
              fontSize: isCompact ? '10.5px' : '11.5px',
              cursor: isCapturing ? 'wait' : 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isCapturing) {
                e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.3)';
                e.currentTarget.style.color = '#fb923c';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCapturing) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#d4d4d8';
              }
            }}
          >
            <Camera size={13} color="#f97316" />
            {!isCompact && !isNarrow && <span>{t.player.snapshotToChat}</span>}
          </button>

          {/* Duration Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10.5px',
              color: '#a1a1aa',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              padding: isCompact ? '3px 6px' : '4px 8px',
              borderRadius: '6px',
              fontFamily: 'monospace',
              flexShrink: 0,
            }}
          >
            <Layers size={11} color="#a1a1aa" />
            <span>
              {isCompact
                ? `${durationInFrames}F`
                : !isNarrow
                ? `${durationInFrames} ${t.common.frames} (${durationInSeconds}${t.common.seconds}) • 30 FPS`
                : `${durationInFrames}F • 30 FPS`}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            title={t.player.reloadTooltip}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: isCompact ? '3px 7px' : '4px 9px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#d4d4d8',
              fontSize: isCompact ? '10.5px' : '11.5px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
          >
            <RotateCcw size={12} />
            {!isCompact && !isNarrow && <span>{t.common.refresh}</span>}
          </button>
        </div>
      </div>

      {/* Main Canvas Player Area */}
      <div
        ref={canvasContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          overflow: viewScale === 'fit' ? 'hidden' : 'auto',
          backgroundColor: '#0c0c0f',
          position: 'relative',
        }}
      >
        {/* Shutter Flash Animation Overlay */}
        {showFlash && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(3px)',
              zIndex: 60,
              pointerEvents: 'none',
              transition: 'opacity 0.2s ease-out',
            }}
          />
        )}

        {/* Centered Remotion Player Wrapper */}
        <div
          ref={playerWrapperRef}
          style={{
            position: 'relative',
            width: `${playerW}px`,
            height: `${playerH}px`,
            maxWidth: viewScale === 'fit-width' ? 'none' : '100%',
            maxHeight: viewScale === 'fit-width' ? 'none' : '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            backgroundColor: '#050507',
            direction: 'ltr',
            transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1), height 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            flexShrink: 0,
          }}
        >
          <Player
            ref={setPlayerRef}
            key={`${playerKey}-${aspectRatio}-${durationInFrames}-${dynamicScene ? 'dynamic' : 'static'}`}
            component={Scene}
            inputProps={{ sceneData: effectiveSceneData || undefined }}
            durationInFrames={durationInFrames}
            compositionWidth={dimensions.width}
            compositionHeight={dimensions.height}
            fps={30}
            controls={false}
            autoPlay
            loop={isLoop}
            initialFrame={0}
            errorFallback={(error: Error) => (
              <div
                style={{
                  padding: '24px',
                  backgroundColor: '#181214',
                  color: '#f87171',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  borderRadius: '10px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  maxWidth: '600px',
                  direction: 'ltr',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginBottom: '8px' }}>
                  <AlertTriangle size={16} />
                  <h4 style={{ margin: 0 }}>Remotion Render Error:</h4>
                </div>
                <p>{error.message}</p>
                <pre style={{ marginTop: '8px', fontSize: '11px', color: '#fca5a5' }}>
                  {error.stack}
                </pre>
              </div>
            )}
            style={{
              width: `${playerW}px`,
              height: `${playerH}px`,
              aspectRatio: `${dimensions.width} / ${dimensions.height}`,
            }}
          />

          <CanvasGizmo
            containerRef={playerWrapperRef}
            selectedElementId={selectedElementId}
            onSelectElement={(id) => onSelectElement?.(id)}
            sceneData={effectiveSceneData}
            onLiveOverride={(override) => setLiveOverride(override)}
            onCommitTransform={async (payload) => {
              if (onUpdateElementTransform) {
                await onUpdateElementTransform(payload);
              }
            }}
            onDeleteElement={onDeleteElement}
            onOpenTextInspector={onOpenTextInspector}
            onTogglePlayPause={() => playerRef.current?.toggle()}
            enabled={isGizmoEnabled && !isCapturing && !isTextInspectorActive}
          />
        </div>
      </div>

      {/* Studio Timeline Component */}
      <Timeline
        currentFrame={currentFrame}
        durationInFrames={durationInFrames}
        fps={30}
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeek={handleSeek}
        isLoop={isLoop}
        onToggleLoop={handleToggleLoop}
        pinnedFrame={pinnedFrame}
        onPinFrame={onPinFrame}
        onUnpinFrame={onUnpinFrame}
        onToggleFullscreen={handleToggleFullscreen}
        isCollapsed={isTimelineCollapsed}
        onToggleCollapse={() => setIsTimelineCollapsed((prev) => !prev)}
        onCaptureSnapshot={captureFrameSnapshot}
        audioClips={audioClips}
        onAddAudioClip={onAddAudioClip}
        onUpdateAudioClip={onUpdateAudioClip}
        onDeleteAudioClip={onDeleteAudioClip}
        onClearAllAudio={onClearAllAudio}
        sceneData={sceneData}
        onUpdateTextElement={onUpdateTextElement}
        onUpdateElementTiming={onUpdateElementTiming}
        onUndoSceneData={onUndoSceneData}
        isBusy={isBusy}
        selectedElementId={selectedElementId}
        onSelectElement={onSelectElement}
        onDeleteElement={onDeleteElement}
        onSplitElement={onSplitElement}
        onOpenTextInspector={onOpenTextInspector}
      />
    </main>
  );
};
