import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Repeat,
  Layers,
  Sparkles,
  Volume2,
  VolumeX,
  Trash2,
  Clock,
  BookmarkPlus,
  BookmarkCheck,
  X,
  Plus,
  Sliders,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Scissors,
  Camera,
  Undo2,
  Film,
  Type,
  LayoutGrid,
  Copy,
  Check,
  RotateCcw,
  Edit3,
  ArrowRightToLine,
} from 'lucide-react';
import { AudioClip } from '../types/audio';
import { AudioLibraryModal } from './AudioLibraryModal';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
import { SceneData, TextElementData, CardElementData } from '../types/sceneData';
import { normalizeTracks, getEffectiveDuration, snapFrame, hasOverlap } from '../utils/sceneTimeline';
import { useLanguage } from '../i18n/LanguageContext';

export interface TimelineProps {
  currentFrame: number;
  durationInFrames: number;
  fps?: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (frame: number) => void;
  isLoop?: boolean;
  onToggleLoop?: () => void;
  pinnedFrame?: { frame: number; timeSeconds: string } | null;
  onPinFrame?: (frame: number, timeSeconds: string) => void;
  onUnpinFrame?: () => void;
  onToggleFullscreen?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onCaptureSnapshot?: () => void;
  audioClips?: AudioClip[];
  onAddAudioClip?: (clip: AudioClip) => void;
  onUpdateAudioClip?: (clipId: string, updates: Partial<AudioClip>) => void;
  onDeleteAudioClip?: (clipId: string) => void;
  onClearAllAudio?: () => void;
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
  onDeleteElement?: (kind: 'text' | 'card', id: string) => Promise<boolean | void>;
  onSplitElement?: (
    kind: 'text' | 'card',
    id: string,
    splitFrame: number
  ) => Promise<{ success: boolean; rightPieceId?: string; error?: string }>;
  onOpenTextInspector?: (element: TextElementData) => void;
}

const pad = (num: number, size = 2) => String(num).padStart(size, '0');

const formatTimecode = (frame: number, fps = 30): string => {
  const totalSeconds = Math.floor(frame / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const remFrames = frame % fps;
  return `${pad(minutes)}:${pad(seconds)}:${pad(remFrames)}`;
};

interface IntervalItem {
  id: string;
  startFrame: number;
  durationInFrames: number;
}

/**
 * Greedy Interval Scheduling algorithm:
 * Assigns items to minimal sub-lanes (sub-rows) so that no two items overlap horizontally.
 */
function calculateSubLanes<T extends IntervalItem>(items: T[] = []) {
  if (!items || items.length === 0) {
    return { itemToLane: new Map<string, number>(), totalLanes: 1 };
  }

  // Sort by startFrame ascending, then by duration descending
  const sorted = [...items].sort((a, b) => {
    const startA = Number(a.startFrame) || 0;
    const startB = Number(b.startFrame) || 0;
    if (startA !== startB) return startA - startB;
    const durA = Number(a.durationInFrames) || 0;
    const durB = Number(b.durationInFrames) || 0;
    return durB - durA;
  });

  const laneEndFrames: number[] = [];
  const itemToLane = new Map<string, number>();

  for (const item of sorted) {
    const start = Number(item.startFrame) || 0;
    const end = start + Math.max(1, Number(item.durationInFrames) || 1);
    let assignedLane = -1;

    for (let i = 0; i < laneEndFrames.length; i++) {
      if (laneEndFrames[i] <= start) {
        assignedLane = i;
        laneEndFrames[i] = end;
        break;
      }
    }

    if (assignedLane === -1) {
      assignedLane = laneEndFrames.length;
      laneEndFrames.push(end);
    }

    itemToLane.set(item.id, assignedLane);
  }

  return {
    itemToLane,
    totalLanes: Math.max(1, laneEndFrames.length),
  };
}

export const Timeline: React.FC<TimelineProps> = ({
  currentFrame,
  durationInFrames,
  fps = 30,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  isLoop = true,
  onToggleLoop,
  pinnedFrame,
  onPinFrame,
  onUnpinFrame,
  onToggleFullscreen,
  isCollapsed = false,
  onToggleCollapse,
  onCaptureSnapshot,
  audioClips = [],
  onAddAudioClip,
  onUpdateAudioClip,
  onDeleteAudioClip,
  onClearAllAudio,
  sceneData,
  onUpdateTextElement,
  onUpdateElementTiming,
  onUndoSceneData,
  isBusy = false,
  selectedElementId = null,
  onSelectElement,
  onDeleteElement,
  onSplitElement,
  onOpenTextInspector,
}) => {
  const { language, t, format } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [hoverFrame, setHoverFrame] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [splitFeedback, setSplitFeedback] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);
  const [selectedTextElement, setSelectedTextElement] = useState<TextElementData | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    element: TextElementData;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [draggingElement, setDraggingElement] = useState<{
    kind: 'text' | 'card';
    id: string;
    mode: 'move' | 'trim-left' | 'trim-right';
    startX: number;
    startY: number;
    initialStartFrame: number;
    initialDuration: number;
    initialTrack: number;
    currentStartFrame: number;
    currentDuration: number;
    currentTrack: number;
  } | null>(null);
  const [snapGuideFrame, setSnapGuideFrame] = useState<number | null>(null);
  const [trackConflictError, setTrackConflictError] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const leftHeadersRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside or Escape key
  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Synchronize internal selectedTextElement with selectedElementId
  useEffect(() => {
    if (!selectedElementId) {
      setSelectedTextElement(null);
    } else {
      const textItem = sceneData?.texts?.find((t) => t.id === selectedElementId);
      setSelectedTextElement(textItem || null);
    }
  }, [selectedElementId, sceneData?.texts]);

  // Split element or audio clip at the current playhead frame (Razor / Split Tool)
  const handleSplitAtPlayhead = useCallback(async () => {
    if (isBusy) return;

    // 1. Check if selected audio clip covers currentFrame
    if (selectedClipId) {
      const clip = audioClips.find((c) => c.id === selectedClipId);
      if (clip && currentFrame > clip.startFrame && currentFrame < clip.startFrame + clip.durationInFrames) {
        const origStart = clip.startFrame;
        const origDur = clip.durationInFrames;
        const leftDur = currentFrame - origStart;
        const rightDur = origStart + origDur - currentFrame;

        onUpdateAudioClip?.(clip.id, { durationInFrames: leftDur });
        const newClip: AudioClip = {
          ...clip,
          id: `${clip.id}_part_${Date.now()}`,
          name: `${clip.name} (${t.timeline.clipPart2})`,
          startFrame: currentFrame,
          durationInFrames: rightDur,
        };
        onAddAudioClip?.(newClip);
        setSelectedClipId(newClip.id);
        setSplitFeedback(format(t.timeline.splitFeedbackAudio, { frame: currentFrame }));
        setTimeout(() => setSplitFeedback(null), 2500);
        return;
      }
    }

    // 2. Identify target element: Selected element, or topmost element under playhead
    let targetElement: { kind: 'text' | 'card'; item: TextElementData | CardElementData } | null = null;

    if (selectedElementId) {
      const foundText = (sceneData?.texts || []).find((t) => t.id === selectedElementId && !t.isDeleted);
      if (foundText) {
        const effDur = getEffectiveDuration(foundText, durationInFrames);
        if (currentFrame > foundText.startFrame && currentFrame < foundText.startFrame + effDur) {
          targetElement = { kind: 'text', item: foundText };
        }
      } else {
        const foundCard = (sceneData?.cards || []).find((c) => c.id === selectedElementId && !c.isDeleted);
        if (foundCard) {
          const effDur = getEffectiveDuration(foundCard, durationInFrames);
          if (currentFrame > foundCard.startFrame && currentFrame < foundCard.startFrame + effDur) {
            targetElement = { kind: 'card', item: foundCard };
          }
        }
      }
    }

    // Fallback: search topmost element under playhead
    if (!targetElement) {
      // Check cards first
      for (const c of sceneData?.cards || []) {
        if (c.isDeleted) continue;
        const effDur = getEffectiveDuration(c, durationInFrames);
        if (currentFrame > c.startFrame && currentFrame < c.startFrame + effDur) {
          targetElement = { kind: 'card', item: c };
          break;
        }
      }
      // Check texts
      if (!targetElement) {
        for (const t of sceneData?.texts || []) {
          if (t.isDeleted || t.isChild) continue;
          const effDur = getEffectiveDuration(t, durationInFrames);
          if (currentFrame > t.startFrame && currentFrame < t.startFrame + effDur) {
            targetElement = { kind: 'text', item: t };
            break;
          }
        }
      }
      // Check audio clip under playhead
      if (!targetElement && audioClips.length > 0) {
        const clipUnder = audioClips.find(
          (c) => currentFrame > c.startFrame && currentFrame < c.startFrame + c.durationInFrames
        );
        if (clipUnder) {
          const leftDur = currentFrame - clipUnder.startFrame;
          const rightDur = clipUnder.startFrame + clipUnder.durationInFrames - currentFrame;
          onUpdateAudioClip?.(clipUnder.id, { durationInFrames: leftDur });
          const newClip: AudioClip = {
            ...clipUnder,
            id: `${clipUnder.id}_part_${Date.now()}`,
            name: `${clipUnder.name} (${t.timeline.clipPart2})`,
            startFrame: currentFrame,
            durationInFrames: rightDur,
          };
          onAddAudioClip?.(newClip);
          setSelectedClipId(newClip.id);
          setSplitFeedback(format(t.timeline.splitFeedbackAudio, { frame: currentFrame }));
          setTimeout(() => setSplitFeedback(null), 2500);
          return;
        }
      }
    }

    if (!targetElement) {
      setSplitFeedback(format(t.timeline.splitFeedbackHoverPrompt, { frame: currentFrame }));
      setTimeout(() => setSplitFeedback(null), 3000);
      return;
    }

    if (onSplitElement) {
      const res = await onSplitElement(targetElement.kind, targetElement.item.id, currentFrame);
      if (res && res.success) {
        if (res.rightPieceId) {
          onSelectElement?.(res.rightPieceId);
        }
        setSplitFeedback(format(t.timeline.splitFeedbackElement, { frame: currentFrame }));
        setTimeout(() => setSplitFeedback(null), 2500);
      } else if (res && res.error) {
        setSplitFeedback(res.error);
        setTimeout(() => setSplitFeedback(null), 3000);
      }
    }
  }, [
    isBusy,
    selectedClipId,
    selectedElementId,
    audioClips,
    currentFrame,
    durationInFrames,
    sceneData,
    onUpdateAudioClip,
    onAddAudioClip,
    onSplitElement,
    onSelectElement,
  ]);

  // Delete selected element or audio clip
  const handleDeleteSelected = useCallback(async () => {
    if (isBusy) return;
    if (selectedClipId) {
      onDeleteAudioClip?.(selectedClipId);
      setSelectedClipId(null);
      setSplitFeedback(t.timeline.deleteFeedbackAudio);
      setTimeout(() => setSplitFeedback(null), 2000);
      return;
    }
    if (selectedElementId) {
      const isCard = (sceneData?.cards || []).some((c) => c.id === selectedElementId);
      const kind = isCard ? 'card' : 'text';
      if (onDeleteElement) {
        await onDeleteElement(kind, selectedElementId);
      } else if (onUpdateElementTiming) {
        await onUpdateElementTiming({ kind, id: selectedElementId, isDeleted: true });
      }
      onSelectElement?.(null);
      setSelectedTextElement(null);
      setSplitFeedback(t.timeline.deleteFeedbackElement);
      setTimeout(() => setSplitFeedback(null), 2000);
    }
  }, [
    isBusy,
    selectedClipId,
    selectedElementId,
    sceneData,
    onDeleteAudioClip,
    onDeleteElement,
    onUpdateElementTiming,
    onSelectElement,
  ]);

  // Global Keyboard Shortcuts (Ctrl+Z Undo, Ctrl+B / S Split, Delete / Backspace Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (!isBusy && onUndoSceneData) {
          onUndoSceneData();
        }
        return;
      }

      // Split: Ctrl+B / Cmd+B or 'S'
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') ||
        (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey)
      ) {
        e.preventDefault();
        handleSplitAtPlayhead();
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId || selectedClipId) {
          e.preventDefault();
          handleDeleteSelected();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndoSceneData, isBusy, handleSplitAtPlayhead, handleDeleteSelected, selectedElementId, selectedClipId]);

  // Dragging / Resizing audio clip state
  const [draggingClip, setDraggingClip] = useState<{
    id: string;
    mode: 'move' | 'trim-left' | 'trim-right';
    startX: number;
    initialStartFrame: number;
    initialDuration: number;
  } | null>(null);

  const tracksContainerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState<number>(1000);

  // Live measurement of the master toolbar width via ResizeObserver
  useEffect(() => {
    if (!toolbarRef.current) return;
    const updateToolbar = () => {
      if (toolbarRef.current) {
        const w = toolbarRef.current.clientWidth;
        if (w > 0) setToolbarWidth(w);
      }
    };
    updateToolbar();
    const observer = new ResizeObserver(updateToolbar);
    observer.observe(toolbarRef.current);
    return () => observer.disconnect();
  }, []);

  // Live measurement of the tracks container width via ResizeObserver
  useEffect(() => {
    if (!tracksContainerRef.current) return;
    const updateWidth = () => {
      if (tracksContainerRef.current) {
        const w = tracksContainerRef.current.clientWidth;
        if (w > 0) setContainerWidth(w);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(tracksContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Synchronize audio playback with video playhead
  useAudioPlayback(audioClips, currentFrame, isPlaying, fps);

  // Exact frames and zoom dimensions
  const compFrames = Math.max(1, durationInFrames);
  const maxAudioEndFrame = audioClips.reduce(
    (max, clip) => Math.max(max, clip.startFrame + clip.durationInFrames),
    compFrames
  );
  const totalContentFrames = Math.max(compFrames, maxAudioEndFrame);

  // Fit all zoom ratio (composition frames / max content frames)
  const fitAllZoom = maxAudioEndFrame > compFrames ? Number((compFrames / maxAudioEndFrame).toFixed(3)) : 1;
  const minAllowedZoom = Math.min(0.04, fitAllZoom);

  // Pixels per frame calculation
  const basePixelsPerFrame = containerWidth / compFrames;
  const pixelsPerFrame = basePixelsPerFrame * zoomLevel;

  // Total canvas width and comp boundary in pixels
  const totalTimelineWidthPx = Math.max(containerWidth, Math.ceil(totalContentFrames * pixelsPerFrame));
  const compBoundaryPx = compFrames * pixelsPerFrame;

  const currentTimecode = formatTimecode(currentFrame, fps);
  const totalTimecode = formatTimecode(Math.max(0, durationInFrames - 1), fps);
  const currentSeconds = (currentFrame / fps).toFixed(2);

  // Master toolbar responsive scaling thresholds
  const isToolbarNarrow = toolbarWidth < 1120;
  const isToolbarCompact = toolbarWidth < 880;
  const isToolbarUltraCompact = toolbarWidth < 650;

  // Multi-track grouping and normalization for texts and cards
  const normalizedTexts = useMemo(() => {
    return normalizeTracks(
      (sceneData?.texts || []).filter((t) => !t.isDeleted),
      durationInFrames
    );
  }, [sceneData?.texts, durationInFrames]);

  const normalizedCards = useMemo(() => {
    return normalizeTracks(
      (sceneData?.cards || []).filter((c) => !c.isDeleted),
      durationInFrames
    );
  }, [sceneData?.cards, durationInFrames]);

  const textTracksMap = useMemo(() => {
    const map = new Map<number, TextElementData[]>();
    for (const item of normalizedTexts) {
      const t = typeof item.track === 'number' && item.track >= 0 ? item.track : 0;
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(item);
    }
    return map;
  }, [normalizedTexts]);

  const cardTracksMap = useMemo(() => {
    const map = new Map<number, CardElementData[]>();
    for (const item of normalizedCards) {
      const t = typeof item.track === 'number' && item.track >= 0 ? item.track : 0;
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(item);
    }
    return map;
  }, [normalizedCards]);

  const textTrackIndices = useMemo(() => {
    const indices = Array.from(textTracksMap.keys()).sort((a: number, b: number) => a - b);
    return indices.length > 0 ? indices : [0];
  }, [textTracksMap]);

  const cardTrackIndices = useMemo(() => {
    const indices = Array.from(cardTracksMap.keys()).sort((a: number, b: number) => a - b);
    return indices.length > 0 ? indices : [0];
  }, [cardTracksMap]);

  const hasAudio = Boolean(audioClips && audioClips.length > 0);
  const audioLanes = calculateSubLanes(audioClips);

  const trackShotsHeight = 28;
  const trackAudioHeight = hasAudio ? Math.max(42, audioLanes.totalLanes * 36 + 6) : 0;
  const totalTracksHeight =
    26 + trackShotsHeight + textTrackIndices.length * 28 + cardTrackIndices.length * 28 + trackAudioHeight;

  // Dynamic user-resizable timeline height with persistence
  const [customTimelineHeight, setCustomTimelineHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('studio_timeline_height');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 180 && val <= 1200) return val;
      }
    } catch (_) {}
    return Math.max(280, Math.min(480, 46 + totalTracksHeight));
  });
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const resizeStartYRef = useRef<number>(0);
  const resizeStartHeightRef = useRef<number>(0);

  const timelineHeight = isCollapsed ? 46 : Math.max(180, customTimelineHeight);

  const handleResizerMouseDown = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizingHeight(true);
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = timelineHeight;
  };

  useEffect(() => {
    if (!isResizingHeight) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = resizeStartYRef.current - e.clientY;
      const maxHeight = Math.max(300, Math.floor(window.innerHeight * 0.75));
      const minHeight = 180;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartHeightRef.current + deltaY));
      setCustomTimelineHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingHeight(false);
      setCustomTimelineHeight((curr) => {
        try {
          localStorage.setItem('studio_timeline_height', String(curr));
        } catch (_) {}
        return curr;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingHeight]);

  const handleResizerDoubleClick = () => {
    if (isCollapsed) return;
    const optimalHeight = Math.max(260, Math.min(Math.floor(window.innerHeight * 0.75), 46 + totalTracksHeight + 10));
    setCustomTimelineHeight(optimalHeight);
    try {
      localStorage.setItem('studio_timeline_height', String(optimalHeight));
    } catch (_) {}
  };

  // Calculate target frame from pointer event
  const getFrameFromEvent = useCallback(
    (clientX: number): number => {
      if (!rulerRef.current) return 0;
      const rect = rulerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const target = Math.round(x / pixelsPerFrame);
      return Math.max(0, Math.min(durationInFrames - 1, target));
    },
    [durationInFrames, pixelsPerFrame]
  );

  // Playhead scrubbing listeners on window
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const f = getFrameFromEvent(e.clientX);
      onSeek(f);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, getFrameFromEvent, onSeek]);

  // Audio clip dragging & trimming listeners on window
  useEffect(() => {
    if (!draggingClip) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - draggingClip.startX;
      const deltaFrames = Math.round(deltaX / pixelsPerFrame);

      if (draggingClip.mode === 'move') {
        const newStart = Math.max(0, draggingClip.initialStartFrame + deltaFrames);
        onUpdateAudioClip?.(draggingClip.id, { startFrame: newStart });
      } else if (draggingClip.mode === 'trim-left') {
        const maxStart = draggingClip.initialStartFrame + draggingClip.initialDuration - 5;
        const newStart = Math.max(0, Math.min(maxStart, draggingClip.initialStartFrame + deltaFrames));
        const actualShift = newStart - draggingClip.initialStartFrame;
        const newDuration = draggingClip.initialDuration - actualShift;
        onUpdateAudioClip?.(draggingClip.id, {
          startFrame: newStart,
          durationInFrames: Math.max(5, newDuration),
        });
      } else if (draggingClip.mode === 'trim-right') {
        let newDuration = Math.max(5, draggingClip.initialDuration + deltaFrames);

        // Magnetic snap to comp end (durationInFrames) if within 14px
        const currentEnd = draggingClip.initialStartFrame + newDuration;
        const diffToComp = Math.abs(currentEnd - durationInFrames);
        if (diffToComp * pixelsPerFrame <= 14) {
          newDuration = Math.max(5, durationInFrames - draggingClip.initialStartFrame);
        }

        onUpdateAudioClip?.(draggingClip.id, { durationInFrames: newDuration });
      }
    };

    const handleMouseUp = () => {
      setDraggingClip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingClip, pixelsPerFrame, durationInFrames, onUpdateAudioClip]);

  // Quick helper to trim clip to comp duration
  const handleTrimClipToComp = (clipId: string) => {
    const clip = audioClips.find((c) => c.id === clipId);
    if (!clip) return;
    const newDuration = Math.max(5, durationInFrames - clip.startFrame);
    onUpdateAudioClip?.(clipId, { durationInFrames: newDuration });
  };

  const handleElementMouseDown = (
    e: React.MouseEvent,
    kind: 'text' | 'card',
    item: any,
    mode: 'move' | 'trim-left' | 'trim-right'
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (kind === 'text') {
      setSelectedTextElement(item);
    }
    onSeek(item.startFrame);

    const effectiveDur = getEffectiveDuration(item, durationInFrames);
    const trackIdx = typeof item.track === 'number' && item.track >= 0 ? item.track : 0;

    setDraggingElement({
      kind,
      id: item.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initialStartFrame: item.startFrame,
      initialDuration: effectiveDur,
      initialTrack: trackIdx,
      currentStartFrame: item.startFrame,
      currentDuration: effectiveDur,
      currentTrack: trackIdx,
    });
  };

  // Dragging and Trimming for Visual Text and Card Elements
  useEffect(() => {
    if (!draggingElement) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - draggingElement.startX;
      const deltaFrames = Math.round(deltaX / pixelsPerFrame);

      let newStart = draggingElement.initialStartFrame;
      let newDuration = draggingElement.initialDuration;
      let newTrack = draggingElement.initialTrack;

      // Magnetic snap targets: 0, playhead, comp end, and all neighbor element boundaries
      const snapTargets = [0, currentFrame, durationInFrames];
      const candidateList = draggingElement.kind === 'text' ? normalizedTexts : normalizedCards;
      for (const other of candidateList) {
        if (other.id === draggingElement.id) continue;
        snapTargets.push(other.startFrame);
        const otherDur = getEffectiveDuration(other, durationInFrames);
        snapTargets.push(other.startFrame + otherDur);
      }

      if (draggingElement.mode === 'move') {
        const rawStart = Math.max(0, draggingElement.initialStartFrame + deltaFrames);
        const snapped = snapFrame(rawStart, snapTargets, 3);
        newStart = snapped.frame;
        setSnapGuideFrame(snapped.snapped && snapped.frame !== undefined ? snapped.frame : null);

        // Vertical track movement: 28px per track row
        const deltaY = e.clientY - draggingElement.startY;
        const trackShift = Math.round(deltaY / 28);
        const maxTrack =
          draggingElement.kind === 'text'
            ? Math.max(0, textTrackIndices.length)
            : Math.max(0, cardTrackIndices.length);
        newTrack = Math.max(0, Math.min(maxTrack, draggingElement.initialTrack + trackShift));
      } else if (draggingElement.mode === 'trim-left') {
        const candList = draggingElement.kind === 'text' ? normalizedTexts : normalizedCards;
        const neighborOnLeft = candList
          .filter(
            (o) =>
              o.id !== draggingElement.id &&
              !o.isDeleted &&
              (o.track ?? 0) === draggingElement.initialTrack &&
              o.startFrame < draggingElement.initialStartFrame
          )
          .sort((a, b) => b.startFrame - a.startFrame)[0];

        const minAllowedStart = neighborOnLeft
          ? neighborOnLeft.startFrame + getEffectiveDuration(neighborOnLeft, durationInFrames)
          : 0;
        const maxStart = draggingElement.initialStartFrame + draggingElement.initialDuration - 3;
        const rawStart = Math.max(minAllowedStart, Math.min(maxStart, draggingElement.initialStartFrame + deltaFrames));
        const snapped = snapFrame(rawStart, snapTargets, 3);
        newStart = Math.max(minAllowedStart, Math.min(maxStart, snapped.frame));
        setSnapGuideFrame(snapped.snapped && snapped.frame !== undefined ? snapped.frame : null);
        const shift = newStart - draggingElement.initialStartFrame;
        newDuration = Math.max(3, draggingElement.initialDuration - shift);
      } else if (draggingElement.mode === 'trim-right') {
        const candList = draggingElement.kind === 'text' ? normalizedTexts : normalizedCards;
        const neighborOnRight = candList
          .filter(
            (o) =>
              o.id !== draggingElement.id &&
              !o.isDeleted &&
              (o.track ?? 0) === draggingElement.initialTrack &&
              o.startFrame > draggingElement.initialStartFrame
          )
          .sort((a, b) => a.startFrame - b.startFrame)[0];

        const maxAllowedEnd = neighborOnRight ? neighborOnRight.startFrame : durationInFrames;
        const rawEnd = draggingElement.initialStartFrame + draggingElement.initialDuration + deltaFrames;
        const snapped = snapFrame(rawEnd, snapTargets, 3);
        setSnapGuideFrame(snapped.snapped && snapped.frame !== undefined ? snapped.frame : null);
        const clampedEnd = Math.max(
          draggingElement.initialStartFrame + 3,
          Math.min(maxAllowedEnd, snapped.frame)
        );
        newDuration = clampedEnd - draggingElement.initialStartFrame;
      }

      setDraggingElement((prev) =>
        prev
          ? {
              ...prev,
              currentStartFrame: newStart,
              currentDuration: newDuration,
              currentTrack: newTrack,
            }
          : null
      );
    };

    const handleMouseUp = async () => {
      if (!draggingElement) return;

      setSnapGuideFrame(null);
      const {
        kind,
        id,
        mode,
        initialStartFrame,
        initialDuration,
        initialTrack,
        currentStartFrame,
        currentDuration,
        currentTrack,
      } = draggingElement;

      const hasChanged =
        currentStartFrame !== initialStartFrame ||
        currentDuration !== initialDuration ||
        currentTrack !== initialTrack;

      if (hasChanged && onUpdateElementTiming) {
        const success = await onUpdateElementTiming({
          kind,
          id,
          startFrame: currentStartFrame,
          durationInFrames: currentDuration,
          track: currentTrack,
          holdToEnd: mode === 'trim-right' ? false : undefined,
        });

        if (!success) {
          setTrackConflictError(format(t.timeline.trackConflictError, { track: currentTrack + 1 }));
          setTimeout(() => setTrackConflictError(null), 3000);
        }
      }

      setDraggingElement(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    draggingElement,
    pixelsPerFrame,
    currentFrame,
    durationInFrames,
    normalizedTexts,
    normalizedCards,
    textTrackIndices,
    cardTrackIndices,
    onUpdateElementTiming,
  ]);

  // Smooth mouse wheel zoom (Ctrl or Alt + Wheel)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.altKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      setZoomLevel((prev) => {
        const next = prev * zoomFactor;
        return Math.min(4, Math.max(minAllowedZoom, Number(next.toFixed(3))));
      });
    }
  };

  // Spacebar shortcut for Play / Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        if (isPlaying) {
          onPause();
        } else {
          onPlay();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, onPlay, onPause]);

  const handleRulerMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const f = getFrameFromEvent(e.clientX);
    onSeek(f);
  };

  const handleRulerMouseMove = (e: React.MouseEvent) => {
    if (isDragging) return;
    const f = getFrameFromEvent(e.clientX);
    setHoverFrame(f);
  };

  const handleRulerMouseLeave = () => {
    if (!isDragging) {
      setHoverFrame(null);
    }
  };

  const handleStepBack = () => {
    onSeek(Math.max(0, currentFrame - 1));
  };

  const handleStepForward = () => {
    onSeek(Math.min(durationInFrames - 1, currentFrame + 1));
  };

  const handleJumpToStart = () => {
    onSeek(0);
  };

  const handleJumpToEnd = () => {
    onSeek(Math.max(0, durationInFrames - 1));
  };

  const handleTogglePlay = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    // Release focus from any active input/textarea immediately so hotkeys and timeline controls respond without pre-clicks
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const isCurrentFramePinned = pinnedFrame?.frame === currentFrame;

  const handleTogglePin = () => {
    if (isCurrentFramePinned) {
      onUnpinFrame?.();
    } else {
      onPinFrame?.(currentFrame, currentSeconds);
    }
  };

  // Generate ruler tick marks across full content duration
  const totalSeconds = Math.ceil(totalContentFrames / fps);
  const pixelsPerSecond = fps * pixelsPerFrame;

  let tickStepSec = 1;
  if (pixelsPerSecond < 12) tickStepSec = 30;
  else if (pixelsPerSecond < 25) tickStepSec = 10;
  else if (pixelsPerSecond < 50) tickStepSec = 5;
  else if (pixelsPerSecond < 90) tickStepSec = 2;
  else tickStepSec = 1;

  const secondTicks = [];
  for (let s = 0; s <= totalSeconds; s += tickStepSec) {
    const f = s * fps;
    const leftPx = f * pixelsPerFrame;
    secondTicks.push({ second: s, frame: f, leftPx });
  }

  return (
    <div
      style={{
        height: `${timelineHeight}px`,
        minHeight: `${timelineHeight}px`,
        transition: isResizingHeight ? 'none' : 'height 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        backgroundColor: '#0c0c0f',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        direction: 'ltr',
        zIndex: 20,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Top Splitter / Height Resizer Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={handleResizerMouseDown}
          onDoubleClick={handleResizerDoubleClick}
          title={t.timeline.resizeHeightTooltip}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            cursor: 'row-resize',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isResizingHeight ? 'rgba(56, 189, 248, 0.35)' : 'transparent',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isResizingHeight) {
              e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizingHeight) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {/* Subtle center grip bar */}
          <div
            style={{
              width: '36px',
              height: '3px',
              borderRadius: '2px',
              backgroundColor: isResizingHeight ? '#38bdf8' : 'rgba(255, 255, 255, 0.25)',
              boxShadow: isResizingHeight ? '0 0 8px #38bdf8' : 'none',
              transition: 'all 0.15s ease',
            }}
          />
        </div>
      )}

      {/* 1. Timeline Master Toolbar */}
      <div
        ref={toolbarRef}
        style={{
          height: isToolbarCompact ? '42px' : '46px',
          padding: isToolbarCompact ? '0 10px' : '0 16px',
          backgroundColor: '#121216',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: isToolbarCompact ? '6px' : '10px',
          position: 'relative',
          minWidth: 0,
        }}
      >
        {/* Left: Timecode LED Readout, Frame, Undo, Snapshot */}
        <div
          style={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: isToolbarCompact ? '4px' : '6px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Timecode LED Readout */}
          <div
            title={format(t.timeline.currentTimecodeTooltip, { timecode: totalTimecode })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#070709',
              padding: isToolbarCompact ? '3px 6px' : '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <Clock size={11} color="#f97316" />
            <span
              style={{
                fontSize: isToolbarCompact ? '12px' : '13px',
                fontWeight: 700,
                color: '#f97316',
                letterSpacing: '0.03em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {currentTimecode}
            </span>
            {!isToolbarNarrow && (
              <>
                <span style={{ fontSize: '10px', color: '#52525b' }}>/</span>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#a1a1aa',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {totalTimecode}
                </span>
              </>
            )}
          </div>

          {/* Frame Counter */}
          {!isToolbarCompact && (
            <div
              title={format(t.timeline.frameCounterTooltip, { frame: currentFrame, total: durationInFrames })}
              style={{
                fontSize: '11px',
                color: '#71717a',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                padding: '3px 7px',
                borderRadius: '5px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                userSelect: 'none',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ color: '#a1a1aa', fontWeight: 600 }}>F:</span>
              <span style={{ color: '#e4e4e7', fontWeight: 600 }}>{currentFrame}</span>
              {!isToolbarNarrow && (
                <>
                  <span style={{ color: '#52525b' }}>/</span>
                  <span style={{ color: '#71717a' }}>{durationInFrames}</span>
                </>
              )}
            </div>
          )}

          {/* Undo Scene Data Button */}
          {onUndoSceneData && (
            <button
              onClick={() => !isBusy && onUndoSceneData()}
              disabled={isBusy}
              title={t.timeline.undoTooltip}
              style={{
                width: isToolbarCompact ? '24px' : '28px',
                height: isToolbarCompact ? '24px' : '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: isBusy ? '#52525b' : '#a1a1aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isBusy) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isBusy) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = isBusy ? '#52525b' : '#a1a1aa';
                }
              }}
            >
              <Undo2 size={13} />
            </button>
          )}

          {/* Split / Razor Tool Button */}
          <button
            onClick={handleSplitAtPlayhead}
            disabled={isBusy}
            title={t.timeline.splitTooltip}
            style={{
              width: isToolbarCompact ? '24px' : '28px',
              height: isToolbarCompact ? '24px' : '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: isBusy ? '#52525b' : '#a1a1aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isBusy) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                e.currentTarget.style.color = '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isBusy) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = isBusy ? '#52525b' : '#a1a1aa';
              }
            }}
          >
            <Scissors size={13} />
          </button>

          {/* Add Audio Button */}
          <button
            onClick={() => setIsAudioModalOpen(true)}
            title={t.timeline.addAudioTooltip}
            style={{
              width: isToolbarCompact ? '24px' : '28px',
              height: isToolbarCompact ? '24px' : '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#a1a1aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#a1a1aa';
            }}
          >
            <Volume2 size={13} />
          </button>

          {/* Delete Selected Item Button */}
          {(selectedElementId || selectedClipId) && (
            <button
              onClick={handleDeleteSelected}
              disabled={isBusy}
              title={t.timeline.deleteSelectedTooltip}
              style={{
                width: isToolbarCompact ? '24px' : '28px',
                height: isToolbarCompact ? '24px' : '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: isBusy ? '#52525b' : '#a1a1aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isBusy) {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                  e.currentTarget.style.color = '#f87171';
                }
              }}
              onMouseLeave={(e) => {
                if (!isBusy) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = isBusy ? '#52525b' : '#a1a1aa';
                }
              }}
            >
              <Trash2 size={13} />
            </button>
          )}

          {/* AI Busy Lock Indicator */}
          {isBusy && (
            <div
              title={t.timeline.agentWorkingTooltip}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 7px',
                borderRadius: '5px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '10.5px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                }}
              />
              {!isToolbarCompact && <span>{isToolbarNarrow ? t.timeline.agentWorkingBadgeCompact : t.timeline.agentWorkingBadge}</span>}
            </div>
          )}

          {/* Quick Snapshot to Chat Button */}
          {onCaptureSnapshot && (
            <button
              onClick={onCaptureSnapshot}
              title={t.player.snapshotTooltip}
              style={{
                width: isToolbarCompact ? '24px' : '28px',
                height: isToolbarCompact ? '24px' : '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#a1a1aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              <Camera size={13} />
            </button>
          )}

          {/* Pinned Frame Pill (if pinned) */}
          {pinnedFrame && (
            <div
              title={format(t.timeline.pinnedFrameBadge, { frame: `${pinnedFrame.frame} (${pinnedFrame.timeSeconds}${t.common.seconds})` })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 6px',
                borderRadius: '5px',
                backgroundColor: 'rgba(249, 115, 22, 0.12)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                fontSize: '10.5px',
                color: '#fb923c',
                flexShrink: 0,
              }}
            >
              <BookmarkCheck size={11} color="#f97316" />
              <span>{!isToolbarNarrow ? format(t.timeline.pinnedFrameBadge, { frame: pinnedFrame.frame }) : `${pinnedFrame.frame}F`}</span>
              {onUnpinFrame && (
                <button
                  onClick={onUnpinFrame}
                  title={t.timeline.unpinTooltip}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 2px',
                  }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Center: Transport Controls (In-Flow Flex, Never Overlapped) */}
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isToolbarCompact ? '2px' : '4px',
            margin: '0 10px',
            zIndex: 10,
          }}
        >
          {/* Jump to start */}
          {!isToolbarUltraCompact && (
            <button
              type="button"
              onClick={handleJumpToStart}
              title={t.timeline.goToStartTooltip}
              style={{
                width: isToolbarCompact ? '24px' : '28px',
                height: isToolbarCompact ? '24px' : '28px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
            >
              <SkipBack size={13} />
            </button>
          )}

          {/* Step Back 1 Frame */}
          <button
            type="button"
            onClick={handleStepBack}
            title={t.timeline.prevFrameTooltip}
            style={{
              width: isToolbarCompact ? '24px' : '28px',
              height: isToolbarCompact ? '24px' : '28px',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
          >
            <ChevronLeft size={15} />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={handleTogglePlay}
            title={isPlaying ? t.timeline.pauseTooltip : t.timeline.playTooltip}
            style={{
              width: isToolbarCompact ? '30px' : '34px',
              height: isToolbarCompact ? '30px' : '34px',
              borderRadius: '50%',
              backgroundColor: isPlaying ? '#27272a' : '#f97316',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: isPlaying ? '#f4f4f5' : '#09090b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isPlaying ? 'none' : '0 0 14px rgba(249, 115, 22, 0.45)',
              transition: 'all 0.15s ease',
              margin: '0 2px',
              flexShrink: 0,
            }}
          >
            {isPlaying ? (
              <Pause size={isToolbarCompact ? 13 : 15} fill="currentColor" />
            ) : (
              <Play
                size={isToolbarCompact ? 13 : 15}
                fill="currentColor"
                style={{ marginLeft: '1px' }}
              />
            )}
          </button>

          {/* Step Forward 1 Frame */}
          <button
            type="button"
            onClick={handleStepForward}
            title={t.timeline.nextFrameTooltip}
            style={{
              width: isToolbarCompact ? '24px' : '28px',
              height: isToolbarCompact ? '24px' : '28px',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
          >
            <ChevronRight size={15} />
          </button>

          {/* Jump to end */}
          {!isToolbarUltraCompact && (
            <button
              type="button"
              onClick={handleJumpToEnd}
              title={t.timeline.goToEndTooltip}
              style={{
                width: isToolbarCompact ? '24px' : '28px',
                height: isToolbarCompact ? '24px' : '28px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
            >
              <SkipForward size={13} />
            </button>
          )}

          {/* Loop Toggle */}
          {onToggleLoop && (
            <button
              type="button"
              onClick={onToggleLoop}
              title={isLoop ? t.timeline.loopActiveTooltip : t.timeline.loopInactiveTooltip}
              style={{
                width: isToolbarCompact ? '24px' : '28px',
                height: isToolbarCompact ? '24px' : '28px',
                borderRadius: '6px',
                backgroundColor: isLoop ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                border: 'none',
                color: isLoop ? '#f97316' : '#71717a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Repeat size={12} />
            </button>
          )}
        </div>

        {/* Right: AI Pin Button & View Options */}
        <div
          style={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: isToolbarCompact ? '4px' : '6px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Pin Frame to Chat Action */}
          <button
            onClick={handleTogglePin}
            title={t.timeline.pinFrameToChatTooltip}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: isToolbarCompact ? '4px 7px' : '5px 10px',
              borderRadius: '6px',
              backgroundColor: isCurrentFramePinned ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${isCurrentFramePinned ? 'rgba(249, 115, 22, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
              color: isCurrentFramePinned ? '#fb923c' : '#d4d4d8',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isCurrentFramePinned ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = isCurrentFramePinned ? 'rgba(249, 115, 22, 0.45)' : 'rgba(255, 255, 255, 0.08)';
            }}
          >
            <BookmarkPlus size={12} color="#f97316" />
            {!isToolbarNarrow && <span>{t.timeline.pinFrameToChat}</span>}
          </button>

          {/* Professional Zoom & View Scaling Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              backgroundColor: '#09090b',
              borderRadius: '6px',
              padding: '2px 3px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => {
                const zoomSteps = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
                const next = [...zoomSteps].reverse().find((z) => z < zoomLevel - 0.04);
                setZoomLevel(next !== undefined ? next : Math.max(minAllowedZoom, Number((zoomLevel - 0.2).toFixed(2))));
              }}
              disabled={zoomLevel <= minAllowedZoom}
              title={t.timeline.zoomOutTooltip}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                color: zoomLevel <= minAllowedZoom ? '#3f3f46' : '#a1a1aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: zoomLevel <= minAllowedZoom ? 'not-allowed' : 'pointer',
              }}
            >
              <ZoomOut size={11} />
            </button>
            <span
              style={{
                fontSize: '9.5px',
                color: '#d4d4d8',
                padding: '0 2px',
                fontFamily: 'monospace',
                minWidth: '28px',
                textAlign: 'center',
              }}
            >
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => {
                const zoomSteps = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
                const next = zoomSteps.find((z) => z > zoomLevel + 0.04);
                setZoomLevel(next !== undefined ? next : Math.min(4, Number((zoomLevel + 0.25).toFixed(2))));
              }}
              disabled={zoomLevel >= 4}
              title={t.timeline.zoomInTooltip}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                color: zoomLevel >= 4 ? '#3f3f46' : '#a1a1aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: zoomLevel >= 4 ? 'not-allowed' : 'pointer',
              }}
            >
              <ZoomIn size={11} />
            </button>

            {!isToolbarCompact && (
              <>
                <div style={{ width: '1px', height: '10px', backgroundColor: 'rgba(255, 255, 255, 0.1)', margin: '0 1px' }} />

                {/* Fit to Comp (100%) */}
                <button
                  onClick={() => setZoomLevel(1.0)}
                  title={t.timeline.fitCompTooltip}
                  style={{
                    padding: '2px 5px',
                    borderRadius: '4px',
                    fontSize: '9px',
                    fontWeight: 600,
                    backgroundColor: Math.abs(zoomLevel - 1.0) < 0.03 ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    color: Math.abs(zoomLevel - 1.0) < 0.03 ? '#f4f4f5' : '#71717a',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t.timeline.fitCompLabel}
                </button>

                {/* Fit to All Content (when audio overflows) */}
                {maxAudioEndFrame > compFrames && (
                  <button
                    onClick={() => setZoomLevel(fitAllZoom)}
                    title={t.timeline.fitAllTooltip}
                    style={{
                      padding: '2px 5px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 600,
                      backgroundColor: Math.abs(zoomLevel - fitAllZoom) < 0.03 ? 'rgba(249, 115, 22, 0.2)' : 'transparent',
                      color: Math.abs(zoomLevel - fitAllZoom) < 0.03 ? '#fb923c' : '#a1a1aa',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {!isToolbarNarrow ? t.timeline.fitAllLabel : t.timeline.fitAllCompact}
                  </button>
                )}
              </>
            )}
          </div>

          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              title={t.timeline.fullscreenTooltip}
              style={{
                width: isToolbarCompact ? '24px' : '28px',
                height: isToolbarCompact ? '24px' : '28px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Maximize2 size={13} />
            </button>
          )}

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={t.timeline.toggleCollapseTooltip}
              style={{
                width: isToolbarCompact ? '24px' : '28px',
                height: isToolbarCompact ? '24px' : '28px',
                borderRadius: '6px',
                backgroundColor: isCollapsed ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                border: 'none',
                color: isCollapsed ? '#fb923c' : '#a1a1aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isCollapsed) e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                if (!isCollapsed) e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* 2. Timeline Tracks Body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          backgroundColor: '#0a0a0d',
          position: 'relative',
        }}
      >
        {/* Left Track Headers Column */}
        <div
          ref={leftHeadersRef}
          onWheel={(e) => {
            if (tracksContainerRef.current) {
              tracksContainerRef.current.scrollTop += e.deltaY;
            }
          }}
          style={{
            width: isToolbarCompact ? '130px' : '170px',
            minWidth: isToolbarCompact ? '110px' : '150px',
            backgroundColor: '#101014',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'hidden',
            zIndex: 10,
            transition: 'width 0.15s ease',
          }}
        >
          {/* Ruler Corner Header */}
          <div
            style={{
              height: '26px',
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '10px',
              fontWeight: 600,
              color: '#52525b',
              backgroundColor: '#121216',
              position: 'sticky',
              top: 0,
              zIndex: 15,
              flexShrink: 0,
            }}
          >
            <span>TRACKS</span>
            <span>30 FPS</span>
          </div>

          {/* Track 1 Header: Shots / Rhythm Beats */}
          <div
            style={{
              height: `${trackShotsHeight}px`,
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              backgroundColor: '#0f0f13',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '4px',
                  height: '16px',
                  borderRadius: '2px',
                  backgroundColor: '#38bdf8',
                }}
              />
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#f4f4f5' }}>
                {t.timeline.beatsTrack}
              </span>
            </div>
            <Film size={12} color="#38bdf8" />
          </div>

          {/* Multi-Track Text Headers: T1, T2, ... */}
          {textTrackIndices.map((tIdx: number) => {
            const itemsOnTrack = textTracksMap.get(tIdx) || [];
            return (
              <div
                key={`text-track-header-${tIdx}`}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  backgroundColor: '#0e0e13',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '4px',
                      height: '16px',
                      borderRadius: '2px',
                      backgroundColor: '#0284c7',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: '#38bdf8',
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      flexShrink: 0,
                    }}
                  >
                    T{tIdx + 1}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#a1a1aa',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {itemsOnTrack[0]?.text || format(t.timeline.textTrack, { idx: tIdx + 1 })}
                  </span>
                </div>
                <Type size={11} color="#38bdf8" style={{ flexShrink: 0 }} />
              </div>
            );
          })}

          {/* Multi-Track Card Headers: C1, C2, ... */}
          {cardTrackIndices.map((cIdx: number) => {
            const cardsOnTrack = cardTracksMap.get(cIdx) || [];
            return (
              <div
                key={`card-track-header-${cIdx}`}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  backgroundColor: '#0e0e13',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '4px',
                      height: '16px',
                      borderRadius: '2px',
                      backgroundColor: '#a855f7',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: '#c084fc',
                      backgroundColor: 'rgba(168, 85, 247, 0.15)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      flexShrink: 0,
                    }}
                  >
                    C{cIdx + 1}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#a1a1aa',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {cardsOnTrack[0]?.name || format(t.timeline.cardTrack, { idx: cIdx + 1 })}
                  </span>
                </div>
                <LayoutGrid size={11} color="#a855f7" style={{ flexShrink: 0 }} />
              </div>
            );
          })}

          {/* Track 4 Header: Audio with Add Sound Action */}
          {hasAudio && (
            <div
              style={{
                height: `${trackAudioHeight}px`,
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#0f0f13',
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '5px',
                    height: '24px',
                    borderRadius: '3px',
                    backgroundColor: '#10b981',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#f4f4f5' }}>{t.timeline.audioTrack}</span>
                  <span style={{ fontSize: '9px', color: '#71717a' }}>
                    {audioClips.length > 0 ? format(t.timeline.audioClipsCount, { count: audioClips.length }) : t.timeline.emptyAudio}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {audioClips.length > 0 && onClearAllAudio && (
                  <button
                    onClick={onClearAllAudio}
                    title={t.timeline.clearAllAudioTooltip}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                      e.currentTarget.style.color = '#f87171';
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}

                <button
                  onClick={() => setIsAudioModalOpen(true)}
                  title={t.timeline.addSfxTooltip}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 7px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34d399',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#10b981';
                    e.currentTarget.style.color = '#052e16';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
                    e.currentTarget.style.color = '#34d399';
                  }}
                >
                  <Plus size={11} />
                  <span>{t.timeline.addAudioLabel}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Scrollable Ruler & Tracks Area */}
        <div
          ref={tracksContainerRef}
          onWheel={handleWheel}
          onScroll={(e) => {
            if (leftHeadersRef.current) {
              leftHeadersRef.current.scrollTop = e.currentTarget.scrollTop;
            }
          }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowX: totalTimelineWidthPx > containerWidth ? 'auto' : 'hidden',
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${totalTimelineWidthPx}px`,
              minWidth: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              flex: 1,
            }}
          >
            {/* The Ruler Bar */}
            <div
              ref={rulerRef}
              onMouseDown={handleRulerMouseDown}
              onMouseMove={handleRulerMouseMove}
              onMouseLeave={handleRulerMouseLeave}
              style={{
                height: '26px',
                backgroundColor: '#121216',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                position: 'sticky',
                top: 0,
                cursor: 'pointer',
                zIndex: 29,
                flexShrink: 0,
              }}
            >
              {/* Second tick marks */}
              {secondTicks.map(({ second, leftPx }) => (
                <div
                  key={second}
                  style={{
                    position: 'absolute',
                    left: `${leftPx}px`,
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    pointerEvents: 'none',
                  }}
                >
                  {/* Major tick mark */}
                  <div
                    style={{
                      width: '1px',
                      height: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      position: 'absolute',
                      bottom: 0,
                    }}
                  />
                  {/* Second label */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: '4px',
                      fontSize: '9.5px',
                      fontFamily: 'monospace',
                      color: '#71717a',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {second}s
                  </span>
                </div>
              ))}

              {/* Comp End Marker on Ruler */}
              {compBoundaryPx < totalTimelineWidthPx && (
                <div
                  title={format(t.timeline.endOfCompTooltip, { frames: durationInFrames })}
                  style={{
                    position: 'absolute',
                    left: `${compBoundaryPx}px`,
                    top: '2px',
                    transform: 'translateX(-50%)',
                    fontSize: '9px',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(249, 115, 22, 0.15)',
                    border: '1px solid rgba(249, 115, 22, 0.35)',
                    color: '#fb923c',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 26,
                  }}
                >
                  {compBoundaryPx > 130 ? format(t.timeline.endOfCompBoundary, { frames: durationInFrames }) : `${durationInFrames}F`}
                </div>
              )}

              {/* Pinned Frame Diamond on Ruler */}
              {pinnedFrame && (
                <div
                  title={format(t.timeline.pinnedFrameMarkerTooltip, { frame: pinnedFrame.frame })}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(pinnedFrame.frame);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${pinnedFrame.frame * pixelsPerFrame}px`,
                    top: '4px',
                    transform: 'translateX(-50%)',
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#fb923c',
                    borderRadius: '2px',
                    rotate: '45deg',
                    boxShadow: '0 0 10px #f97316',
                    cursor: 'pointer',
                    zIndex: 25,
                  }}
                />
              )}

              {/* Hover Ghost Indicator */}
              {hoverFrame !== null && !isDragging && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${hoverFrame * pixelsPerFrame}px`,
                    top: 0,
                    bottom: `-${totalTracksHeight - 26}px`,
                    width: '1px',
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    pointerEvents: 'none',
                    zIndex: 28,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '2px',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#18181c',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      padding: '1px 5px',
                      fontSize: '9px',
                      color: '#e4e4e7',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    F{hoverFrame}
                  </div>
                </div>
              )}
            </div>

            {/* Vertical Comp Boundary line across all tracks */}
            {compBoundaryPx < totalTimelineWidthPx && (
              <div
                style={{
                  position: 'absolute',
                  left: `${compBoundaryPx}px`,
                  top: 0,
                  bottom: 0,
                  width: '1px',
                  borderLeft: '1px dashed rgba(249, 115, 22, 0.45)',
                  zIndex: 27,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Dimmed Out-of-bounds area for tracks */}
            {compBoundaryPx < totalTimelineWidthPx && (
              <div
                style={{
                  position: 'absolute',
                  left: `${compBoundaryPx}px`,
                  width: `${totalTimelineWidthPx - compBoundaryPx}px`,
                  top: '26px',
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255, 255, 255, 0.015) 10px, rgba(255, 255, 255, 0.015) 20px)',
                  pointerEvents: 'none',
                  zIndex: 6,
                }}
              />
            )}

            {/* Magnetic Snap Guide Line */}
            {snapGuideFrame !== null && (
              <div
                style={{
                  position: 'absolute',
                  left: `${snapGuideFrame * pixelsPerFrame}px`,
                  top: 0,
                  bottom: 0,
                  width: '1.5px',
                  backgroundColor: '#38bdf8',
                  boxShadow: '0 0 10px #38bdf8',
                  zIndex: 40,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: '-16px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontFamily: 'monospace',
                    padding: '1px 5px',
                    borderRadius: '3px',
                  }}
                >
                  {snapGuideFrame}F
                </div>
              </div>
            )}

            {/* Track 1: Shots / Rhythm Beats Lane */}
            <div
              onMouseDown={handleRulerMouseDown}
              onMouseMove={handleRulerMouseMove}
              style={{
                height: `${trackShotsHeight}px`,
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                position: 'relative',
                cursor: 'pointer',
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            >
              {sceneData?.shots && sceneData.shots.length > 0 ? (() => {
                const sortedShots = [...sceneData.shots].sort((a, b) => (a.startFrame ?? 0) - (b.startFrame ?? 0));
                return sortedShots.map((shot, idx) => {
                  const nextShot = sortedShots[idx + 1];
                  const maxAllowedDuration = nextShot && typeof nextShot.startFrame === 'number' && nextShot.startFrame > shot.startFrame
                    ? nextShot.startFrame - shot.startFrame
                    : shot.durationInFrames;
                  const displayDuration = Math.min(shot.durationInFrames, maxAllowedDuration);
                  const leftPx = shot.startFrame * pixelsPerFrame;
                  const widthPx = Math.max(28, displayDuration * pixelsPerFrame);
                  const shotColor = shot.color || '#38bdf8';
                  return (
                    <div
                      key={shot.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeek(shot.startFrame);
                      }}
                      title={format(t.timeline.shotTooltip, {
                        num: shot.number,
                        name: shot.name,
                        start: shot.startFrame,
                        end: shot.startFrame + shot.durationInFrames,
                      })}
                      style={{
                        position: 'absolute',
                        left: `${leftPx}px`,
                        top: '3px',
                        width: `${widthPx}px`,
                        height: '22px',
                        borderRadius: '4px',
                        backgroundColor: '#121218',
                        backgroundImage: `linear-gradient(90deg, ${shotColor}35 0%, ${shotColor}18 100%)`,
                        border: `1px solid ${shotColor}55`,
                        borderLeft: `3px solid ${shotColor}`,
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 6px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        zIndex: 12 + idx,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            color: shotColor,
                            backgroundColor: `${shotColor}25`,
                            padding: '0 4px',
                            borderRadius: '3px',
                            fontFamily: 'monospace',
                            flexShrink: 0,
                          }}
                        >
                          #{shot.number}
                        </span>
                        {widthPx >= 65 && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              color: '#f4f4f5',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {shot.name}
                          </span>
                        )}
                      </div>
                      {widthPx >= 95 && (
                        <span style={{ fontSize: '8.5px', color: '#a1a1aa', fontFamily: 'monospace', flexShrink: 0, marginLeft: '6px' }}>
                          {displayDuration}F
                        </span>
                      )}
                    </div>
                  );
                });
              })() : (
                <div
                  style={{
                    width: `${Math.max(16, compBoundaryPx - 12)}px`,
                    height: '22px',
                    margin: '3px 6px',
                    borderRadius: '4px',
                    background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.22) 0%, rgba(56, 189, 248, 0.1) 100%)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                  }}
                >
                  <span style={{ fontSize: '10px', color: '#f4f4f5' }}>{t.timeline.mainSceneLabel}</span>
                </div>
              )}
            </div>

            {/* Multi-Track Text Lanes */}
            {textTrackIndices.map((tIdx: number) => {
              const itemsOnTrack = textTracksMap.get(tIdx) || [];
              return (
                <div
                  key={`text-track-lane-${tIdx}`}
                  onMouseDown={handleRulerMouseDown}
                  onMouseMove={handleRulerMouseMove}
                  style={{
                    height: '28px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    position: 'relative',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                    backgroundColor: tIdx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                  }}
                >
                  {itemsOnTrack.map((textItem: TextElementData) => {
                    const isDraggingThis = draggingElement?.id === textItem.id;
                    const currentStart = isDraggingThis && draggingElement ? draggingElement.currentStartFrame : textItem.startFrame;
                    const effectiveDur = textItem.holdToEnd
                      ? Math.max(1, durationInFrames - currentStart)
                      : (isDraggingThis && draggingElement ? draggingElement.currentDuration : textItem.durationInFrames);

                    const leftPx = currentStart * pixelsPerFrame;
                    const widthPx = Math.max(34, effectiveDur * pixelsPerFrame);
                    const isDeleted = Boolean(textItem.isDeleted);
                    const isSelected = selectedElementId === textItem.id;
                    const itemColor = textItem.color || '#38bdf8';

                    return (
                      <div
                        key={textItem.id}
                        title={language === 'ar' ? `انقر للتحديد، انقر نقراً مزدوجاً أو كليك يمين للتعديل: "${textItem.text}" (${textItem.fontSize}px)` : `Click to select, double-click or right-click to edit: "${textItem.text}" (${textItem.fontSize}px)`}
                        style={{
                          position: 'absolute',
                          left: `${leftPx}px`,
                          top: '3px',
                          width: `${widthPx}px`,
                          height: '22px',
                          borderRadius: '4px',
                          backgroundColor: isDeleted
                            ? 'rgba(239, 68, 68, 0.08)'
                            : isSelected
                            ? 'rgba(56, 189, 248, 0.22)'
                            : '#15151c',
                          border: isDeleted
                            ? '1px dashed rgba(239, 68, 68, 0.45)'
                            : `1px solid ${isSelected ? itemColor : 'rgba(56, 189, 248, 0.3)'}`,
                          borderLeft: isDeleted ? '3px solid #ef4444' : `3px solid ${itemColor}`,
                          boxShadow: isSelected ? `0 0 12px ${itemColor}55` : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                          zIndex: isDraggingThis ? 25 : isSelected ? 16 : 14,
                          overflow: 'hidden',
                          userSelect: 'none',
                          transition: isDraggingThis ? 'none' : 'border 0.12s ease',
                        }}
                      >
                        {/* Left Trim Handle */}
                        <div
                          onMouseDown={(e) => handleElementMouseDown(e, 'text', textItem, 'trim-left')}
                          title={t.timeline.dragResizeStartTooltip}
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '6px',
                            cursor: 'ew-resize',
                            zIndex: 5,
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          }}
                        />

                        {/* Center Drag & Click Body */}
                        <div
                          onMouseDown={(e) => handleElementMouseDown(e, 'text', textItem, 'move')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTextElement(textItem);
                            onSelectElement?.(textItem.id);
                            setContextMenu(null);
                            onSeek(textItem.startFrame);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setSelectedTextElement(textItem);
                            onSelectElement?.(textItem.id);
                            setContextMenu(null);
                            onOpenTextInspector?.(textItem);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedTextElement(textItem);
                            onSelectElement?.(textItem.id);
                            const menuWidth = 240;
                            const menuHeight = 250;
                            const posX =
                              e.clientX + menuWidth > window.innerWidth ? Math.max(12, e.clientX - menuWidth) : e.clientX;
                            const posY =
                              e.clientY + menuHeight > window.innerHeight ? Math.max(12, e.clientY - menuHeight) : e.clientY;
                            setContextMenu({
                              visible: true,
                              x: posX,
                              y: posY,
                              element: textItem,
                            });
                          }}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 8px',
                            overflow: 'hidden',
                            minWidth: 0,
                            cursor: isDraggingThis ? 'grabbing' : 'grab',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                            <Type size={10} color={isDeleted ? '#ef4444' : itemColor} style={{ flexShrink: 0 }} />
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: isDeleted ? '#71717a' : '#f4f4f5',
                                textDecoration: isDeleted ? 'line-through' : 'none',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {isDeleted ? `${t.timeline.deletedItemPrefix} ${textItem.text}` : textItem.text}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            {textItem.holdToEnd && (
                              <span
                                title={t.timeline.holdsToEndTooltip}
                                style={{
                                  fontSize: '8px',
                                  color: '#38bdf8',
                                  backgroundColor: 'rgba(56, 189, 248, 0.2)',
                                  border: '1px solid rgba(56, 189, 248, 0.4)',
                                  padding: '0 3px',
                                  borderRadius: '2px',
                                  fontFamily: 'monospace',
                                }}
                              >
                                END
                              </span>
                            )}
                            {widthPx >= 65 && (
                              <span
                                style={{
                                  fontSize: '8.5px',
                                  color: isDeleted ? '#71717a' : itemColor,
                                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                  padding: '1px 3px',
                                  borderRadius: '3px',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {textItem.fontSize}px
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Trim Handle */}
                        <div
                          onMouseDown={(e) => handleElementMouseDown(e, 'text', textItem, 'trim-right')}
                          title={t.timeline.dragResizeEndTooltip}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '6px',
                            cursor: 'ew-resize',
                            zIndex: 5,
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Multi-Track Card Lanes */}
            {cardTrackIndices.map((cIdx: number) => {
              const cardsOnTrack = cardTracksMap.get(cIdx) || [];
              return (
                <div
                  key={`card-track-lane-${cIdx}`}
                  onMouseDown={handleRulerMouseDown}
                  onMouseMove={handleRulerMouseMove}
                  style={{
                    height: '28px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    position: 'relative',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                    backgroundColor: cIdx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                  }}
                >
                  {cardsOnTrack.map((card: CardElementData) => {
                    const isDraggingThis = draggingElement?.id === card.id;
                    const currentStart = isDraggingThis && draggingElement ? draggingElement.currentStartFrame : card.startFrame;
                    const effectiveDur = card.holdToEnd
                      ? Math.max(1, durationInFrames - currentStart)
                      : (isDraggingThis && draggingElement ? draggingElement.currentDuration : card.durationInFrames);

                    const leftPx = currentStart * pixelsPerFrame;
                    const widthPx = Math.max(34, effectiveDur * pixelsPerFrame);
                    const isSelected = selectedElementId === card.id;

                    return (
                      <div
                        key={card.id}
                        title={language === 'ar' ? `بطاقة / عنصر جرافيك: ${card.name} (الإطار ${card.startFrame})` : `Graphic Card: ${card.name} (Frame ${card.startFrame})`}
                        style={{
                          position: 'absolute',
                          left: `${leftPx}px`,
                          top: '3px',
                          width: `${widthPx}px`,
                          height: '22px',
                          borderRadius: '4px',
                          background: isSelected
                            ? 'rgba(56, 189, 248, 0.22)'
                            : 'linear-gradient(90deg, rgba(168, 85, 247, 0.22) 0%, rgba(168, 85, 247, 0.1) 100%)',
                          border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(168, 85, 247, 0.35)',
                          borderLeft: isSelected ? '3px solid #38bdf8' : '3px solid #a855f7',
                          boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.5)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          zIndex: isDraggingThis ? 25 : isSelected ? 16 : 13,
                          overflow: 'hidden',
                          userSelect: 'none',
                        }}
                      >
                        {/* Left Trim Handle */}
                        <div
                          onMouseDown={(e) => handleElementMouseDown(e, 'card', card, 'trim-left')}
                          title={t.timeline.dragResizeStartTooltip}
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '6px',
                            cursor: 'ew-resize',
                            zIndex: 5,
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          }}
                        />

                        {/* Center Drag & Click Body */}
                        <div
                          onMouseDown={(e) => handleElementMouseDown(e, 'card', card, 'move')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTextElement(null);
                            onSelectElement?.(card.id);
                            onSeek(card.startFrame);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            onSelectElement?.(card.id);
                            const matchedText = (sceneData?.texts || []).find(
                              (t) => t.parentId === card.id || t.id === card.id || (card.id === 'card_cta_button' && t.id === 'txt_cta_title')
                            );
                            if (matchedText) {
                              setSelectedTextElement(matchedText);
                              onOpenTextInspector?.(matchedText);
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelectElement?.(card.id);
                            const matchedText = (sceneData?.texts || []).find(
                              (t) => t.parentId === card.id || t.id === card.id || (card.id === 'card_cta_button' && t.id === 'txt_cta_title')
                            );
                            if (matchedText) {
                              const menuWidth = 240;
                              const menuHeight = 250;
                              const posX =
                                e.clientX + menuWidth > window.innerWidth ? Math.max(12, e.clientX - menuWidth) : e.clientX;
                              const posY =
                                e.clientY + menuHeight > window.innerHeight ? Math.max(12, e.clientY - menuHeight) : e.clientY;
                              setContextMenu({
                                visible: true,
                                x: posX,
                                y: posY,
                                element: matchedText,
                              });
                            }
                          }}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 8px',
                            overflow: 'hidden',
                            minWidth: 0,
                            cursor: isDraggingThis ? 'grabbing' : 'grab',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                            <LayoutGrid size={11} color="#a855f7" style={{ flexShrink: 0 }} />
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: '#f4f4f5',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {card.name}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            {card.holdToEnd && (
                              <span
                                title={t.timeline.holdsToEndTooltip}
                                style={{
                                  fontSize: '8px',
                                  color: '#c084fc',
                                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                                  border: '1px solid rgba(168, 85, 247, 0.4)',
                                  padding: '0 3px',
                                  borderRadius: '2px',
                                  fontFamily: 'monospace',
                                }}
                              >
                                END
                              </span>
                            )}
                            {widthPx >= 80 && (
                              <span style={{ fontSize: '8.5px', color: '#71717a', fontFamily: 'monospace', flexShrink: 0 }}>
                                {card.durationInFrames}F
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Trim Handle */}
                        <div
                          onMouseDown={(e) => handleElementMouseDown(e, 'card', card, 'trim-right')}
                          title={t.timeline.dragResizeEndTooltip}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '6px',
                            cursor: 'ew-resize',
                            zIndex: 5,
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Track 4: Audio Clips & Sound Manager (Only rendered when audio is present) */}
            {hasAudio && (
              <div
                onMouseDown={handleRulerMouseDown}
                onMouseMove={handleRulerMouseMove}
                style={{
                  height: `${trackAudioHeight}px`,
                  position: 'relative',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
              >
                {/* Sub-lane horizontal guidelines if multiple audio lanes */}
                {audioLanes.totalLanes > 1 &&
                  Array.from({ length: audioLanes.totalLanes - 1 }).map((_, idx) => (
                    <div
                      key={`audio-divider-${idx}`}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: `${(idx + 1) * 42 + 3}px`,
                        height: '1px',
                        borderBottom: '1px dashed rgba(255, 255, 255, 0.04)',
                        pointerEvents: 'none',
                      }}
                    />
                  ))}

                {/* Real Audio Clips on Track */}
                {audioClips.map((clip) => {
                  const leftPx = clip.startFrame * pixelsPerFrame;
                  const widthPx = Math.max(28, clip.durationInFrames * pixelsPerFrame);
                  const isSelected = selectedClipId === clip.id;
                  const isOverflowing = clip.startFrame + clip.durationInFrames > durationInFrames;
                  const lane = audioLanes.itemToLane.get(clip.id) || 0;
                  const topPx = lane * 42 + 4;

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                        setDraggingClip({
                          id: clip.id,
                          mode: 'move',
                          startX: e.clientX,
                          initialStartFrame: clip.startFrame,
                          initialDuration: clip.durationInFrames,
                        });
                      }}
                      style={{
                        position: 'absolute',
                        left: `${leftPx}px`,
                        top: `${topPx}px`,
                        width: `${widthPx}px`,
                        height: '36px',
                        borderRadius: '6px',
                        backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.09)' : '#18181c',
                        border: `1px solid ${isSelected ? '#f97316' : 'rgba(255, 255, 255, 0.12)'}`,
                        borderLeft: `3px solid ${isSelected ? '#f97316' : '#10b981'}`,
                        boxShadow: isSelected ? '0 0 12px rgba(249, 115, 22, 0.25)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 8px',
                        cursor: draggingClip?.id === clip.id ? 'grabbing' : 'grab',
                        zIndex: 22,
                        overflow: 'hidden',
                        userSelect: 'none',
                        transition: draggingClip?.id === clip.id ? 'none' : 'border 0.15s ease',
                      }}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggingClip({
                            id: clip.id,
                            mode: 'trim-left',
                            startX: e.clientX,
                            initialStartFrame: clip.startFrame,
                            initialDuration: clip.durationInFrames,
                          });
                        }}
                        title={t.timeline.adjustAudioStartTooltip}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.25)',
                          cursor: 'ew-resize',
                          zIndex: 25,
                        }}
                      />

                      {/* Clip Title & Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                        <Volume2 size={12} color={isSelected ? '#f97316' : '#10b981'} style={{ flexShrink: 0 }} />
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#f4f4f5',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {clip.name}
                        </span>
                        {widthPx >= 160 && (
                          <span style={{ fontSize: '9.5px', color: '#71717a', fontFamily: 'monospace', flexShrink: 0 }}>
                            F{clip.startFrame}-{clip.startFrame + clip.durationInFrames}
                          </span>
                        )}
                      </div>

                      {/* Mini Waveform visualization only if wide enough */}
                      {widthPx >= 220 && (
                        <svg width="45" height="12" style={{ opacity: 0.5, flexShrink: 0, margin: '0 4px' }}>
                          <path d="M0 6 Q 6 1, 12 6 T 24 6 T 36 6 T 45 6" stroke="#71717a" strokeWidth="1.2" fill="none" />
                          <path d="M0 6 Q 6 11, 12 6 T 24 6 T 36 6 T 45 6" stroke="#71717a" strokeWidth="1.2" fill="none" />
                        </svg>
                      )}

                      {/* Quick Trim Action if overflowing scene */}
                      {isOverflowing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTrimClipToComp(clip.id);
                          }}
                          title={t.timeline.trimAudioToCompTooltip}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#d4d4d8',
                            cursor: 'pointer',
                            flexShrink: 0,
                            padding: 0,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.color = '#d4d4d8';
                          }}
                        >
                          <Scissors size={11} />
                        </button>
                      )}

                      {/* Clip Actions: Mute & Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateAudioClip?.(clip.id, { isMuted: !clip.isMuted });
                          }}
                          title={clip.isMuted ? t.timeline.unmuteAudioTooltip : t.timeline.muteAudioTooltip}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: clip.isMuted ? '#ef4444' : '#a1a1aa',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {clip.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAudioClip?.(clip.id);
                          }}
                          title={t.timeline.deleteClipTooltip}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#f87171',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Right Trim Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggingClip({
                            id: clip.id,
                            mode: 'trim-right',
                            startX: e.clientX,
                            initialStartFrame: clip.startFrame,
                            initialDuration: clip.durationInFrames,
                          });
                        }}
                        title={t.timeline.adjustAudioEndTooltip}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '7px',
                          backgroundColor: 'rgba(255, 255, 255, 0.25)',
                          cursor: 'ew-resize',
                          zIndex: 25,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. The Playhead (Scrubber) */}
            <div
              style={{
                position: 'absolute',
                left: `${currentFrame * pixelsPerFrame}px`,
                top: 0,
                bottom: 0,
                width: '2px',
                backgroundColor: '#f97316',
                boxShadow: '0 0 10px rgba(249, 115, 22, 0.8), 0 0 2px #f97316',
                zIndex: 35,
                pointerEvents: 'none',
              }}
            >
              {/* Playhead Top Inverted Pentagon Head */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '14px',
                  height: '14px',
                  backgroundColor: '#f97316',
                  clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)',
                  boxShadow: '0 2px 8px rgba(249, 115, 22, 0.6)',
                }}
              />

              {/* Live Tooltip when dragging */}
              {isDragging && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#18181c',
                    border: '1px solid #f97316',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#fb923c',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
                  }}
                >
                  {currentTimecode} (F{currentFrame})
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Audio Library Modal */}
      <AudioLibraryModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        currentFrame={currentFrame}
        onInsertAudioClip={(clip) => {
          onAddAudioClip?.(clip);
        }}
      />

      {/* Floating Right-Click Context Menu */}
      {contextMenu && contextMenu.visible && (
        <div
          ref={contextMenuRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            width: '230px',
            backgroundColor: '#16161c',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '12px',
            boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.85), 0 0 1px rgba(255, 255, 255, 0.2)',
            zIndex: 9999,
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            backdropFilter: 'blur(12px)',
            direction: 'rtl',
          }}
        >
          {/* Header with element preview */}
          <div
            style={{
              padding: '6px 10px 8px 10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '4px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontFamily: 'monospace',
                color: '#38bdf8',
                direction: 'ltr',
                textAlign: 'left',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              #{contextMenu.element.id}
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#f4f4f5',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '2px',
              }}
            >
              {contextMenu.element.text}
            </div>
          </div>

          {/* Action 1: Edit text & appearance */}
          <button
            onClick={() => {
              setSelectedTextElement(contextMenu.element);
              onOpenTextInspector?.(contextMenu.element);
              setContextMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#e4e4e7',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={14} color="#38bdf8" />
              <span>{t.timeline.editTextAndStyle}</span>
            </div>
            <span style={{ fontSize: '10px', color: '#71717a' }}>Edit</span>
          </button>

          {/* Action 2: Seek to start frame */}
          <button
            onClick={() => {
              onSeek(contextMenu.element.startFrame);
              setContextMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#e4e4e7',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SkipBack size={14} color="#a1a1aa" />
              <span>{t.timeline.jumpToStart}</span>
            </div>
            <span style={{ fontSize: '10px', color: '#71717a', fontFamily: 'monospace' }}>
              F{contextMenu.element.startFrame}
            </span>
          </button>

          {/* Action 3: Copy Text */}
          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(contextMenu.element.text);
              }
              setCopyFeedback(contextMenu.element.id);
              setTimeout(() => {
                setCopyFeedback(null);
                setContextMenu(null);
              }, 400);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#e4e4e7',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {copyFeedback === contextMenu.element.id ? (
                <Check size={14} color="#34d399" />
              ) : (
                <Copy size={14} color="#a1a1aa" />
              )}
              <span>{copyFeedback === contextMenu.element.id ? t.timeline.textCopied : t.timeline.copyText}</span>
            </div>
            <span style={{ fontSize: '10px', color: '#71717a' }}>Copy</span>
          </button>

          {/* Action 4: Toggle Hold to End */}
          <button
            onClick={async () => {
              const isHold = !contextMenu.element.holdToEnd;
              const elId = contextMenu.element.id;
              setContextMenu(null);
              if (onUpdateElementTiming) {
                await onUpdateElementTiming({
                  kind: 'text',
                  id: elId,
                  holdToEnd: isHold,
                });
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#e4e4e7',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightToLine size={14} color="#38bdf8" />
              <span>{contextMenu.element.holdToEnd ? t.timeline.unextendHold : t.timeline.extendHold}</span>
            </div>
            <span style={{ fontSize: '10px', color: '#71717a' }}>
              {contextMenu.element.holdToEnd ? 'Unpin' : 'Hold'}
            </span>
          </button>

          <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '3px 0' }} />

          {/* Action: Split Element at Playhead */}
          {onSplitElement && (
            <button
              onClick={async () => {
                const target = contextMenu.element;
                setContextMenu(null);
                const dur = getEffectiveDuration(target, durationInFrames);
                if (currentFrame <= target.startFrame || currentFrame >= target.startFrame + dur) {
                  setTrackConflictError(format(t.timeline.splitOutOfRange, { frame: currentFrame, start: target.startFrame, end: target.startFrame + dur }));
                  setTimeout(() => setTrackConflictError(null), 3500);
                  return;
                }
                const res = await onSplitElement('text', target.id, currentFrame);
                if (res && res.success) {
                  if (res.rightPieceId) {
                    onSelectElement?.(res.rightPieceId);
                  }
                  setSplitFeedback(format(t.timeline.splitFeedbackElement, { frame: currentFrame }));
                  setTimeout(() => setSplitFeedback(null), 3000);
                } else if (res && res.error) {
                  setTrackConflictError(res.error);
                  setTimeout(() => setTrackConflictError(null), 3000);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: '7px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#f59e0b',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scissors size={14} color="#f59e0b" />
                <span>{t.timeline.splitAtPlayhead}</span>
              </div>
              <span style={{ fontSize: '10px', color: '#71717a' }}>Ctrl+B / S</span>
            </button>
          )}

          {/* Action 5: Toggle Delete / Restore */}
          <button
            onClick={async () => {
              const updated = {
                id: contextMenu.element.id,
                text: contextMenu.element.text,
                fontSize: contextMenu.element.fontSize,
                color: contextMenu.element.color,
                isDeleted: !contextMenu.element.isDeleted,
              };
              setContextMenu(null);
              await onUpdateTextElement?.(updated);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: 'transparent',
              color: contextMenu.element.isDeleted ? '#34d399' : '#f87171',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = contextMenu.element.isDeleted
                ? 'rgba(52, 211, 153, 0.15)'
                : 'rgba(239, 68, 68, 0.15)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {contextMenu.element.isDeleted ? (
                <RotateCcw size={14} color="#34d399" />
              ) : (
                <Trash2 size={14} color="#f87171" />
              )}
              <span>{contextMenu.element.isDeleted ? t.timeline.restoreText : t.timeline.hideText}</span>
            </div>
            <span style={{ fontSize: '10px', color: contextMenu.element.isDeleted ? '#34d399' : '#f87171' }}>
              {contextMenu.element.isDeleted ? 'Restore' : 'Delete'}
            </span>
          </button>
        </div>
      )}

      {/* Split Feedback Toast Notification */}
      {splitFeedback && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        >
          {splitFeedback}
        </div>
      )}

      {/* Track Conflict Toast Notification */}
      {trackConflictError && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        >
          {trackConflictError}
        </div>
      )}
    </div>
  );
};
