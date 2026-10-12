import { VideoKeyframe } from '../types/chat';

export const MAX_VIDEO_DURATION_SECONDS = 30;
export const MAX_VIDEO_FILE_SIZE_BYTES = 40 * 1024 * 1024; // 40 MB
export const DEFAULT_KEYFRAME_COUNT = 6;

export interface VideoValidationResult {
  valid: boolean;
  error?: string;
}

export function validateVideoFile(file: File): VideoValidationResult {
  if (!file) {
    return { valid: false, error: 'Invalid or missing file.' };
  }

  if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Video size (${sizeMb} MB) exceeds maximum limit of 40 MB. Please choose a lighter file.`,
    };
  }

  const isVideoMime = file.type.startsWith('video/');
  const extension = file.name.split('.').pop()?.toLowerCase();
  const validExtensions = ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi'];

  if (!isVideoMime && (!extension || !validExtensions.includes(extension))) {
    return {
      valid: false,
      error: 'Unsupported file format. Please choose an MP4, WebM, or MOV video file.',
    };
  }

  return { valid: true };
}

export function loadVideoElement(file: File): Promise<{
  video: HTMLVideoElement;
  objectUrl: string;
  durationSeconds: number;
  durationFrames: number;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let timeoutId: any = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Video metadata loading timed out. File may be corrupted or unsupported.'));
    }, 15000);

    video.onloadedmetadata = () => {
      clearTimeout(timeoutId);
      const duration = video.duration;

      if (!Number.isFinite(duration) || duration <= 0) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to determine video duration. Please verify the file.'));
        return;
      }

      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        URL.revokeObjectURL(objectUrl);
        reject(
          new Error(
            `Video duration (${duration.toFixed(1)}s) exceeds maximum allowed duration (${MAX_VIDEO_DURATION_SECONDS}s). Please choose a shorter clip.`
          )
        );
        return;
      }

      const durationFrames = Math.max(1, Math.round(duration * 30));
      resolve({
        video,
        objectUrl,
        durationSeconds: duration,
        durationFrames,
      });
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Error loading video file in browser. Please check format compatibility.'));
    };

    video.src = objectUrl;
  });
}

export async function extractVideoKeyframes(
  video: HTMLVideoElement,
  count: number = DEFAULT_KEYFRAME_COUNT,
  onProgress?: (progressPercent: number) => void
): Promise<VideoKeyframe[]> {
  const duration = video.duration;
  const keyframes: VideoKeyframe[] = [];

  const rawWidth = video.videoWidth || 1280;
  const rawHeight = video.videoHeight || 720;

  // Scale down dimensions to keep keyframes lightweight and fast to transfer
  const maxDimension = 720;
  let targetWidth = rawWidth;
  let targetHeight = rawHeight;

  if (targetWidth > targetHeight) {
    if (targetWidth > maxDimension) {
      targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
      targetWidth = maxDimension;
    }
  } else {
    if (targetHeight > maxDimension) {
      targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
      targetHeight = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to initialize 2D canvas context.');
  }

  // Calculate target timestamps
  const timestamps: number[] = [];
  if (count <= 1) {
    timestamps.push(0);
  } else {
    const step = duration / (count - 1);
    for (let i = 0; i < count; i++) {
      timestamps.push(Math.min(duration, i * step));
    }
  }

  const seekToTime = (time: number): Promise<void> => {
    return new Promise((resolve) => {
      const handleSeeked = () => {
        video.removeEventListener('seeked', handleSeeked);
        resolve();
      };
      video.addEventListener('seeked', handleSeeked);
      video.currentTime = time;
    });
  };

  for (let i = 0; i < timestamps.length; i++) {
    const targetTime = timestamps[i];
    await seekToTime(targetTime);

    try {
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      const frameIndex = Math.round(targetTime * 30);

      keyframes.push({
        timeSeconds: Number(targetTime.toFixed(2)),
        frameIndex,
        dataUrl,
      });
    } catch (drawErr) {
      console.warn('[VideoKeyframes] Failed to draw frame at', targetTime, drawErr);
    }

    if (onProgress) {
      const pct = Math.round(((i + 1) / timestamps.length) * 100);
      onProgress(pct);
    }
  }

  return keyframes;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as Base64.'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
