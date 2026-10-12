import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templateRoot = path.resolve(__dirname, '..');

const sceneDataPath = path.join(templateRoot, 'src', 'scene-data.json');
const sceneTsxPath = path.join(templateRoot, 'src', 'Scene.tsx');

let hasErrors = false;
function reportError(msg) {
  console.error(`[VALIDATION ERROR] ${msg}`);
  hasErrors = true;
}

if (!fs.existsSync(sceneDataPath)) {
  reportError(`Missing scene-data.json at ${sceneDataPath}`);
  process.exit(1);
}

if (!fs.existsSync(sceneTsxPath)) {
  reportError(`Missing Scene.tsx at ${sceneTsxPath}`);
  process.exit(1);
}

let sceneData;
try {
  sceneData = JSON.parse(fs.readFileSync(sceneDataPath, 'utf8'));
} catch (err) {
  reportError(`Failed to parse scene-data.json: ${err.message}`);
  process.exit(1);
}

const SCENE_DURATION = sceneData.durationInFrames || 180;

function checkElementTiming(list, typeName) {
  if (!Array.isArray(list)) {
    reportError(`scene-data.json "${typeName}" must be an array.`);
    return;
  }

  const trackBuckets = new Map();

  for (const item of list) {
    if (!item.id || typeof item.id !== 'string') {
      reportError(`${typeName} item has invalid or missing id: ${JSON.stringify(item)}`);
    }
    if (typeof item.startFrame !== 'number' || item.startFrame < 0) {
      reportError(`${typeName} "${item.id}" has invalid startFrame: ${item.startFrame}`);
    }
    if (typeof item.durationInFrames !== 'number' || item.durationInFrames <= 0) {
      reportError(`${typeName} "${item.id}" has invalid durationInFrames: ${item.durationInFrames}`);
    }

    if (item.transform) {
      const t = item.transform;
      if (typeof t !== 'object' || t === null) {
        reportError(`${typeName} "${item.id}" transform must be an object.`);
      } else {
        const { x, y, scale, rotation } = t;
        if (typeof x !== 'number' || !Number.isFinite(x) || x < -200 || x > 200) {
          reportError(`${typeName} "${item.id}" transform.x must be a number between -200 and 200. Got: ${x}`);
        }
        if (typeof y !== 'number' || !Number.isFinite(y) || y < -200 || y > 200) {
          reportError(`${typeName} "${item.id}" transform.y must be a number between -200 and 200. Got: ${y}`);
        }
        if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < 0.1 || scale > 10) {
          reportError(`${typeName} "${item.id}" transform.scale must be a number between 0.1 and 10. Got: ${scale}`);
        }
        if (typeof rotation !== 'number' || !Number.isFinite(rotation) || rotation < -360 || rotation > 360) {
          reportError(`${typeName} "${item.id}" transform.rotation must be a number between -360 and 360. Got: ${rotation}`);
        }
      }
    }

    if (item.isDeleted) continue;

    const track = typeof item.track === 'number' ? item.track : 0;
    if (!trackBuckets.has(track)) {
      trackBuckets.set(track, []);
    }
    trackBuckets.get(track).push(item);
  }

  for (const [track, items] of trackBuckets.entries()) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];

        const aStart = a.startFrame;
        const aDur = a.holdToEnd ? Math.max(1, SCENE_DURATION - aStart) : a.durationInFrames;
        const aEnd = aStart + aDur;

        const bStart = b.startFrame;
        const bDur = b.holdToEnd ? Math.max(1, SCENE_DURATION - bStart) : b.durationInFrames;
        const bEnd = bStart + bDur;

        if (Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
          reportError(
            `Track collision detected in ${typeName} on track ${track}: "${a.id}" [${aStart}..${aEnd}] overlaps with "${b.id}" [${bStart}..${bEnd}]`
          );
        }
      }
    }
  }
}

checkElementTiming(sceneData.texts || [], 'texts');
checkElementTiming(sceneData.cards || [], 'cards');

const knownIds = new Set();
for (const t of sceneData.texts || []) {
  if (t.id) knownIds.add(t.id);
}
for (const c of sceneData.cards || []) {
  if (c.id) knownIds.add(c.id);
}

const sceneTsxContent = fs.readFileSync(sceneTsxPath, 'utf8');

const idRefRegex = /(?:findElement|getSceneText|getSceneColor|getSceneFontSize|getSceneStartFrame|getSceneDuration|getSceneTransform|isSceneElementDeleted)\(\s*['"]([^'"]+)['"]|<SceneItem\b[^>]*\bid=['"]([^'"]+)['"]/g;
let match;
const referencedIds = new Set();
while ((match = idRefRegex.exec(sceneTsxContent)) !== null) {
  const ref = match[1] || match[2];
  if (ref) referencedIds.add(ref);
}

for (const refId of referencedIds) {
  if (!knownIds.has(refId)) {
    reportError(`Scene.tsx references element id "${refId}", but it is not defined in scene-data.json`);
  }
}

// Check for data-scene-id tags or SceneItem components in Scene.tsx
const dataSceneIdRegex = /(?:data-scene-id=['"]([^'"]+)['"]|<SceneItem\b[^>]*\bid=['"]([^'"]+)['"])/g;
const sceneDomIds = new Set();
let domMatch;
while ((domMatch = dataSceneIdRegex.exec(sceneTsxContent)) !== null) {
  const domId = domMatch[1] || domMatch[2];
  if (domId) sceneDomIds.add(domId);
}

for (const id of knownIds) {
  if (!sceneDomIds.has(id)) {
    console.warn(`[VALIDATION WARNING] Element "${id}" is defined in scene-data.json but lacks a data-scene-id wrapper in Scene.tsx (On-Canvas Gizmo will not be able to interact with it).`);
  }
}

// Check for direct raw Arabic text in JSX children (which would bypass scene-data.json)
const arabicRegex = /[\u0600-\u06FF]/;
const lines = sceneTsxContent.split('\n');
for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
  const line = lines[lineNum - 1];
  // Skip comment lines
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    continue;
  }
  if (arabicRegex.test(line)) {
    reportError(`Scene.tsx line ${lineNum} contains hardcoded Arabic text outside comments: "${trimmed}". All text must come from scene-data.json via getSceneText().`);
  }
}

if (hasErrors) {
  console.error('\nScene data validation FAILED. Correct the errors above before continuing.');
  process.exit(1);
} else {
  console.log(`Scene data validation PASSED: verified ${knownIds.size} elements across ${referencedIds.size} references.`);
}
