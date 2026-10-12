import { useEffect, useRef } from 'react';
import { AudioClip } from '../types/audio';

export function useAudioPlayback(
  audioClips: AudioClip[] = [],
  currentFrame: number,
  isPlaying: boolean,
  fps = 30
) {
  const audioInstancesRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const playedFramesRef = useRef<Set<string>>(new Set());
  const lastFrameRef = useRef<number>(currentFrame);

  // Initialize and sync audio elements cache
  // Clips starting with 'parsed_' are natively rendered and played by Remotion's Player inside Scene.tsx
  const timelineOnlyClips = audioClips.filter((c) => !c.id.startsWith('parsed_'));

  useEffect(() => {
    const currentMap = audioInstancesRef.current;

    // Add new clips
    timelineOnlyClips.forEach((clip) => {
      if (!currentMap.has(clip.id)) {
        const audio = new Audio(clip.src);
        audio.volume = clip.isMuted ? 0 : (clip.volume ?? 1);
        currentMap.set(clip.id, audio);
      } else {
        const audio = currentMap.get(clip.id)!;
        audio.volume = clip.isMuted ? 0 : (clip.volume ?? 1);
      }
    });

    // Remove deleted clips
    Array.from(currentMap.keys()).forEach((id) => {
      if (!timelineOnlyClips.some((c) => c.id === id)) {
        const audio = currentMap.get(id);
        audio?.pause();
        currentMap.delete(id);
      }
    });
  }, [audioClips]);

  // Handle play / pause transitions
  useEffect(() => {
    if (!isPlaying) {
      audioInstancesRef.current.forEach((audio) => {
        audio.pause();
      });
      playedFramesRef.current.clear();
    }
  }, [isPlaying]);

  // Synchronize with currentFrame
  useEffect(() => {
    // If playhead seeked backward or looped back
    if (currentFrame < lastFrameRef.current) {
      playedFramesRef.current.clear();
      audioInstancesRef.current.forEach((audio) => {
        audio.pause();
      });
    }
    lastFrameRef.current = currentFrame;

    if (!isPlaying) return;

    timelineOnlyClips.forEach((clip) => {
      const audio = audioInstancesRef.current.get(clip.id);
      if (!audio || clip.isMuted) return;

      const endFrame = clip.startFrame + clip.durationInFrames;
      const key = `${clip.id}_${clip.startFrame}`;

      // If playhead enters clip start frame
      if (currentFrame >= clip.startFrame && currentFrame < endFrame) {
        if (!playedFramesRef.current.has(key)) {
          const offsetSeconds = Math.max(0, (currentFrame - clip.startFrame) / fps);
          try {
            audio.currentTime = offsetSeconds;
            audio.play().catch((e) => console.warn('[AudioPlayback] Autoplay prevented:', e));
            playedFramesRef.current.add(key);
          } catch (err) {
            console.warn('[AudioPlayback] Failed to set offset:', err);
          }
        }
      } else if (currentFrame < clip.startFrame || currentFrame >= endFrame) {
        if (playedFramesRef.current.has(key)) {
          audio.pause();
          playedFramesRef.current.delete(key);
        }
      }
    });
  }, [currentFrame, isPlaying, audioClips, fps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioInstancesRef.current.forEach((audio) => audio.pause());
      audioInstancesRef.current.clear();
    };
  }, []);
}
