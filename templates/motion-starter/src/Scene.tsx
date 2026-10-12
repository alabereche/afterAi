import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import importedSceneData from './scene-data.json';

export interface SceneProps {
  sceneData?: any;
}

export const DURATION_IN_FRAMES = 150;

const { fontFamily: fontMontserrat } = loadMontserrat('normal', {
  weights: ['600', '700', '800', '900'],
  subsets: ['latin'],
  ignoreTooManyRequestsWarning: true,
});

export const Scene: React.FC<SceneProps> = ({ sceneData: propSceneData }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const isVertical = height > width;
  const isSquare = height === width;
  const scale = isVertical ? width / 1080 : Math.min(width / 1920, height / 1080);

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

  const isSceneElementDeleted = (id: string): boolean => {
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
    springConfig = { damping: 14, stiffness: 100, mass: 0.8 },
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

  // Ambient organic float and lighting oscillations
  const auraPulse = Math.sin(frame / 26) * 0.05 + 1;
  const turquoiseFloatY = Math.sin(frame / 30) * 12;
  const turquoiseFloatX = Math.cos(frame / 34) * 10;
  const purpleFloat = Math.sin(frame / 28) * 14;

  // Floating ambient stardust particles
  const particles = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => ({
      x: ((i * 127.3) % 100),
      y: ((i * 83.1) % 100),
      size: (i % 3) + 2,
      speed: 0.12 + (i % 4) * 0.07,
      color: i % 3 === 0
        ? 'rgba(16, 152, 149, 0.45)'
        : i % 3 === 1
        ? 'rgba(141, 68, 191, 0.4)'
        : 'rgba(255, 255, 255, 0.3)',
    }));
  }, []);

  // Dimensions scaled precisely from the original 1600x960 source:
  // p1: 306x662 -> scaled to 1920: 367x794
  // p2: 306x663 -> scaled to 1920: 367x795
  // p3: 179x662 -> scaled to 1920: 215x794
  const p1Width = 367 * scale;
  const p1Height = 794 * scale;
  const p2Width = 367 * scale;
  const p2Height = 795 * scale;
  const p3Width = 215 * scale;
  const p3Height = 794 * scale;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0c0d28',
        overflow: 'hidden',
        color: '#ffffff',
        direction: 'ltr',
      }}
    >
      {/* ========================================================
          1. Exact Color Palette & Cinematic Lighting Atmosphere
         ======================================================== */}
      {/* Base Deep Gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 120% 100% at 50% 50%, #111438 0%, #0a0b22 60%, #060614 100%)',
        }}
      />

      {/* Top Left Warm Magenta/Violet Bloom (Sampled rgb(103,41,114)) */}
      <div
        style={{
          position: 'absolute',
          left: '-8%',
          top: '-10%',
          width: 950 * scale,
          height: 900 * scale,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(103, 41, 114, 0.85) 0%, rgba(68, 22, 85, 0.45) 45%, transparent 75%)',
          filter: 'blur(75px)',
          transform: `scale(${auraPulse}) translate(0, ${purpleFloat * 0.4}px)`,
          pointerEvents: 'none',
        }}
      />

      {/* Mid Left Deep Indigo (Sampled rgb(38,30,103)) */}
      <div
        style={{
          position: 'absolute',
          left: '2%',
          top: '38%',
          width: 800 * scale,
          height: 800 * scale,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(38, 30, 103, 0.7) 0%, rgba(20, 18, 70, 0.4) 50%, transparent 80%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />

      {/* Center Radiant Emerald/Turquoise Aurora (Sampled rgb(16,152,149)) */}
      <div
        style={{
          position: 'absolute',
          left: isVertical ? '15%' : '32%',
          top: isVertical ? '30%' : '14%',
          width: (isVertical ? 800 : 1100) * scale,
          height: 850 * scale,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(16, 152, 149, 0.8) 0%, rgba(22, 145, 150, 0.5) 35%, rgba(10, 85, 95, 0.2) 60%, transparent 80%)',
          filter: 'blur(80px)',
          transform: `translate(${turquoiseFloatX}px, ${turquoiseFloatY}px) scale(${auraPulse})`,
          pointerEvents: 'none',
        }}
      />

      {/* Top Right Slate Navy (Sampled rgb(21,58,86)) */}
      <div
        style={{
          position: 'absolute',
          right: '5%',
          top: '-8%',
          width: 850 * scale,
          height: 650 * scale,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(21, 58, 86, 0.7) 0%, rgba(12, 32, 50, 0.35) 50%, transparent 75%)',
          filter: 'blur(75px)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom Right Vibrant Amethyst/Violet Bloom (Sampled rgb(141,68,191)) */}
      <div
        style={{
          position: 'absolute',
          right: '-5%',
          bottom: '-12%',
          width: 950 * scale,
          height: 950 * scale,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(141, 68, 191, 0.75) 0%, rgba(98, 38, 140, 0.4) 45%, transparent 75%)',
          filter: 'blur(80px)',
          transform: `scale(${auraPulse}) translate(0, ${-purpleFloat * 0.4}px)`,
          pointerEvents: 'none',
        }}
      />

      {/* Floating Ambient Stardust Particles */}
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

      {/* ========================================================
          2. Left Kinetic Typography Block ("App Design Software")
         ======================================================== */}
      <div
        style={{
          position: 'absolute',
          left: isVertical ? '50%' : 89 * scale,
          top: isVertical ? 140 * scale : '50%',
          transform: isVertical ? 'translateX(-50%)' : 'translateY(-50%)',
          width: isVertical ? width - 80 * scale : 680 * scale,
          display: 'flex',
          flexDirection: 'column',
          alignItems: isVertical ? 'center' : 'flex-start',
          textAlign: isVertical ? 'center' : 'left',
          zIndex: 30,
        }}
      >
        {/* Main Title Line 1: "App Design" */}
        <SceneItem
          id="txt_title_main"
          defaultStart={8}
          defaultDuration={142}
          springConfig={{ damping: 14, stiffness: 95, mass: 0.85 }}
        >
          {({ springVal, opacity }) => (
            <div
              style={{
                fontFamily: fontMontserrat,
                fontSize: (isVertical ? 72 : getSceneFontSize('txt_title_main', 104)) * scale,
                fontWeight: 800,
                color: getSceneColor('txt_title_main', '#ffffff'),
                letterSpacing: '-0.025em',
                lineHeight: 1.08,
                opacity,
                transform: `translateY(${(1 - springVal) * 45}px)`,
                textShadow:
                  '0 12px 35px rgba(0, 0, 0, 0.6), 0 0 45px rgba(255, 255, 255, 0.12)',
              }}
            >
              {getSceneText('txt_title_main')}
            </div>
          )}
        </SceneItem>

        {/* Main Title Line 2: "Software" */}
        <SceneItem
          id="txt_title_sub"
          defaultStart={15}
          defaultDuration={135}
          springConfig={{ damping: 14, stiffness: 95, mass: 0.85 }}
        >
          {({ springVal, opacity }) => (
            <div
              style={{
                fontFamily: fontMontserrat,
                fontSize: (isVertical ? 72 : getSceneFontSize('txt_title_sub', 104)) * scale,
                fontWeight: 800,
                color: getSceneColor('txt_title_sub', '#ffffff'),
                letterSpacing: '-0.025em',
                lineHeight: 1.08,
                opacity,
                transform: `translateY(${(1 - springVal) * 45}px)`,
                textShadow:
                  '0 12px 35px rgba(0, 0, 0, 0.6), 0 0 45px rgba(255, 255, 255, 0.12)',
                marginTop: 8 * scale,
              }}
            >
              {getSceneText('txt_title_sub')}
            </div>
          )}
        </SceneItem>
      </div>

      {/* ========================================================
          3. Phone 1 (VR Experience - Left Phone)
         ======================================================== */}
      {(() => {
        const floatY1 = Math.sin((frame + 12) / 25) * 8;
        const leftPos = isVertical ? width * 0.08 : 842 * scale;
        const topPos = isVertical ? height * 0.44 : 217 * scale;
        const scaleMod = isVertical ? 0.78 : 1;

        return (
          <SceneItem
            id="card_phone_left"
            defaultStart={18}
            defaultDuration={132}
            springConfig={{ damping: 14, stiffness: 90, mass: 0.9 }}
            style={{
              position: 'absolute',
              left: leftPos,
              top: topPos,
              width: p1Width * scaleMod,
              height: p1Height * scaleMod,
              zIndex: 15,
            }}
          >
            {({ springVal, opacity }) => {
              const shimmerX = interpolate(
                frame,
                [24, 60],
                [-120, 220],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );

              return (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    opacity,
                    transform: `translateY(${(1 - springVal) * 120 + floatY1}px) scale(${0.88 + springVal * 0.12}) rotate(${(1 - springVal) * -4}deg)`,
                    transformOrigin: 'center center',
                    position: 'relative',
                  }}
                >
                  {/* Subtle rim backlight */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: -15 * scale,
                      borderRadius: 56 * scale,
                      background: 'radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, rgba(16, 152, 149, 0.25) 50%, transparent 75%)',
                      filter: 'blur(22px)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Phone Chassis */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 44 * scale * scaleMod,
                      overflow: 'hidden',
                      border: `${1.5 * scale}px solid rgba(255, 255, 255, 0.18)`,
                      boxShadow:
                        '0 35px 80px -15px rgba(0, 0, 0, 0.8), 0 10px 30px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
                      backgroundColor: '#000000',
                    }}
                  >
                    <Img
                      src={staticFile('images/mockups/phone1_vr.png')}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />

                    {/* Glass Shimmer Reflection */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        background:
                          'linear-gradient(115deg, transparent 0%, rgba(255, 255, 255, 0) 35%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0) 65%, transparent 100%)',
                        transform: `translateX(${shimmerX}%)`,
                      }}
                    />
                  </div>
                </div>
              );
            }}
          </SceneItem>
        );
      })()}

      {/* ========================================================
          4. Phone 2 (Movie Browse - Center Hero Phone)
         ======================================================== */}
      {(() => {
        const floatY2 = Math.sin(frame / 22) * 10;
        const leftPos = isVertical ? width * 0.5 - (p2Width * 0.95) / 2 : 1273 * scale;
        const topPos = isVertical ? height * 0.38 : 118 * scale;
        const scaleMod = isVertical ? 0.95 : 1;

        return (
          <SceneItem
            id="card_phone_center"
            defaultStart={26}
            defaultDuration={124}
            springConfig={{ damping: 13, stiffness: 95, mass: 0.9 }}
            style={{
              position: 'absolute',
              left: leftPos,
              top: topPos,
              width: p2Width * scaleMod,
              height: p2Height * scaleMod,
              zIndex: 25,
            }}
          >
            {({ springVal, opacity }) => {
              const shimmerX = interpolate(
                frame,
                [32, 68],
                [-120, 220],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );

              return (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    opacity,
                    transform: `translateY(${(1 - springVal) * 140 + floatY2}px) scale(${0.86 + springVal * 0.14})`,
                    transformOrigin: 'center center',
                    position: 'relative',
                  }}
                >
                  {/* Majestic Cyan Halo Glow behind Hero Phone */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: -25 * scale,
                      borderRadius: 60 * scale,
                      background: 'radial-gradient(circle, rgba(16, 152, 149, 0.42) 0%, rgba(6, 182, 212, 0.22) 50%, transparent 75%)',
                      filter: 'blur(30px)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Phone Chassis */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 44 * scale * scaleMod,
                      overflow: 'hidden',
                      border: `${1.5 * scale}px solid rgba(255, 255, 255, 0.22)`,
                      boxShadow:
                        '0 40px 90px -10px rgba(0, 0, 0, 0.85), 0 15px 35px rgba(0, 0, 0, 0.7), inset 0 1.5px 1px rgba(255, 255, 255, 0.35)',
                      backgroundColor: '#000000',
                    }}
                  >
                    <Img
                      src={staticFile('images/mockups/phone2_movies.png')}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />

                    {/* Glass Shimmer Reflection */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        background:
                          'linear-gradient(115deg, transparent 0%, rgba(255, 255, 255, 0) 35%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0) 65%, transparent 100%)',
                        transform: `translateX(${shimmerX}%)`,
                      }}
                    />
                  </div>
                </div>
              );
            }}
          </SceneItem>
        );
      })()}

      {/* ========================================================
          5. Phone 3 (Movie Detail - Right Phone)
         ======================================================== */}
      {(() => {
        const floatY3 = Math.sin((frame + 28) / 28) * 7;
        const leftPos = isVertical ? width * 0.72 : 1705 * scale;
        const topPos = isVertical ? height * 0.45 : 217 * scale;
        const scaleMod = isVertical ? 0.78 : 1;

        return (
          <SceneItem
            id="card_phone_right"
            defaultStart={34}
            defaultDuration={116}
            springConfig={{ damping: 14, stiffness: 90, mass: 0.9 }}
            style={{
              position: 'absolute',
              left: leftPos,
              top: topPos,
              width: p3Width * scaleMod,
              height: p3Height * scaleMod,
              zIndex: 12,
            }}
          >
            {({ springVal, opacity }) => {
              const shimmerX = interpolate(
                frame,
                [40, 76],
                [-120, 220],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );

              return (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    opacity,
                    transform: `translateY(${(1 - springVal) * 110 + floatY3}px) scale(${0.88 + springVal * 0.12}) rotate(${(1 - springVal) * 3}deg)`,
                    transformOrigin: 'left center',
                    position: 'relative',
                  }}
                >
                  {/* Subtle purple rim backlight */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: -15 * scale,
                      borderRadius: 56 * scale,
                      background: 'radial-gradient(circle, rgba(141, 68, 191, 0.3) 0%, transparent 70%)',
                      filter: 'blur(22px)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Phone Chassis (rounded left corners) */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderTopLeftRadius: 44 * scale * scaleMod,
                      borderBottomLeftRadius: 44 * scale * scaleMod,
                      overflow: 'hidden',
                      borderLeft: `${1.5 * scale}px solid rgba(255, 255, 255, 0.18)`,
                      borderTop: `${1.5 * scale}px solid rgba(255, 255, 255, 0.18)`,
                      borderBottom: `${1.5 * scale}px solid rgba(255, 255, 255, 0.18)`,
                      boxShadow:
                        '0 35px 80px -15px rgba(0, 0, 0, 0.8), 0 10px 30px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
                      backgroundColor: '#000000',
                    }}
                  >
                    <Img
                      src={staticFile('images/mockups/phone3_details.png')}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />

                    {/* Glass Shimmer Reflection */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        background:
                          'linear-gradient(115deg, transparent 0%, rgba(255, 255, 255, 0) 35%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0) 65%, transparent 100%)',
                        transform: `translateX(${shimmerX}%)`,
                      }}
                    />
                  </div>
                </div>
              );
            }}
          </SceneItem>
        );
      })()}
    </AbsoluteFill>
  );
};

export default Scene;
