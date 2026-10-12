import React from 'react';
import { Composition } from 'remotion';
import { Scene, DURATION_IN_FRAMES } from './Scene';

const duration = DURATION_IN_FRAMES || 240;

export const Root: React.FC = () => {
  return (
    <>
      {/* 16:9 Landscape (YouTube / Screens) */}
      <Composition
        id="Main"
        component={Scene}
        durationInFrames={duration}
        fps={30}
        width={1920}
        height={1080}
      />
      {/* 9:16 Vertical (TikTok / Reels / Shorts) */}
      <Composition
        id="Vertical"
        component={Scene}
        durationInFrames={duration}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* 1:1 Square (Instagram / Facebook Post) */}
      <Composition
        id="Square"
        component={Scene}
        durationInFrames={duration}
        fps={30}
        width={1080}
        height={1080}
      />
    </>
  );
};
