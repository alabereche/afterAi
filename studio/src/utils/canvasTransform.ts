import { ElementTransform, DEFAULT_TRANSFORM, SceneData, TextElementData, CardElementData } from '../types/sceneData';

export interface SnapTarget {
  type: 'x' | 'y';
  value: number;
  label?: string;
}

export interface SnapResult {
  snappedPos: { x: number; y: number };
  activeGuides: Array<{
    type: 'x' | 'y';
    positionPercent: number;
  }>;
}

/**
 * Converts screen pixel delta into percentage of player dimensions.
 */
export function screenDeltaToPercent(
  dx: number,
  dy: number,
  playerRect: { width: number; height: number }
): { xPercent: number; yPercent: number } {
  if (!playerRect || playerRect.width <= 0 || playerRect.height <= 0) {
    return { xPercent: 0, yPercent: 0 };
  }
  return {
    xPercent: (dx / playerRect.width) * 100,
    yPercent: (dy / playerRect.height) * 100,
  };
}

/**
 * Clamps and sanitizes transform values to valid ranges.
 * x, y: [-200, 200]
 * scale: [0.1, 10]
 * rotation: [-360, 360]
 */
export function clampTransform(t?: Partial<ElementTransform> | null): ElementTransform {
  if (!t) return { ...DEFAULT_TRANSFORM };

  const xVal = typeof t.x === 'number' && Number.isFinite(t.x) ? t.x : DEFAULT_TRANSFORM.x;
  const yVal = typeof t.y === 'number' && Number.isFinite(t.y) ? t.y : DEFAULT_TRANSFORM.y;
  const scaleVal = typeof t.scale === 'number' && Number.isFinite(t.scale) ? t.scale : DEFAULT_TRANSFORM.scale;
  const rotVal = typeof t.rotation === 'number' && Number.isFinite(t.rotation) ? t.rotation : DEFAULT_TRANSFORM.rotation;

  return {
    x: Math.round(Math.min(200, Math.max(-200, xVal)) * 1000) / 1000,
    y: Math.round(Math.min(200, Math.max(-200, yVal)) * 1000) / 1000,
    scale: Math.round(Math.min(10, Math.max(0.1, scaleVal)) * 1000) / 1000,
    rotation: Math.round(Math.min(360, Math.max(-360, rotVal)) * 1000) / 1000,
  };
}

/**
 * Calculates proportional scale multiplier based on distance from element center.
 */
export function scaleFromCorner(
  elementCenter: { x: number; y: number },
  startPoint: { x: number; y: number },
  currentPoint: { x: number; y: number },
  startScale: number
): number {
  const dStart = Math.hypot(startPoint.x - elementCenter.x, startPoint.y - elementCenter.y);
  const dCurrent = Math.hypot(currentPoint.x - elementCenter.x, currentPoint.y - elementCenter.y);

  if (dStart < 1) {
    return startScale;
  }

  const rawScale = startScale * (dCurrent / dStart);
  return Math.round(Math.min(10, Math.max(0.1, rawScale)) * 1000) / 1000;
}

/**
 * Computes rotation angle in degrees from center, with optional 15-degree snapping.
 */
export function angleFromCenter(
  elementCenter: { x: number; y: number },
  point: { x: number; y: number },
  snap15Deg: boolean = false
): number {
  // Center to point vector
  const dx = point.x - elementCenter.x;
  const dy = point.y - elementCenter.y;

  // Rotation handle is 12 o'clock (-90 degrees in standard cartesian)
  const rad = Math.atan2(dy, dx);
  let deg = (rad * 180) / Math.PI + 90;

  // Normalize to -180..180
  while (deg > 180) deg -= 360;
  while (deg < -180) deg += 360;

  if (snap15Deg) {
    deg = Math.round(deg / 15) * 15;
  }

  return Math.round(Math.min(360, Math.max(-360, deg)) * 10) / 10;
}

/**
 * Snapping calculations against smart guides (center, margins, custom targets).
 */
export function computeSnap(
  currentPos: { x: number; y: number },
  targets: SnapTarget[] = [],
  thresholdPercent: number = 1.5
): SnapResult {
  let snappedX = currentPos.x;
  let snappedY = currentPos.y;
  const activeGuides: Array<{ type: 'x' | 'y'; positionPercent: number }> = [];

  let closestDistX = thresholdPercent;
  let closestDistY = thresholdPercent;

  for (const target of targets) {
    if (target.type === 'x') {
      const dist = Math.abs(currentPos.x - target.value);
      if (dist <= closestDistX) {
        closestDistX = dist;
        snappedX = target.value;
      }
    } else if (target.type === 'y') {
      const dist = Math.abs(currentPos.y - target.value);
      if (dist <= closestDistY) {
        closestDistY = dist;
        snappedY = target.value;
      }
    }
  }

  if (snappedX !== currentPos.x) {
    activeGuides.push({ type: 'x', positionPercent: snappedX });
  }
  if (snappedY !== currentPos.y) {
    activeGuides.push({ type: 'y', positionPercent: snappedY });
  }

  return {
    snappedPos: { x: snappedX, y: snappedY },
    activeGuides,
  };
}

/**
 * Immutably merges a live transform override into SceneData for instant rendering.
 */
export function mergeTransformOverride(
  sceneData: SceneData | null | undefined,
  override: { id: string; transform: ElementTransform } | null | undefined
): SceneData | null | undefined {
  if (!sceneData || !override || !override.id) {
    return sceneData;
  }

  const { id, transform } = override;

  const clonedTexts = Array.isArray(sceneData.texts)
    ? sceneData.texts.map((t: TextElementData) => {
        if (t.id === id) {
          return {
            ...t,
            transform: { ...transform },
          };
        }
        return t;
      })
    : [];

  const clonedCards = Array.isArray(sceneData.cards)
    ? sceneData.cards.map((c: CardElementData) => {
        if (c.id === id) {
          return {
            ...c,
            transform: { ...transform },
          };
        }
        return c;
      })
    : [];

  const hasText = clonedTexts.some((t) => t.id === id);
  const hasCard = clonedCards.some((c) => c.id === id);

  if (!hasText && !hasCard) {
    clonedTexts.push({
      id,
      text: '',
      fontSize: 24,
      color: '#ffffff',
      startFrame: 0,
      durationInFrames: 360,
      track: 0,
      holdToEnd: true,
      isDeleted: false,
      transform: { ...transform },
    });
  }

  return {
    ...sceneData,
    texts: clonedTexts,
    cards: clonedCards,
  };
}
