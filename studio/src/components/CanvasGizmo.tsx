import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, AlignCenter, Trash2, X, Move, Compass, Edit3 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  ElementTransform,
  DEFAULT_TRANSFORM,
  SceneData,
  TextElementData,
  CardElementData,
} from '../types/sceneData';
import {
  screenDeltaToPercent,
  clampTransform,
  scaleFromCorner,
  angleFromCenter,
  computeSnap,
} from '../utils/canvasTransform';

export interface CanvasGizmoProps {
  containerRef: React.RefObject<HTMLDivElement>;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  sceneData?: SceneData | null;
  onLiveOverride: (override: { id: string; transform: ElementTransform } | null) => void;
  onCommitTransform: (payload: {
    kind: 'text' | 'card';
    id: string;
    transform: ElementTransform;
  }) => Promise<boolean | void>;
  onDeleteElement?: (kind: 'text' | 'card', id: string) => Promise<boolean | void>;
  onOpenTextInspector?: (element: TextElementData) => void;
  onTogglePlayPause?: () => void;
  enabled?: boolean;
}

interface BoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
}

type DragMode =
  | 'move'
  | 'rotate'
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-se'
  | 'resize-sw'
  | 'resize-n'
  | 'resize-s'
  | 'resize-e'
  | 'resize-w';

interface DragSession {
  mode: DragMode;
  targetId: string;
  kind: 'text' | 'card';
  startPointer: { x: number; y: number };
  startTransform: ElementTransform;
  currentTransform: ElementTransform;
  elementCenter: { x: number; y: number };
  containerRect: DOMRect;
  domElement: HTMLElement | null;
  hasDragged?: boolean;
}

export const CanvasGizmo: React.FC<CanvasGizmoProps> = ({
  containerRef,
  selectedElementId,
  onSelectElement,
  sceneData,
  onLiveOverride,
  onCommitTransform,
  onDeleteElement,
  onOpenTextInspector,
  onTogglePlayPause,
  enabled = true,
}) => {
  const { t } = useLanguage();
  const [selectedBox, setSelectedBox] = useState<BoxRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
  });
  const [hoveredBox, setHoveredBox] = useState<BoxRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const [activeDragMode, setActiveDragMode] = useState<DragMode | null>(null);
  const [activeGuides, setActiveGuides] = useState<Array<{ type: 'x' | 'y'; positionPercent: number }>>([]);

  const dragSessionRef = useRef<DragSession | null>(null);
  const arrowDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentLiveTransformRef = useRef<ElementTransform | null>(null);

  // Find element metadata from sceneData
  const activeElementInfo = React.useMemo(() => {
    if (!selectedElementId || !sceneData) return null;
    const textItem = sceneData.texts?.find((t) => t.id === selectedElementId);
    if (textItem) {
      return { kind: 'text' as const, item: textItem, name: textItem.text || textItem.id };
    }
    const cardItem = sceneData.cards?.find((c) => c.id === selectedElementId);
    if (cardItem) {
      return { kind: 'card' as const, item: cardItem, name: cardItem.name || cardItem.id };
    }
    return null;
  }, [selectedElementId, sceneData]);

  // Current transform resolved from element data or live override
  const currentTransform: ElementTransform =
    currentLiveTransformRef.current ||
    (activeElementInfo?.item?.transform ? { ...activeElementInfo.item.transform } : { ...DEFAULT_TRANSFORM });

  // Multi-tier DOM element resolver by element ID
  const resolveElementById = useCallback(
    (id: string | null): HTMLElement | null => {
      if (!id) return null;
      const container = containerRef.current;
      if (!container) return null;

      // 1. Direct match on data-scene-id
      let el = container.querySelector(`[data-scene-id="${id}"]`) as HTMLElement | null;
      if (el && container.contains(el)) return el;

      // 2. Direct match on data-id or HTML id
      el = container.querySelector(`[data-id="${id}"], #${id}`) as HTMLElement | null;
      if (el && container.contains(el)) {
        el.setAttribute('data-scene-id', id);
        return el;
      }

      // 3. Fallback: Search by text content in sceneData.texts
      const textItem = sceneData?.texts?.find((t) => t.id === id);
      if (textItem && textItem.text) {
        const targetText = textItem.text.trim();
        const allCandidates = Array.from(container.querySelectorAll('*')) as HTMLElement[];

        // Pass 3a: Exact trimmed match
        for (const candidate of allCandidates) {
          if (candidate.getAttribute('data-gizmo-ui') === 'true') continue;
          const cText = (candidate.innerText || candidate.textContent || '').trim();
          if (cText === targetText) {
            candidate.setAttribute('data-scene-id', id);
            return candidate;
          }
        }

        // Pass 3b: Candidate contains targetText, pick deepest child
        let deepestCandidate: HTMLElement | null = null;
        let minChildCount = Infinity;
        for (const candidate of allCandidates) {
          if (candidate.getAttribute('data-gizmo-ui') === 'true') continue;
          const cText = (candidate.innerText || candidate.textContent || '').trim();
          if (cText && cText.includes(targetText)) {
            const childCount = candidate.querySelectorAll('*').length;
            if (childCount < minChildCount) {
              minChildCount = childCount;
              deepestCandidate = candidate;
            }
          }
        }
        if (deepestCandidate) {
          deepestCandidate.setAttribute('data-scene-id', id);
          return deepestCandidate;
        }

        // Pass 3c: Normalized whitespace match
        const normalizedTarget = targetText.replace(/\s+/g, ' ');
        for (const candidate of allCandidates) {
          if (candidate.getAttribute('data-gizmo-ui') === 'true') continue;
          const cText = (candidate.textContent || '').trim().replace(/\s+/g, ' ');
          if (cText === normalizedTarget && normalizedTarget.length > 3) {
            candidate.setAttribute('data-scene-id', id);
            return candidate;
          }
        }
      }

      // 4. Fallback: Search by card media in sceneData.cards
      const cardItem = sceneData?.cards?.find((c) => c.id === id);
      if (cardItem) {
        const mediaEls = Array.from(container.querySelectorAll('img, video, [data-card]')) as HTMLElement[];
        for (const media of mediaEls) {
          if (media.getAttribute('data-gizmo-ui') === 'true') continue;
          const src = media.getAttribute('src') || '';
          if (cardItem.src && src.includes(cardItem.src)) {
            media.setAttribute('data-scene-id', id);
            return media;
          }
        }

        // Check background image
        const allDivs = Array.from(container.querySelectorAll('div')) as HTMLElement[];
        for (const div of allDivs) {
          if (div.getAttribute('data-gizmo-ui') === 'true') continue;
          const bg = div.style.backgroundImage || '';
          if (cardItem.src && bg.includes(cardItem.src)) {
            div.setAttribute('data-scene-id', id);
            return div;
          }
        }
      }

      return null;
    },
    [containerRef, sceneData]
  );

  // Helper to resolve the true visual DOM element representing a scene element
  const findVisualElement = useCallback((el: HTMLElement): HTMLElement => {
    if (!el) return el;

    // 1. Direct visual elements that never wrap something else
    if (['IMG', 'VIDEO', 'BUTTON', 'INPUT'].includes(el.tagName)) {
      return el;
    }

    // 2. Look for media inside (images, videos, cards)
    const mediaChild = el.querySelector('img, video, [data-card]') as HTMLElement | null;
    if (mediaChild) {
      // If there is an explicit card container inside el
      const cardContainer = mediaChild.closest('[data-card]') as HTMLElement | null;
      if (cardContainer && el.contains(cardContainer) && cardContainer !== el) {
        const r = cardContainer.getBoundingClientRect();
        if (r.width > 10 && r.height > 10) return cardContainer;
      }

      // Traverse upwards from media to find the container that defines the visual card bounds
      let curr: HTMLElement | null = mediaChild;
      let bestContainer: HTMLElement = mediaChild;
      while (curr && curr !== el) {
        const r = curr.getBoundingClientRect();
        if (r.width > 20 && r.height > 20) {
          const cs = window.getComputedStyle(curr);
          if (
            cs.overflow === 'hidden' ||
            (cs.borderRadius && cs.borderRadius !== '0px') ||
            (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') ||
            (cs.boxShadow && cs.boxShadow !== 'none') ||
            (cs.borderWidth && cs.borderWidth !== '0px')
          ) {
            bestContainer = curr;
            break;
          }
          bestContainer = curr;
        }
        curr = curr.parentElement;
      }
      return bestContainer;
    }

    // 3. If wrapper has a single child (common pattern: <SceneItem><InnerVisual/></SceneItem>)
    if (el.childElementCount === 1) {
      const onlyChild = el.firstElementChild as HTMLElement;
      const oRect = onlyChild.getBoundingClientRect();
      if (oRect.width > 10 && oRect.height > 10) {
        if (onlyChild.childElementCount === 1) {
          const grandChild = onlyChild.firstElementChild as HTMLElement;
          const gRect = grandChild.getBoundingClientRect();
          if (gRect.width > 10 && gRect.height > 10) {
            return grandChild;
          }
        }
        return onlyChild;
      }
    }

    return el;
  }, []);

  // Multi-tier element hit-testing at pointer coordinate (X, Y)
  const resolveTargetAtPoint = useCallback(
    (
      clientX: number,
      clientY: number
    ): { id: string; kind: 'text' | 'card'; domElement: HTMLElement } | null => {
      const container = containerRef.current;
      if (!container) return null;

      const elements = document.elementsFromPoint(clientX, clientY);
      if (!elements || elements.length === 0) return null;

      const candidates: Array<{
        id: string;
        kind: 'text' | 'card';
        domElement: HTMLElement;
        area: number;
        depth: number;
      }> = [];

      const seenIds = new Set<string>();

      // 1. First priority: Check for explicit data-scene-id
      let depthIndex = 0;
      for (const rawEl of elements) {
        depthIndex++;
        if (!container.contains(rawEl) || rawEl === container) continue;
        if (rawEl.closest('[data-gizmo-ui="true"]')) continue;

        const tagged = (rawEl.getAttribute('data-scene-id')
          ? rawEl
          : rawEl.closest('[data-scene-id]')) as HTMLElement | null;

        if (tagged && container.contains(tagged)) {
          const sceneId = tagged.getAttribute('data-scene-id');
          if (sceneId && !seenIds.has(sceneId)) {
            seenIds.add(sceneId);
            const textItem = sceneData?.texts?.find((t) => t.id === sceneId);
            const cardItem = sceneData?.cards?.find((c) => c.id === sceneId);

            if ((textItem && !textItem.isDeleted) || (cardItem && !cardItem.isDeleted)) {
              // Ignore invisible or completely transparent elements
              const cs = window.getComputedStyle(tagged);
              if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') {
                continue;
              }

              const visualEl = findVisualElement(tagged);
              const r = visualEl.getBoundingClientRect();
              const area = r.width * r.height;
              if (area < 4) continue;

              const kind = textItem ? 'text' : 'card';
              candidates.push({ id: sceneId, kind, domElement: tagged, area, depth: depthIndex });
            }
          }
        }
      }

      // If explicit scene items were found via data-scene-id, pick the best directly
      if (candidates.length === 0) {
        // 2. Second priority: Match rendered text against sceneData.texts (Exact match only)
        if (sceneData?.texts && sceneData.texts.length > 0) {
          for (const rawEl of elements) {
            if (!container.contains(rawEl) || rawEl === container) continue;
            if (rawEl.closest('[data-gizmo-ui="true"]')) continue;

            let curr: HTMLElement | null = rawEl as HTMLElement;
            while (curr && curr !== container) {
              const content = (curr.innerText || curr.textContent || '').trim();
              if (content.length > 0) {
                const exactText = sceneData.texts.find(
                  (t) => !t.isDeleted && t.text && t.text.trim() === content
                );
                if (exactText && !seenIds.has(exactText.id)) {
                  seenIds.add(exactText.id);
                  curr.setAttribute('data-scene-id', exactText.id);
                  const r = curr.getBoundingClientRect();
                  candidates.push({
                    id: exactText.id,
                    kind: 'text',
                    domElement: curr,
                    area: r.width * r.height,
                    depth: 0,
                  });
                  break;
                }
              }
              curr = curr.parentElement;
            }
          }
        }

        // 3. Third priority: Match images or cards against sceneData.cards
        if (candidates.length === 0 && sceneData?.cards && sceneData.cards.length > 0) {
          for (const rawEl of elements) {
            if (!container.contains(rawEl) || rawEl === container) continue;
            if (rawEl.closest('[data-gizmo-ui="true"]')) continue;

            const src = rawEl.getAttribute('src') || '';
            for (const card of sceneData.cards) {
              if (card.isDeleted || seenIds.has(card.id)) continue;
              if (card.src && src && src.includes(card.src)) {
                seenIds.add(card.id);
                (rawEl as HTMLElement).setAttribute('data-scene-id', card.id);
                const r = (rawEl as HTMLElement).getBoundingClientRect();
                candidates.push({
                  id: card.id,
                  kind: 'card',
                  domElement: rawEl as HTMLElement,
                  area: r.width * r.height,
                  depth: 0,
                });
              }
            }
          }
        }
      }

      if (candidates.length === 0) return null;

      // Hierarchical & Specificity sorting:
      // 1. Direct parent-child hierarchy: nested children ALWAYS take precedence over parent containers!
      // 2. Area specificity: smaller (more specific / leaf) elements come first!
      // 3. Stacking depth: front-most elements in DOM stack come first!
      candidates.sort((a, b) => {
        if (a.domElement !== b.domElement) {
          if (a.domElement.contains(b.domElement)) return 1;
          if (b.domElement.contains(a.domElement)) return -1;
        }
        if (a.area > 0 && b.area > 0 && Math.abs(a.area - b.area) > 40) {
          return a.area - b.area;
        }
        return a.depth - b.depth;
      });

      const best = candidates[0];
      return { id: best.id, kind: best.kind, domElement: best.domElement };
    },
    [containerRef, sceneData, findVisualElement]
  );

  // Measure element bounding rect relative to player container
  const measureElement = useCallback(
    (id: string | null): BoxRect => {
      const container = containerRef.current;
      if (!container || !id) {
        return { left: 0, top: 0, width: 0, height: 0, visible: false };
      }

      const el = resolveElementById(id);
      if (!el) {
        return { left: 0, top: 0, width: 0, height: 0, visible: false };
      }

      const visualEl = findVisualElement(el);
      const cRect = container.getBoundingClientRect();
      const eRect = visualEl.getBoundingClientRect();

      if (eRect.width === 0 || eRect.height === 0) {
        return { left: 0, top: 0, width: 0, height: 0, visible: false };
      }

      return {
        left: eRect.left - cRect.left,
        top: eRect.top - cRect.top,
        width: eRect.width,
        height: eRect.height,
        visible: true,
      };
    },
    [containerRef, resolveElementById, findVisualElement]
  );

  // RAF loop to continuously track element during playback, animations, or timeline seeking
  useEffect(() => {
    if (!enabled) {
      setSelectedBox((b) => (b.visible ? { ...b, visible: false } : b));
      return;
    }

    let animationFrameId: number;
    const updateLoop = () => {
      if (selectedElementId) {
        const box = measureElement(selectedElementId);
        setSelectedBox((prev) => {
          if (
            prev.visible === box.visible &&
            Math.abs(prev.left - box.left) < 0.25 &&
            Math.abs(prev.top - box.top) < 0.25 &&
            Math.abs(prev.width - box.width) < 0.25 &&
            Math.abs(prev.height - box.height) < 0.25
          ) {
            return prev;
          }
          return box;
        });
      } else {
        setSelectedBox((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [selectedElementId, enabled, measureElement]);

  // Track hover box
  useEffect(() => {
    if (!enabled || !hoveredId || hoveredId === selectedElementId || activeDragMode) {
      setHoveredBox((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    const box = measureElement(hoveredId);
    setHoveredBox(box);
  }, [hoveredId, selectedElementId, enabled, activeDragMode, measureElement]);

  // Pointer move across overlay for hover hit-testing
  const handleOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeDragMode || !enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const target = resolveTargetAtPoint(e.clientX, e.clientY);
    const targetId = target ? target.id : null;

    if (targetId !== hoveredId) {
      setHoveredId(targetId);
    }
  };

  // Start interaction when clicking on Gizmo overlay or canvas element
  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.button !== 0) return;

    const container = containerRef.current;
    if (!container) return;

    const target = resolveTargetAtPoint(e.clientX, e.clientY);

    if (target) {
      e.stopPropagation();
      if (target.id !== selectedElementId) {
        onSelectElement(target.id);
      }
      // Start moving this element immediately
      startDrag(e, 'move', target.id, target.kind, target.domElement);
    } else {
      // Empty area click: deselect if selected, or toggle play/pause
      if (selectedElementId) {
        onSelectElement(null);
      } else {
        onTogglePlayPause?.();
      }
    }
  };

  // Start interaction when clicking directly on the selection bounding box
  const handleSelectionBoxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.button !== 0 || !selectedElementId) return;

    // Check what is actually under pointer
    const target = resolveTargetAtPoint(e.clientX, e.clientY);

    if (target && target.id !== selectedElementId) {
      e.stopPropagation();
      onSelectElement(target.id);
      startDrag(e, 'move', target.id, target.kind, target.domElement);
      return;
    }

    if (!target) {
      // Clicked on empty canvas space outside any valid scene element
      e.stopPropagation();
      onSelectElement(null);
      return;
    }

    // Directly drag the currently selected element
    startDrag(e, 'move', selectedElementId, activeElementInfo?.kind);
  };

  // Core drag initialization function
  const startDrag = (
    e: React.PointerEvent<HTMLElement>,
    mode: DragMode,
    targetId: string = selectedElementId || '',
    targetKind?: 'text' | 'card',
    targetDomEl?: HTMLElement | null
  ) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container || !targetId) return;

    const cRect = container.getBoundingClientRect();
    const domEl = targetDomEl || resolveElementById(targetId);
    const box = measureElement(targetId);

    // Look up initial transform synchronously without closure race conditions
    const textItem = sceneData?.texts?.find((t) => t.id === targetId);
    const cardItem = sceneData?.cards?.find((c) => c.id === targetId);
    const kind: 'text' | 'card' = targetKind || (textItem ? 'text' : 'card');
    const item = textItem || cardItem;

    const initialTransform: ElementTransform = item?.transform
      ? { ...item.transform }
      : { ...DEFAULT_TRANSFORM };

    const elementCenter = {
      x: cRect.left + (box.visible ? box.left + box.width / 2 : cRect.width / 2),
      y: cRect.top + (box.visible ? box.top + box.height / 2 : cRect.height / 2),
    };

    dragSessionRef.current = {
      mode,
      targetId,
      kind,
      startPointer: { x: e.clientX, y: e.clientY },
      startTransform: initialTransform,
      currentTransform: { ...initialTransform },
      elementCenter,
      containerRect: cRect,
      domElement: domEl,
      hasDragged: false,
    };

    currentLiveTransformRef.current = { ...initialTransform };
    setActiveDragMode(mode);

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Drag motion handler
  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current;
    if (!session) return;

    e.stopPropagation();

    const {
      mode,
      targetId,
      startPointer,
      startTransform,
      elementCenter,
      containerRect,
      domElement,
    } = session;

    if (mode === 'move') {
      let dx = e.clientX - startPointer.x;
      let dy = e.clientY - startPointer.y;

      // Threshold: Ignore tiny accidental micro-movements (< 3px) so clicking doesn't displace the element
      if (!session.hasDragged) {
        if (Math.hypot(dx, dy) < 3) {
          return;
        }
        session.hasDragged = true;
      }

      // Drag + Shift: Axis locking (horizontal or vertical)
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) {
          dy = 0;
        } else {
          dx = 0;
        }
      }

      const delta = screenDeltaToPercent(dx, dy, containerRect);
      const rawX = startTransform.x + delta.xPercent;
      const rawY = startTransform.y + delta.yPercent;

      let finalX = rawX;
      let finalY = rawY;

      // Smart Snapping to Center (unless Alt is held)
      if (!e.altKey) {
        const snap = computeSnap(
          { x: rawX, y: rawY },
          [
            { type: 'x', value: 0, label: 'Center X' },
            { type: 'y', value: 0, label: 'Center Y' },
          ],
          1.5
        );
        finalX = snap.snappedPos.x;
        finalY = snap.snappedPos.y;
        setActiveGuides(snap.activeGuides);
      } else {
        setActiveGuides([]);
      }

      const nextTransform = clampTransform({
        ...startTransform,
        x: finalX,
        y: finalY,
      });

      session.currentTransform = nextTransform;
      currentLiveTransformRef.current = nextTransform;

      // React live override for Remotion props and timeline sync
      onLiveOverride({ id: targetId, transform: nextTransform });
    } else if (mode === 'rotate') {
      const angle = angleFromCenter(elementCenter, { x: e.clientX, y: e.clientY }, e.shiftKey);
      const nextTransform = clampTransform({
        ...startTransform,
        rotation: angle,
      });

      session.currentTransform = nextTransform;
      currentLiveTransformRef.current = nextTransform;

      onLiveOverride({ id: targetId, transform: nextTransform });
    } else if (mode.startsWith('resize-')) {
      const corner = mode.replace('resize-', '');
      if (['nw', 'ne', 'se', 'sw'].includes(corner)) {
        const nextScale = scaleFromCorner(
          elementCenter,
          startPointer,
          { x: e.clientX, y: e.clientY },
          startTransform.scale
        );
        const nextTransform = clampTransform({
          ...startTransform,
          scale: nextScale,
        });

        session.currentTransform = nextTransform;
        currentLiveTransformRef.current = nextTransform;

        onLiveOverride({ id: targetId, transform: nextTransform });
      } else {
        // Edge resize (proportional scale projection)
        const dX = (e.clientX - startPointer.x) / (containerRect.width || 1);
        const dY = (e.clientY - startPointer.y) / (containerRect.height || 1);
        let factor = 1;
        if (corner === 'e') factor = 1 + dX * 2;
        else if (corner === 'w') factor = 1 - dX * 2;
        else if (corner === 's') factor = 1 + dY * 2;
        else if (corner === 'n') factor = 1 - dY * 2;

        const nextScale = Math.round(Math.min(10, Math.max(0.1, startTransform.scale * factor)) * 1000) / 1000;
        const nextTransform = clampTransform({
          ...startTransform,
          scale: nextScale,
        });

        session.currentTransform = nextTransform;
        currentLiveTransformRef.current = nextTransform;

        onLiveOverride({ id: targetId, transform: nextTransform });
      }
    }
  };

  // Drag completion and commit handler
  const handlePointerUp = async (e?: React.PointerEvent<HTMLElement> | PointerEvent) => {
    const session = dragSessionRef.current;
    if (!session) {
      setActiveDragMode(null);
      setActiveGuides([]);
      return;
    }

    if (e && typeof (e as any).stopPropagation === 'function') {
      (e as any).stopPropagation();
    }

    if (e && 'target' in e && (e.target as HTMLElement)?.releasePointerCapture && 'pointerId' in e) {
      try {
        (e.target as HTMLElement).releasePointerCapture((e as any).pointerId);
      } catch (_) {}
    }

    const { targetId, kind, currentTransform: finalTransform, hasDragged, mode } = session;

    setActiveDragMode(null);
    dragSessionRef.current = null;
    setActiveGuides([]);
    currentLiveTransformRef.current = null;

    // If it was a 'move' session and the user didn't move beyond the 3px threshold,
    // treat it as a pure click/selection without altering position.
    if (mode === 'move' && !hasDragged) {
      onLiveOverride(null);
      return;
    }

    // Clear live override and commit persistent coordinates to server
    onLiveOverride(null);
    await onCommitTransform({
      kind,
      id: targetId,
      transform: finalTransform,
    });
  };

  // Attach global window pointerup/pointercancel listeners during active drag
  // to ensure pointer release is NEVER lost, preventing elements from sticking to the mouse cursor.
  useEffect(() => {
    if (!activeDragMode) return;

    const onWindowPointerMove = (e: PointerEvent) => {
      handlePointerMove(e as unknown as React.PointerEvent<HTMLElement>);
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      handlePointerUp(e);
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [activeDragMode]);

  // Double click handler for text inspection
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeElementInfo) return;
    if (activeElementInfo.kind === 'text') {
      onOpenTextInspector?.(activeElementInfo.item as TextElementData);
    } else {
      const matched = (sceneData?.texts || []).find(
        (t) =>
          t.parentId === selectedElementId ||
          t.id === selectedElementId ||
          (selectedElementId === 'card_cta_button' && t.id === 'txt_cta_title')
      );
      if (matched) {
        onOpenTextInspector?.(matched);
      }
    }
  };

  // Keyboard navigation and shortcuts (arrows, Shift+arrows, Delete, Escape)
  useEffect(() => {
    if (!enabled || !selectedElementId || !activeElementInfo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA'].includes(activeTag) || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (activeDragMode) {
          if (dragSessionRef.current) {
            onLiveOverride(null);
            currentLiveTransformRef.current = null;
            setActiveDragMode(null);
            dragSessionRef.current = null;
            setActiveGuides([]);
          }
        } else {
          onSelectElement(null);
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteElement?.(activeElementInfo.kind, selectedElementId);
        onSelectElement(null);
        return;
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.2;
        let deltaX = 0;
        let deltaY = 0;

        if (e.key === 'ArrowLeft') deltaX = -step;
        if (e.key === 'ArrowRight') deltaX = step;
        if (e.key === 'ArrowUp') deltaY = -step;
        if (e.key === 'ArrowDown') deltaY = step;

        const current = currentLiveTransformRef.current || currentTransform;
        const nextTransform = clampTransform({
          ...current,
          x: current.x + deltaX,
          y: current.y + deltaY,
        });

        currentLiveTransformRef.current = nextTransform;

        onLiveOverride({ id: selectedElementId, transform: nextTransform });

        // Debounce commit to server
        if (arrowDebounceTimerRef.current) {
          clearTimeout(arrowDebounceTimerRef.current);
        }
        arrowDebounceTimerRef.current = setTimeout(async () => {
          onLiveOverride(null);
          currentLiveTransformRef.current = null;
          await onCommitTransform({
            kind: activeElementInfo.kind,
            id: selectedElementId,
            transform: nextTransform,
          });
        }, 400);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (arrowDebounceTimerRef.current) {
        clearTimeout(arrowDebounceTimerRef.current);
      }
    };
  }, [
    enabled,
    selectedElementId,
    activeElementInfo,
    activeDragMode,
    currentTransform,
    containerRef,
    resolveElementById,
    onLiveOverride,
    onCommitTransform,
    onDeleteElement,
    onSelectElement,
  ]);

  // Action Bar Handlers
  const handleResetTransform = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeElementInfo || !selectedElementId) return;
    currentLiveTransformRef.current = null;
    onLiveOverride(null);
    await onCommitTransform({
      kind: activeElementInfo.kind,
      id: selectedElementId,
      transform: { ...DEFAULT_TRANSFORM },
    });
  };

  const handleCenterHorizontal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeElementInfo || !selectedElementId) return;
    const nextTransform = clampTransform({
      ...currentTransform,
      x: 0,
    });
    currentLiveTransformRef.current = null;
    onLiveOverride(null);
    await onCommitTransform({
      kind: activeElementInfo.kind,
      id: selectedElementId,
      transform: nextTransform,
    });
  };

  const handleCenterVertical = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeElementInfo || !selectedElementId) return;
    const nextTransform = clampTransform({
      ...currentTransform,
      y: 0,
    });
    currentLiveTransformRef.current = null;
    onLiveOverride(null);
    await onCommitTransform({
      kind: activeElementInfo.kind,
      id: selectedElementId,
      transform: nextTransform,
    });
  };

  const handleDeleteCurrent = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeElementInfo || !selectedElementId) return;
    await onDeleteElement?.(activeElementInfo.kind, selectedElementId);
    onSelectElement(null);
  };

  if (!enabled) return null;

  return (
    <div
      onPointerDown={handleOverlayPointerDown}
      onPointerMove={(e) => {
        if (activeDragMode) {
          handlePointerMove(e);
        } else {
          handleOverlayPointerMove(e);
        }
      }}
      onPointerUp={handlePointerUp}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        pointerEvents: activeDragMode ? 'all' : 'auto',
        userSelect: 'none',
        cursor: hoveredId && hoveredId !== selectedElementId ? 'pointer' : 'default',
      }}
    >
      {/* Alignment Smart Guides */}
      {activeGuides.map((guide, idx) => {
        if (guide.type === 'x') {
          return (
            <div
              key={`guide-x-${idx}`}
              data-gizmo-ui="true"
              style={{
                position: 'absolute',
                left: `${50 + guide.positionPercent / 2}%`,
                top: 0,
                bottom: 0,
                width: '1px',
                backgroundColor: '#f97316',
                boxShadow: '0 0 6px #f97316',
                pointerEvents: 'none',
                zIndex: 60,
              }}
            />
          );
        }
        return (
          <div
            key={`guide-y-${idx}`}
            data-gizmo-ui="true"
            style={{
              position: 'absolute',
              top: `${50 + guide.positionPercent / 2}%`,
              left: 0,
              right: 0,
              height: '1px',
              backgroundColor: '#f97316',
              boxShadow: '0 0 6px #f97316',
              pointerEvents: 'none',
              zIndex: 60,
            }}
          />
        );
      })}

      {/* Hover Outline */}
      {hoveredBox.visible && hoveredId !== selectedElementId && (
        <div
          data-gizmo-ui="true"
          style={{
            position: 'absolute',
            left: `${hoveredBox.left}px`,
            top: `${hoveredBox.top}px`,
            width: `${hoveredBox.width}px`,
            height: `${hoveredBox.height}px`,
            border: '1.5px dashed rgba(56, 189, 248, 0.7)',
            borderRadius: '4px',
            pointerEvents: 'none',
            transition: 'border-color 0.1s ease',
          }}
        />
      )}

      {/* Selection Box & Transform Gizmo Handles */}
      {selectedBox.visible && (
        <div
          data-gizmo-ui="true"
          onPointerDown={handleSelectionBoxPointerDown}
          onPointerMove={(e) => {
            if (activeDragMode) {
              handlePointerMove(e);
            } else {
              handleOverlayPointerMove(e);
            }
          }}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          style={{
            position: 'absolute',
            left: `${selectedBox.left}px`,
            top: `${selectedBox.top}px`,
            width: `${selectedBox.width}px`,
            height: `${selectedBox.height}px`,
            border: '1.5px solid #38bdf8',
            borderRadius: '4px',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.35)',
            cursor: activeDragMode === 'move' ? 'grabbing' : (hoveredId && hoveredId !== selectedElementId ? 'pointer' : 'grab'),
            pointerEvents: 'auto',
          }}
        >
          {/* Top Info Badge */}
          <div
            data-gizmo-ui="true"
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: selectedBox.top < 36 ? '6px' : 'auto',
              bottom: selectedBox.top < 36 ? 'auto' : '100%',
              left: '50%',
              transform: selectedBox.top < 36 ? 'translateX(-50%)' : 'translateX(-50%) translateY(-8px)',
              backgroundColor: 'rgba(16, 16, 20, 0.94)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '10.5px',
              color: '#d4d4d8',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
              fontFamily: 'monospace',
              zIndex: 70,
            }}
          >
            <span style={{ color: '#e4e4e7', fontWeight: 600 }}>
              {activeElementInfo?.name ? activeElementInfo.name.substring(0, 24) : t.player.gizmo.element}
            </span>
            <span style={{ color: '#52525b' }}>|</span>
            <span>X: {currentTransform.x.toFixed(1)}%</span>
            <span>Y: {currentTransform.y.toFixed(1)}%</span>
            <span style={{ color: '#a1a1aa' }}>{Math.round(currentTransform.scale * 100)}%</span>
            <span style={{ color: '#a1a1aa' }}>{Math.round(currentTransform.rotation)}°</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectElement(null);
              }}
              title={t.player.gizmo.deselect}
              style={{
                background: 'none',
                border: 'none',
                color: '#71717a',
                cursor: 'pointer',
                padding: '1px 3px',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: '3px',
                pointerEvents: 'auto',
                marginLeft: '4px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#71717a')}
            >
              <X size={11} />
            </button>
          </div>

          {/* Stem Line & Rotation Handle */}
          <div
            data-gizmo-ui="true"
            style={{
              position: 'absolute',
              top: selectedBox.top < 36 ? 'auto' : '-24px',
              bottom: selectedBox.top < 36 ? '-24px' : 'auto',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: selectedBox.top < 36 ? 'column-reverse' : 'column',
              alignItems: 'center',
            }}
          >
            <div
              data-gizmo-ui="true"
              onPointerDown={(e) => startDrag(e, 'rotate', selectedElementId || '')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              title={t.player.gizmo.rotateTooltip}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: '2px solid #38bdf8',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.6)',
                cursor: 'crosshair',
                zIndex: 70,
              }}
            />
            <div
              data-gizmo-ui="true"
              style={{
                width: '1px',
                height: '12px',
                backgroundColor: '#38bdf8',
              }}
            />
          </div>

          {/* 4 Corner Resize Handles */}
          {(['nw', 'ne', 'se', 'sw'] as const).map((corner) => {
            const isN = corner.includes('n');
            const isW = corner.includes('w');
            return (
              <div
                key={corner}
                data-gizmo-ui="true"
                onPointerDown={(e) => startDrag(e, `resize-${corner}` as DragMode, selectedElementId || '')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                title={t.player.gizmo.scaleTooltip}
                style={{
                  position: 'absolute',
                  top: isN ? '-5px' : 'calc(100% - 4px)',
                  left: isW ? '-5px' : 'calc(100% - 4px)',
                  width: '9px',
                  height: '9px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #38bdf8',
                  borderRadius: '2px',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
                  cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                  zIndex: 65,
                }}
              />
            );
          })}

          {/* 4 Edge Resize Handles */}
          <div
            data-gizmo-ui="true"
            onPointerDown={(e) => startDrag(e, 'resize-n', selectedElementId || '')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              position: 'absolute',
              top: '-4px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '7px',
              height: '7px',
              backgroundColor: '#ffffff',
              border: '1.5px solid #38bdf8',
              borderRadius: '2px',
              cursor: 'ns-resize',
              zIndex: 64,
            }}
          />
          <div
            data-gizmo-ui="true"
            onPointerDown={(e) => startDrag(e, 'resize-s', selectedElementId || '')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              position: 'absolute',
              bottom: '-4px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '7px',
              height: '7px',
              backgroundColor: '#ffffff',
              border: '1.5px solid #38bdf8',
              borderRadius: '2px',
              cursor: 'ns-resize',
              zIndex: 64,
            }}
          />
          <div
            data-gizmo-ui="true"
            onPointerDown={(e) => startDrag(e, 'resize-w', selectedElementId || '')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              position: 'absolute',
              top: '50%',
              left: '-4px',
              transform: 'translateY(-50%)',
              width: '7px',
              height: '7px',
              backgroundColor: '#ffffff',
              border: '1.5px solid #38bdf8',
              borderRadius: '2px',
              cursor: 'ew-resize',
              zIndex: 64,
            }}
          />
          <div
            data-gizmo-ui="true"
            onPointerDown={(e) => startDrag(e, 'resize-e', selectedElementId || '')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              position: 'absolute',
              top: '50%',
              right: '-4px',
              transform: 'translateY(-50%)',
              width: '7px',
              height: '7px',
              backgroundColor: '#ffffff',
              border: '1.5px solid #38bdf8',
              borderRadius: '2px',
              cursor: 'ew-resize',
              zIndex: 64,
            }}
          />

          {/* Floating Action Bar Below Selection */}
          <div
            data-gizmo-ui="true"
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(16, 16, 20, 0.92)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '7px',
              padding: '2px 3px',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              zIndex: 70,
            }}
          >
            {/* Direct Text Edit Action on Canvas Toolbar */}
            {(() => {
              const matchedText =
                activeElementInfo?.kind === 'text'
                  ? (activeElementInfo.item as TextElementData)
                  : (sceneData?.texts || []).find(
                      (t) =>
                        t.parentId === selectedElementId ||
                        t.id === selectedElementId ||
                        (selectedElementId === 'card_cta_button' && t.id === 'txt_cta_title')
                    );
              if (!matchedText) return null;
              return (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTextInspector?.(matchedText);
                    }}
                    title={t.player.gizmo.editText}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '5px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#a1a1aa',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#a1a1aa';
                    }}
                  >
                    <Edit3 size={12} />
                  </button>
                  <div style={{ width: '1px', height: '12px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '0 1px' }} />
                </>
              );
            })()}

            <button
              onClick={handleResetTransform}
              title={t.player.gizmo.resetTransform}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#a1a1aa',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              <RotateCcw size={12} />
            </button>

            <button
              onClick={handleCenterHorizontal}
              title={t.player.gizmo.centerH}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#a1a1aa',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              <AlignCenter size={12} />
            </button>

            <button
              onClick={handleCenterVertical}
              title={t.player.gizmo.centerV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#a1a1aa',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              <Compass size={12} />
            </button>

            <button
              onClick={() => onSelectElement(null)}
              title={t.player.gizmo.deselect}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#a1a1aa',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              <X size={12} />
            </button>

            <div style={{ width: '1px', height: '12px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '0 1px' }} />

            <button
              onClick={handleDeleteCurrent}
              title={t.player.gizmo.deleteElement}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#71717a',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                e.currentTarget.style.color = '#f87171';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#71717a';
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
