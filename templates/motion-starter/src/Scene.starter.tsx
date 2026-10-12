import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import importedSceneData from './scene-data.json';

export interface SceneProps {
  sceneData?: any;
}

export const DURATION_IN_FRAMES = 180;

const { fontFamily: fontMontserrat } = loadMontserrat('normal', {
  weights: ['600', '700', '800', '900'],
  subsets: ['latin'],
  ignoreTooManyRequestsWarning: true,
});

export const Scene: React.FC<SceneProps> = ({ sceneData: propSceneData }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const isVertical = height > width;
  const scale = Math.min(width, height) / 1080;

  const activeData = propSceneData || importedSceneData;

  const findElement = (id: string): any => {
    return (
      activeData.texts?.find((t: any) => t.id === id) ||
      activeData.cards?.find((c: any) => c.id === id)
    );
  };

  const findActiveElement = (id: string, currentFrame: number): any => {
    const allMatches = [
      ...(activeData.texts || []),
      ...(activeData.cards || []),
    ].filter(
      (item: any) =>
        item &&
        (item.id === id ||
          item.baseId === id ||
          (typeof item.id === 'string' &&
            (item.id.startsWith(`${id}_part_`) || item.id.startsWith(`${id}__`))))
    );

    for (const item of allMatches) {
      if (item.isDeleted) continue;
      const start = typeof item.startFrame === 'number' ? item.startFrame : 0;
      const holdToEnd = Boolean(item.holdToEnd);
      const duration = holdToEnd
        ? Math.max(1, DURATION_IN_FRAMES - start)
        : (typeof item.durationInFrames === 'number' ? item.durationInFrames : DURATION_IN_FRAMES);
      const end = start + duration;
      if (currentFrame >= start && currentFrame < end) {
        return item;
      }
    }

    for (const item of allMatches) {
      if (!item.isDeleted) continue;
      const start = typeof item.startFrame === 'number' ? item.startFrame : 0;
      const holdToEnd = Boolean(item.holdToEnd);
      const duration = holdToEnd
        ? Math.max(1, DURATION_IN_FRAMES - start)
        : (typeof item.durationInFrames === 'number' ? item.durationInFrames : DURATION_IN_FRAMES);
      const end = start + duration;
      if (currentFrame >= start && currentFrame < end) {
        return item;
      }
    }

    const primary = allMatches.find((item: any) => item.id === id);
    return primary || allMatches[0] || null;
  };

  const getSceneText = (id: string): string => {
    const item = findActiveElement(id, frame) || findElement(id);
    if (!item || item.isDeleted) return '';
    return item.text ?? '???';
  };

  const getSceneColor = (id: string, defaultColor: string): string => {
    const item = findActiveElement(id, frame) || findElement(id);
    return item?.color || defaultColor;
  };

  const getSceneFontSize = (id: string, defaultSize: number): number => {
    const item = findActiveElement(id, frame) || findElement(id);
    return typeof item?.fontSize === 'number' ? item.fontSize : defaultSize;
  };

  const getSceneStartFrame = (id: string, defaultStart: number): number => {
    const item = findActiveElement(id, frame) || findElement(id);
    return typeof item?.startFrame === 'number' ? item.startFrame : defaultStart;
  };

  const getSceneDuration = (id: string, defaultDuration: number): number => {
    const item = findActiveElement(id, frame) || findElement(id);
    if (!item) return defaultDuration;
    if (item.holdToEnd) {
      const start = typeof item.startFrame === 'number' ? item.startFrame : 0;
      return Math.max(1, DURATION_IN_FRAMES - start);
    }
    return typeof item?.durationInFrames === 'number' ? item.durationInFrames : defaultDuration;
  };

  const isTextDeleted = (id: string): boolean => {
    const item = findActiveElement(id, frame) || findElement(id);
    return Boolean(item?.isDeleted);
  };

  const getSceneTransform = (id: string): React.CSSProperties => {
    const item = findActiveElement(id, frame) || findElement(id);
    const t = item?.transform;
    if (!t) return {};
    const x = typeof t.x === 'number' ? t.x : 0;
    const y = typeof t.y === 'number' ? t.y : 0;
    const scaleMultiplier = typeof t.scale === 'number' ? t.scale : 1;
    const rotationDeg = typeof t.rotation === 'number' ? t.rotation : 0;
    return {
      transform: `translate(${(x / 100) * width}px, ${(y / 100) * height}px) rotate(${rotationDeg}deg) scale(${scaleMultiplier})`,
      transformOrigin: 'center center',
    };
  };

  // Unified Frame-Accurate Scene Item Component
  interface SceneItemRenderProps {
    springVal: number;
    opacity: number;
    start: number;
    duration: number;
    end: number;
    isDeleted: boolean;
    isVisible: boolean;
  }

  interface SceneItemProps {
    id: string;
    defaultStart?: number;
    defaultDuration?: number;
    fadeDuration?: number;
    springConfig?: { damping: number; stiffness: number; mass: number };
    style?: React.CSSProperties;
    className?: string;
    children: React.ReactNode | ((props: SceneItemRenderProps) => React.ReactNode);
  }

  const SceneItem: React.FC<SceneItemProps> = ({
    id,
    defaultStart = 0,
    defaultDuration = DURATION_IN_FRAMES,
    fadeDuration = 8,
    springConfig = { damping: 13, stiffness: 90, mass: 0.8 },
    style,
    className,
    children,
  }) => {
    const item = findActiveElement(id, frame);
    const isDeleted = Boolean(item?.isDeleted);
    const start = typeof item?.startFrame === 'number' ? item.startFrame : defaultStart;
    const holdToEnd = Boolean(item?.holdToEnd);
    const duration = holdToEnd
      ? Math.max(1, DURATION_IN_FRAMES - start)
      : (typeof item?.durationInFrames === 'number' ? item.durationInFrames : defaultDuration);
    const end = start + duration;

    // Strict frame bounds check
    if (isDeleted || frame < start || frame >= end) {
      return null;
    }

    const springVal = spring({
      frame: frame - start,
      fps,
      config: springConfig,
    });

    const fadeLen = holdToEnd ? 0 : Math.min(fadeDuration, Math.max(1, Math.floor(duration / 2)));
    const exitFade = fadeLen > 0
      ? interpolate(frame, [end - fadeLen, end], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

    const opacity = Math.min(1, Math.max(0, springVal * exitFade));
    const activeId = item?.id || id;
    const transformStyle = getSceneTransform(activeId);

    const baseTransform = style?.transform ? `${style.transform} ` : '';
    const userTransform = transformStyle.transform ? `${transformStyle.transform} ` : '';
    const combinedTransform = (baseTransform + userTransform).trim() || undefined;

    const mergedStyle: React.CSSProperties = {
      width: 'fit-content',
      maxWidth: '100%',
      ...style,
      ...transformStyle,
      transform: combinedTransform,
      transformOrigin: 'center center',
    };

    if (typeof children === 'function') {
      return (
        <div
          data-scene-id={activeId}
          className={className}
          style={mergedStyle}
        >
          {children({
            springVal,
            opacity,
            start,
            duration,
            end,
            isDeleted: false,
            isVisible: true,
          })}
        </div>
      );
    }

    return (
      <div
        data-scene-id={activeId}
        className={className}
        style={{
          opacity,
          ...mergedStyle,
        }}
      >
        {children}
      </div>
    );
  };

  // Ambient organic float
  const auraPulse = Math.sin(frame / 24) * 0.08 + 1;
  const orbFloatY = Math.sin(frame / 30) * 12;

  // Floating ambient particles
  const particles = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      x: ((i * 137.5) % 100),
      y: ((i * 73.1) % 100),
      size: (i % 3) + 2,
      speed: 0.2 + (i % 4) * 0.1,
      color: i % 2 === 0 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(168, 85, 247, 0.35)',
    }));
  }, []);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#050814',
        overflow: 'hidden',
        color: '#ffffff',
        direction: 'ltr',
      }}
    >
      {/* 1. Deep Space Atmospheric Gradient Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 90% 70% at 50% 45%, #0d1538 0%, #060918 65%, #03050c 100%)',
        }}
      />

      {/* 2. Soft Glowing Tech Orbs */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '42%',
          transform: `translate(-50%, -50%) translateY(${orbFloatY}px) scale(${auraPulse})`,
          width: 600 * scale,
          height: 600 * scale,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(168, 85, 247, 0.08) 50%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      {/* 3. Floating Ambient Particles */}
      {particles.map((p, idx) => {
        const floatY = (p.y - frame * p.speed) % 100;
        const normalizedY = floatY < 0 ? floatY + 100 : floatY;
        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${normalizedY}%`,
              width: p.size * scale,
              height: p.size * scale,
              borderRadius: '50%',
              backgroundColor: p.color,
              boxShadow: `0 0 10px ${p.color}`,
              pointerEvents: 'none',
            }}
          />
        );
      })}

      {/* 4. Center Typography Container */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: isVertical ? width - 80 * scale : 960 * scale,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 10,
        }}
      >
        {/* Top Tech Badge */}
        <SceneItem
          id="txt_badge"
          defaultStart={5}
          defaultDuration={175}
          springConfig={{ damping: 12, stiffness: 95, mass: 0.8 }}
        >
          {({ springVal, opacity }) => (
            <div
              style={{
                opacity,
                transform: `scale(${springVal})`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8 * scale,
                padding: `${8 * scale}px ${20 * scale}px`,
                borderRadius: 9999,
                backgroundColor: 'rgba(168, 85, 247, 0.12)',
                border: `${1.5 * scale}px solid rgba(168, 85, 247, 0.35)`,
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.25)',
                marginBottom: 24 * scale,
              }}
            >
              <div
                style={{
                  width: 8 * scale,
                  height: 8 * scale,
                  borderRadius: '50%',
                  backgroundColor: getSceneColor('txt_badge', '#c084fc'),
                  boxShadow: `0 0 8px ${getSceneColor('txt_badge', '#c084fc')}`,
                }}
              />
              <span
                style={{
                  fontFamily: fontMontserrat,
                  fontSize: (isVertical ? 15 : getSceneFontSize('txt_badge', 18)) * scale,
                  fontWeight: 700,
                  color: getSceneColor('txt_badge', '#c084fc'),
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                {getSceneText('txt_badge')}
              </span>
            </div>
          )}
        </SceneItem>

        {/* Main Kinetic Headline */}
        <SceneItem
          id="txt_title"
          defaultStart={12}
          defaultDuration={168}
          springConfig={{ damping: 13, stiffness: 90, mass: 0.8 }}
        >
          {({ springVal, opacity }) => (
            <div
              style={{
                fontFamily: fontMontserrat,
                fontSize: (isVertical ? 64 : getSceneFontSize('txt_title', 84)) * scale,
                fontWeight: 900,
                color: getSceneColor('txt_title', '#ffffff'),
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                opacity,
                transform: `translateY(${(1 - springVal) * 30}px) scale(${0.92 + springVal * 0.08})`,
                textShadow: '0 0 40px rgba(56, 189, 248, 0.35), 0 10px 30px rgba(0, 0, 0, 0.8)',
                marginBottom: 20 * scale,
              }}
            >
              {getSceneText('txt_title')}
            </div>
          )}
        </SceneItem>

        {/* Subtitle / Creative Prompt Guidance */}
        <SceneItem
          id="txt_subtitle"
          defaultStart={22}
          defaultDuration={158}
          springConfig={{ damping: 14, stiffness: 90, mass: 0.8 }}
        >
          {({ springVal, opacity }) => (
            <div
              style={{
                fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif",
                fontSize: (isVertical ? 22 : getSceneFontSize('txt_subtitle', 26)) * scale,
                fontWeight: 600,
                color: getSceneColor('txt_subtitle', '#38bdf8'),
                opacity,
                transform: `translateY(${(1 - springVal) * 20}px)`,
                lineHeight: 1.4,
                maxWidth: 760 * scale,
                textShadow: '0 0 20px rgba(56, 189, 248, 0.4)',
              }}
            >
              {getSceneText('txt_subtitle')}
            </div>
          )}
        </SceneItem>
      </div>
    </AbsoluteFill>
  );
};

export default Scene;
