import { TextElementData, CardElementData } from '../types/sceneData';

export type TrackItem = (TextElementData | CardElementData) & {
  startFrame: number;
  durationInFrames: number;
  track?: number;
  holdToEnd?: boolean;
};

/**
 * Calculates the effective duration in frames for an element,
 * respecting the holdToEnd flag if set to true.
 */
export function getEffectiveDuration(
  item: { startFrame: number; durationInFrames: number; holdToEnd?: boolean },
  sceneDuration: number
): number {
  if (item.holdToEnd) {
    return Math.max(1, sceneDuration - item.startFrame);
  }
  return Math.max(1, item.durationInFrames);
}

/**
 * Checks if a candidate item collides or overlaps with any existing item on the same track.
 */
export function hasOverlap<T extends TrackItem>(
  items: T[],
  candidate: { id: string; startFrame: number; durationInFrames: number; track: number; holdToEnd?: boolean },
  sceneDuration: number
): boolean {
  const candStart = candidate.startFrame;
  const candEnd = candStart + getEffectiveDuration(candidate, sceneDuration);

  for (const item of items) {
    if (item.id === candidate.id) continue;
    if ((item as any).isDeleted) continue;
    const itemTrack = typeof item.track === 'number' ? item.track : 0;
    if (itemTrack !== candidate.track) continue;

    const itemStart = item.startFrame;
    const itemEnd = itemStart + getEffectiveDuration(item, sceneDuration);

    // Overlap occurs if one interval starts before the other ends
    if (candStart < itemEnd && candEnd > itemStart) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes an array of items to ensure every item has a valid, non-overlapping track index.
 * If an item lacks a track or collides, it is assigned the lowest available track index.
 */
export function normalizeTracks<T extends TrackItem>(
  items: T[],
  sceneDuration: number
): T[] {
  const result: T[] = [];

  for (const rawItem of items) {
    if ((rawItem as any).isDeleted) {
      result.push(rawItem);
      continue;
    }
    const item = { ...rawItem };
    let desiredTrack = typeof item.track === 'number' && item.track >= 0 ? item.track : 0;

    while (
      hasOverlap(
        result,
        {
          id: item.id,
          startFrame: item.startFrame,
          durationInFrames: item.durationInFrames,
          track: desiredTrack,
          holdToEnd: item.holdToEnd,
        },
        sceneDuration
      )
    ) {
      desiredTrack += 1;
    }

    item.track = desiredTrack;
    result.push(item as T);
  }

  return result;
}

/**
 * Snaps a target frame to nearest magnetic anchor within thresholdFrames.
 */
export function snapFrame(
  frame: number,
  snapTargets: number[],
  thresholdFrames: number = 3
): { frame: number; snapped: boolean; target?: number } {
  let closestTarget: number | undefined;
  let minDiff = Infinity;

  for (const target of snapTargets) {
    const diff = Math.abs(frame - target);
    if (diff <= thresholdFrames && diff < minDiff) {
      minDiff = diff;
      closestTarget = target;
    }
  }

  if (closestTarget !== undefined) {
    return { frame: closestTarget, snapped: true, target: closestTarget };
  }

  return { frame, snapped: false };
}
