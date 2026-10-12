import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templateRoot = path.resolve(__dirname, '..');

const sceneDataPath = path.join(templateRoot, 'src', 'scene-data.json');

if (!fs.existsSync(sceneDataPath)) {
  console.error('[TIMING TEST ERROR] Missing scene-data.json');
  process.exit(1);
}

const sceneData = JSON.parse(fs.readFileSync(sceneDataPath, 'utf8'));
const SCENE_DURATION = Number(sceneData.durationInFrames) || 240;

const allElements = [
  ...(Array.isArray(sceneData.texts) ? sceneData.texts.map((t) => ({ ...t, kind: 'text' })) : []),
  ...(Array.isArray(sceneData.cards) ? sceneData.cards.map((c) => ({ ...c, kind: 'card' })) : []),
];

let failedTests = 0;
let passedTests = 0;

function isElementVisibleAtFrame(item, frame) {
  if (item.isDeleted) return false;
  const start = Number(item.startFrame) || 0;
  const holdToEnd = Boolean(item.holdToEnd);
  const duration = holdToEnd
    ? Math.max(1, SCENE_DURATION - start)
    : (Number(item.durationInFrames) || 1);
  const end = start + duration;

  return frame >= start && frame < end;
}

console.log(`[TIMING ACCURACY TEST] Testing ${allElements.length} elements across ${SCENE_DURATION} frames...`);

for (const el of allElements) {
  if (el.isDeleted) continue;

  const start = el.startFrame;
  const dur = el.durationInFrames;
  const holdToEnd = Boolean(el.holdToEnd);
  const end = holdToEnd ? SCENE_DURATION : start + dur;

  // Test 1: Before startFrame (if start > 0), element must be invisible
  if (start > 0) {
    const visibleBefore = isElementVisibleAtFrame(el, start - 1);
    if (visibleBefore) {
      console.error(`FAIL: ${el.kind} "${el.id}" is unexpectedly visible at frame ${start - 1} (before startFrame ${start})`);
      failedTests++;
    } else {
      passedTests++;
    }
  }

  // Test 2: At startFrame, element must be visible
  const visibleAtStart = isElementVisibleAtFrame(el, start);
  if (!visibleAtStart) {
    console.error(`FAIL: ${el.kind} "${el.id}" is NOT visible at startFrame ${start}`);
    failedTests++;
  } else {
    passedTests++;
  }

  // Test 3: Active during middle of lifespan
  const midFrame = Math.min(start + 10, start + Math.floor(dur / 2));
  if (midFrame < SCENE_DURATION) {
    const visibleAtMid = isElementVisibleAtFrame(el, midFrame);
    if (!visibleAtMid) {
      console.error(`FAIL: ${el.kind} "${el.id}" is NOT visible at middle frame ${midFrame}`);
      failedTests++;
    } else {
      passedTests++;
    }
  }

  // Test 4: After end frame, element must be invisible (if end < SCENE_DURATION)
  if (!holdToEnd && end < SCENE_DURATION) {
    const visibleAfter = isElementVisibleAtFrame(el, end);
    if (visibleAfter) {
      console.error(`FAIL: ${el.kind} "${el.id}" is unexpectedly visible at frame ${end} (at or after end ${end})`);
      failedTests++;
    } else {
      passedTests++;
    }
  }
}

if (failedTests > 0) {
  console.error(`\n[TIMING ACCURACY FAILED]: ${failedTests} tests failed, ${passedTests} passed.`);
  process.exit(1);
} else {
  console.log(`[TIMING ACCURACY PASSED]: All ${passedTests} timeline timing tests passed with frame-level precision.`);
}
