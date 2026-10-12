// ============================================================
// afterAi Custom Agent Engine (BYOK: OpenRouter / DeepSeek / Claude / OpenAI)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { computeFileDiff } from './diffEngine.mjs';

const MOTION_DIRECTOR_SYSTEM_PROMPT = `# afterAi Motion Graphics & Remotion Architecture Standards

You are afterAi, an elite motion graphics director and senior Remotion / React engineer.
Your core mission is to craft agency-grade, visually stunning, physics-driven video scenes in \`src/Scene.tsx\` and \`src/scene-data.json\` that rival top-tier Adobe After Effects productions.

## 1. Single Source of Truth & Remotion Architecture Contract
- \`src/scene-data.json\` stores metadata (texts, cards, startFrame, durationInFrames, colors, transforms, holdToEnd, audio). It is NEVER a graphics renderer.
- Every visual element, background, card, button, and animation MUST be coded as explicit React JSX in \`src/Scene.tsx\`.
- When adding or modifying visual elements, NEVER merely update \`scene-data.json\` without writing the corresponding JSX in \`src/Scene.tsx\`.
- Dynamic connection contract in \`src/Scene.tsx\`:
  \`\`\`tsx
  import importedSceneData from './scene-data.json';
  export const Scene: React.FC<{ sceneData?: any }> = ({ sceneData: propData }) => {
    const activeData = propData || importedSceneData;
    // Helper functions derive live state from activeData
  };
  \`\`\`
- Maintain unified timeline tracks: interactive compound elements (buttons, cards) form a single track combining container, icon, and text. Never split a button into disjoint tracks.

## 2. On-Canvas Free Transform Gizmo Integration
- Every text or card element defined in \`src/scene-data.json\` MUST be wrapped in \`Scene.tsx\` with an outer container bearing \`data-scene-id="{id}"\` and \`style={getSceneTransform('{id}')}\`.
- Helper implementation:
  \`\`\`tsx
  const getSceneTransform = (id: string): React.CSSProperties => {
    const item = findElement(id);
    const t = item?.transform;
    if (!t) return {};
    const x = typeof t.x === 'number' ? t.x : 0;
    const y = typeof t.y === 'number' ? t.y : 0;
    const scaleMultiplier = typeof t.scale === 'number' ? t.scale : 1;
    const rotationDeg = typeof t.rotation === 'number' ? t.rotation : 0;
    return {
      transform: \`translate(\${(x / 100) * width}px, \${(y / 100) * height}px) rotate(\${rotationDeg}deg) scale(\${scaleMultiplier})\`,
      transformOrigin: 'center center',
    };
  };
  \`\`\`
- STRICT RULE: NEVER delete, reset, or overwrite existing \`transform\` properties in \`src/scene-data.json\`.

## 3. Procedural Animated Backgrounds (SVG & Math in Scene.tsx)
- When an animated background, organic contour lines, topographic patterns, flowing waves, particle constellations, cybernetic grids, or visual styling from reference images is requested:
  1. Implement procedural SVG bezier curves (\`<svg>\`, \`<path d="...">\`) or canvas elements directly inside the root \`<AbsoluteFill>\` layer in \`src/Scene.tsx\`.
  2. Modulate wave and contour geometry smoothly using \`Math.sin(frame * speed + offset)\` or smooth mathematical noise.
  3. Keep the scene alive with subtle, continuous ambient floating motion (ambient drift, soft glowing radial orbs, mesh gradients with \`filter: 'blur(70px)'\`).
  4. NEVER add a card ID to \`scene-data.json\` and assume it renders itself without writing JSX in \`Scene.tsx\`.

## 4. Motion Physics & Remotion Engineering Standards
- NEVER use CSS \`@keyframes\` or CSS \`transition\`. Use Remotion's \`spring()\` and \`interpolate()\` exclusively.
- Recommended spring physics:
  - Snappy Entrance: \`{ damping: 14, stiffness: 120, mass: 0.8 }\`
  - Elastic Pop: \`{ damping: 10, stiffness: 150, mass: 0.6 }\`
  - Cinematic Luxury Smooth: \`{ damping: 20, stiffness: 70, mass: 1.2 }\`
- Remotion Safety: In \`interpolate(frame, inputRange, outputRange)\`, \`inputRange\` values MUST be strictly monotonically increasing. NEVER pass identical values (e.g. \`[360, 360]\`), which causes a fatal Remotion player crash.
- Safe Opacity Helper:
  \`\`\`tsx
  const getElementOpacity = (start: number, duration: number, springVal: number, isDeleted?: boolean, fadeDuration: number = 8) => {
    if (isDeleted || frame < start || frame >= start + duration) return 0;
    if (fadeDuration <= 0) return springVal;
    const end = start + duration;
    const fadeLen = Math.min(fadeDuration, Math.max(1, Math.floor(duration / 2)));
    const exitFade = interpolate(frame, [end - fadeLen, end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return springVal * exitFade;
  };
  \`\`\`
- Always stagger element entrances by 3 to 6 frames (\`delay = index * 4\`).
- Multi-Aspect Ratio Intelligence: calculate responsive metrics using \`useVideoConfig()\`:
  \`\`\`tsx
  const { width, height } = useVideoConfig();
  const isVertical = height > width;
  const scale = Math.min(width / 1920, height / 1080);
  \`\`\`

## 5. Visual Polish, Typography & Aesthetic Standards
- Cinematic dark palette: Obsidian (\`#070709\`), Graphite (\`#0d0e12\`), Midnight Indigo (\`#050811\`).
- Cairo Arabic font with heavy weights (700, 800, 900) for impactful Arabic typography.
- Glassmorphic cards: \`backgroundColor: 'rgba(255, 255, 255, 0.03)'\`, \`backdropFilter: 'blur(24px)'\`, \`border: '1px solid rgba(255, 255, 255, 0.12)'\`.
- Dynamic counter numbers: interpolate frame to target value and format with \`Math.round(val)\`.
- STRICT ZERO-EMOJI POLICY: NEVER use emojis anywhere in video text, cards, buttons, or badges. Use handcrafted SVG vector icons, growth arrows, checkmark shields, corner HUD brackets (\`⌜ ⌝ ⌞ ⌟\`), and geometric shapes.

## 6. Strict User Feedback Handling & Zero-Diff Hallucination Prohibition
- If the user says an element did not appear, the background was not changed, or requests an adjustment:
  1. DO NOT simply run check commands (\`npm run check\`) and claim success while making 0 code changes.
  2. Inspect \`src/Scene.tsx\` immediately using file reading tools to locate the missing JSX.
  3. Modify \`src/Scene.tsx\` directly to implement and render the requested feature.
  4. Conclude your turn with success only after verifying that real code diffs were applied to the scene.
  5. Always verify code with \`npm run check\` before concluding.

## 7. Communication & Language Mirroring Policy
- STRICT RULE: Always reply, explain your reasoning, and communicate in the EXACT SAME LANGUAGE the user writes their prompt in.
- If the user prompts in English, reply entirely in English.
- If the user prompts in Arabic, reply in Arabic.
- Never force Arabic on an English-speaking user, and vice versa.
- In chat responses, summarize the artistic direction and visual changes with elegance, conciseness, and clarity.`;

// Tool schemas for LLM function calling
const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'view_file',
      description: 'View the contents of a file from the workspace (e.g. src/Scene.tsx or src/scene-data.json).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative or absolute file path to read (e.g. "src/Scene.tsx").',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write complete new code content to a file in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative or absolute file path to write (e.g. "src/Scene.tsx").',
          },
          content: {
            type: 'string',
            description: 'The complete code content to write to the file.',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_file_content',
      description: 'Replace a specific block of text in an existing file.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative file path (e.g. "src/Scene.tsx").',
          },
          target: {
            type: 'string',
            description: 'The exact string snippet to be replaced.',
          },
          replacement: {
            type: 'string',
            description: 'The new string to replace the target with.',
          },
        },
        required: ['path', 'target', 'replacement'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_check',
      description: 'Run "npm run check" in the template directory to verify TypeScript and Remotion validity.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

/**
 * Resolve endpoint and auth headers for a given provider
 */
function resolveProviderEndpoint(provider, apiKey, customBaseUrl) {
  const norm = (provider || 'openrouter').toLowerCase();

  if (norm === 'openrouter') {
    return {
      baseUrl: 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://afterai.com',
        'X-Title': 'afterAi',
      },
    };
  }

  if (norm === 'google' || norm === 'google_ai_studio' || norm === 'gemini') {
    return {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    };
  }

  if (norm === 'deepseek') {
    return {
      baseUrl: 'https://api.deepseek.com/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };
  }

  if (norm === 'openai') {
    return {
      baseUrl: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };
  }

  if (norm === 'custom' && customBaseUrl) {
    return {
      baseUrl: customBaseUrl.replace(/\/+$/, ''),
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };
  }

  // Default fallback to OpenRouter
  return {
    baseUrl: 'https://openrouter.ai/api/v1',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://afterai.com',
      'X-Title': 'afterAi',
    },
  };
}

/**
 * Execute a local tool safely inside template directory
 */
function executeLocalTool(templateDir, toolName, args) {
  if (toolName === 'view_file') {
    const targetPath = path.isAbsolute(args.path)
      ? args.path
      : path.resolve(templateDir, args.path);
    if (!fs.existsSync(targetPath)) {
      return `Error: File not found at "${args.path}"`;
    }
    return fs.readFileSync(targetPath, 'utf8');
  }

  if (toolName === 'write_file') {
    const targetPath = path.isAbsolute(args.path)
      ? args.path
      : path.resolve(templateDir, args.path);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, args.content, 'utf8');
    return `Success: Wrote ${args.content.length} characters to "${args.path}".`;
  }

  if (toolName === 'replace_file_content') {
    const targetPath = path.isAbsolute(args.path)
      ? args.path
      : path.resolve(templateDir, args.path);
    if (!fs.existsSync(targetPath)) {
      return `Error: File not found at "${args.path}"`;
    }
    const current = fs.readFileSync(targetPath, 'utf8');
    if (!current.includes(args.target)) {
      return `Error: Target string not found in "${args.path}".`;
    }
    const updated = current.replace(args.target, args.replacement);
    fs.writeFileSync(targetPath, updated, 'utf8');
    return `Success: Replaced target in "${args.path}".`;
  }

  if (toolName === 'run_check') {
    try {
      const output = execSync('npm run check', {
        cwd: templateDir,
        encoding: 'utf8',
        timeout: 15000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return `Check passed successfully:\n${output.trim()}`;
    } catch (err) {
      const errText = ((err.stdout || '') + (err.stderr || '')) || err.message || '';
      return `Check detected errors:\n${errText.trim()}`;
    }
  }

  return `Error: Unknown tool "${toolName}"`;
}

/**
 * Human-readable Arabic tool action labels for the UI
 */
function getActionLabel(toolName, args) {
  if (toolName === 'view_file') return `قراءة الملف: ${args.path || 'Scene.tsx'}`;
  if (toolName === 'write_file') return `كتابة كود: ${args.path || 'Scene.tsx'}`;
  if (toolName === 'replace_file_content') return `تعديل محدد في: ${args.path || 'Scene.tsx'}`;
  if (toolName === 'run_check') return 'فحص كود المشهد والتحقق البرمجي';
  return 'تنفيذ أمر برمجي';
}

/**
 * Execute chat turn using Custom API Agent
 */
export async function runCustomAgentTurn({
  prompt,
  provider = 'openrouter',
  apiKey,
  modelId = 'anthropic/claude-3.5-sonnet',
  customBaseUrl,
  templateDir,
  sessionId,
  sendEvent,
  signal,
}) {
  const { baseUrl, headers } = resolveProviderEndpoint(provider, apiKey, customBaseUrl);

  const activeScenePath = path.join(templateDir, 'src/Scene.tsx');
  const activeSceneDataPath = path.join(templateDir, 'src/scene-data.json');

  const preSnapshot = {
    sceneCode: fs.existsSync(activeScenePath) ? fs.readFileSync(activeScenePath, 'utf8') : '',
    sceneData: fs.existsSync(activeSceneDataPath) ? fs.readFileSync(activeSceneDataPath, 'utf8') : '',
  };

  sendEvent('start', {
    message: `بدء تشغيل وكيل afterAi المخصص (${provider} • ${modelId})...`,
    timestamp: Date.now(),
  });

  const conversation = [
    { role: 'system', content: MOTION_DIRECTOR_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  const MAX_TURNS = 10;
  let turnCount = 0;
  let finalResponse = '';

  while (turnCount < MAX_TURNS) {
    if (signal?.aborted) {
      sendEvent('stderr', { text: 'Turn cancelled by user.' });
      break;
    }
    turnCount++;

    const payload = {
      model: modelId,
      messages: conversation,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
      stream: false,
    };

    let currentModel = payload.model;
    let apiRes;
    try {
      apiRes = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...payload, model: currentModel }),
        signal,
      });

      // If Google returns 503 (high demand) or 429 (quota), fall back automatically to gemini-3.6-flash or gemini-3.5-flash-lite
      const isGoogle = (provider === 'google' || provider === 'google_ai_studio' || provider === 'gemini');
      if (isGoogle && (apiRes.status === 503 || apiRes.status === 429)) {
        console.warn(`[CustomAgent] Model ${currentModel} returned ${apiRes.status}. Falling back to gemini-3.6-flash...`);
        sendEvent('stderr', { text: `تنبيه: النموذج ${currentModel} يواجه ضغطاً في خوادم Google (${apiRes.status} High Demand). جاري المتابعة تلقائياً عبر gemini-3.6-flash...` });
        currentModel = 'gemini-3.6-flash';
        apiRes = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...payload, model: currentModel }),
          signal,
        });
        if (apiRes.status === 503 || apiRes.status === 429) {
          console.warn(`[CustomAgent] gemini-3.6-flash returned ${apiRes.status}. Falling back to gemini-3.5-flash-lite...`);
          currentModel = 'gemini-3.5-flash-lite';
          apiRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...payload, model: currentModel }),
            signal,
          });
        }
      }
    } catch (fetchErr) {
      if (signal?.aborted) return;
      sendEvent('stderr', { text: `خطأ في الاتصال بالشبكة: ${fetchErr.message}` });
      throw fetchErr;
    }

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      let friendlyError = `خطأ في مزود الذكاء الاصطناعي [${apiRes.status}]`;
      try {
        const parsed = JSON.parse(errText);
        const msg = parsed.error?.message || (Array.isArray(parsed) && parsed[0]?.error?.message);
        if (msg) friendlyError += `: ${msg}`;
      } catch (_) {
        friendlyError += `: ${errText.slice(0, 200)}`;
      }
      sendEvent('stderr', { text: friendlyError });
      sendEvent('error', { message: friendlyError });
      throw new Error(friendlyError);
    }

    const data = await apiRes.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message) {
      break;
    }

    conversation.push(message);

    // If message contains content, emit it
    if (message.content) {
      finalResponse += message.content;
      sendEvent('agy_event', {
        event: 'step_update',
        step_update: {
          step_type: 'agent_response',
          step_index: turnCount,
          text: message.content,
        },
      });
    }

    // Check for tool calls
    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      for (const call of message.tool_calls) {
        if (signal?.aborted) break;

        const toolName = call.function.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(call.function.arguments || '{}');
        } catch (_) {}

        const actionTitle = getActionLabel(toolName, toolArgs);

        sendEvent('tool_event', {
          toolName,
          actionTitle,
          target: toolArgs.path || 'workspace',
          state: 'ACTIVE',
          stepIndex: turnCount,
        });

        // Execute tool
        const toolResult = executeLocalTool(templateDir, toolName, toolArgs);

        sendEvent('tool_event', {
          toolName,
          actionTitle,
          target: toolArgs.path || 'workspace',
          state: 'COMPLETED',
          stepIndex: turnCount,
        });

        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: String(toolResult),
        });
      }
    } else {
      // No more tool calls, turn loop ends
      break;
    }
  }

  // Compute diffs for modified scene files
  const postSceneCode = fs.existsSync(activeScenePath) ? fs.readFileSync(activeScenePath, 'utf8') : '';
  const postSceneData = fs.existsSync(activeSceneDataPath) ? fs.readFileSync(activeSceneDataPath, 'utf8') : '';

  const diffSummaries = [];
  if (preSnapshot.sceneCode !== postSceneCode) {
    const sceneDiff = computeFileDiff(preSnapshot.sceneCode, postSceneCode, 'src/Scene.tsx');
    if (sceneDiff.changed) diffSummaries.push(sceneDiff);
  }
  if (preSnapshot.sceneData !== postSceneData) {
    const dataDiff = computeFileDiff(preSnapshot.sceneData, postSceneData, 'src/scene-data.json');
    if (dataDiff.changed) diffSummaries.push(dataDiff);
  }

  let verificationResult = null;
  if (diffSummaries.length > 0) {
    sendEvent('diff_summary', { diffs: diffSummaries });

    try {
      const checkOutput = execSync('npm run check', {
        cwd: templateDir,
        encoding: 'utf8',
        timeout: 20000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      verificationResult = {
        passed: true,
        message: 'تم فحص كود المشهد بنجاح وتأكيد خلوه من أي أخطاء برمجية',
        output: (checkOutput || '').trim(),
      };
    } catch (checkErr) {
      const errText = ((checkErr.stdout || '') + (checkErr.stderr || '')) || checkErr.message || '';
      const errorLines = errText.trim().split('\n').filter(Boolean).slice(0, 8);
      verificationResult = {
        passed: false,
        message: 'تنبيه: تم رصد أخطاء أثناء فحص المشهد',
        errors: errorLines,
      };
    }
    sendEvent('verification_result', verificationResult);
  }

  sendEvent('done', {
    exitCode: 0,
    error: null,
    timestamp: Date.now(),
  });

  return {
    response: finalResponse,
    diffSummaries,
    verificationResult,
  };
}

/**
 * Fast test connection check for user-supplied API key and model
 */
export async function testProviderConnection({
  provider = 'openrouter',
  apiKey,
  modelId = 'liquid/lfm-2.5-2.6b:free',
  customBaseUrl,
}) {
  try {
    const { baseUrl, headers } = resolveProviderEndpoint(provider, apiKey, customBaseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    let activeTestModel = modelId;
    let res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: activeTestModel,
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });

    const isGoogle = (provider === 'google' || provider === 'google_ai_studio' || provider === 'gemini');
    if (isGoogle && (res.status === 503 || res.status === 429)) {
      activeTestModel = 'gemini-3.6-flash';
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: activeTestModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
    }

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `خطأ [${res.status}]: ${errText.slice(0, 200)}` };
    }

    return { ok: true, model: activeTestModel };
  } catch (err) {
    return { ok: false, error: err.message || 'فشل الاتصال بمزود الذكاء الاصطناعي' };
  }
}
