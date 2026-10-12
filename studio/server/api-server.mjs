import express from 'express';
import cors from 'cors';
import { spawn, exec, execSync } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as vite from 'vite';
import { computeFileDiff } from './diffEngine.mjs';
import { runCustomAgentTurn, testProviderConnection } from './customAgentEngine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env if present
function loadEnvFile(envPath) {
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (val) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      console.error('[API] Failed to parse .env at', envPath, e.message);
    }
  }
}

function loadAllEnvFiles() {
  loadEnvFile(path.join(__dirname, '../.env'));
  loadEnvFile(path.join(__dirname, '.env'));
  loadEnvFile(path.join(__dirname, '../../.env'));
}
loadAllEnvFiles();

const app = express();
const PORT = 3001;
const HOST = '127.0.0.1';

// ==========================================
// Security: Local-only access policy
// ==========================================
// Only the Studio UI (Vite dev server / Electron) and the API itself may talk to this server.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
]);
const ALLOWED_HOSTS = new Set([
  `localhost:${PORT}`,
  `127.0.0.1:${PORT}`,
  'localhost:3000',
  '127.0.0.1:3000',
]);

// Reject foreign Host headers (DNS rebinding) and foreign Origins (cross-site fetch / form CSRF).
// CORS headers alone are not enough: HTML form posts and "simple" requests bypass preflight.
app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return res.status(403).json({ error: 'Forbidden host' });
  }
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || ALLOWED_ORIGINS.has(origin)),
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Escape untrusted text before embedding it in server-rendered HTML
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Session IDs are generated as `session_<timestamp>` or `session_default`.
// Strict validation prevents path traversal (e.g. "..%2F..%2Fpackage") in file operations.
const SESSION_ID_PATTERN = /^session_[A-Za-z0-9_-]{1,64}$/;
function isValidSessionId(id) {
  return typeof id === 'string' && SESSION_ID_PATTERN.test(id);
}

// Applies to every route declaring `:id` (all are session routes)
app.param('id', (req, res, next, id) => {
  if (!isValidSessionId(id)) {
    return res.status(400).json({ error: 'Invalid session id' });
  }
  next();
});

function findAgyExecutable() {
  if (process.env.AGY_PATH && fs.existsSync(process.env.AGY_PATH)) {
    return process.env.AGY_PATH;
  }
  const appDataAgy = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
    'agy',
    'bin',
    process.platform === 'win32' ? 'agy.exe' : 'agy'
  );
  if (fs.existsSync(appDataAgy)) {
    return appDataAgy;
  }
  if (process.platform === 'win32') {
    const npmGlobalAgy = path.join(process.env.APPDATA || '', 'npm', 'agy.cmd');
    if (fs.existsSync(npmGlobalAgy)) {
      return npmGlobalAgy;
    }
  }
  const bundledPath = path.join(__dirname, '../bin', process.platform === 'win32' ? 'agy.exe' : 'agy');
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }
  return 'agy';
}

const AGY_EXECUTABLE = findAgyExecutable();

const isPackaged = process.env.AFTERAI_PACKAGED === 'true' || process.env.EFTERAI_PACKAGED === 'true' || process.env.NODE_ENV === 'production';

function getUserWorkspaceDir() {
  if (process.env.AFTERAI_USER_DATA) {
    return path.join(process.env.AFTERAI_USER_DATA, 'workspace');
  }
  if (process.env.EFTERAI_USER_DATA) {
    return path.join(process.env.EFTERAI_USER_DATA, 'workspace');
  }
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
  const newDir = path.join(appData, 'afterAi', 'workspace');
  const oldDir = path.join(appData, 'efterAi', 'workspace');
  if (fs.existsSync(newDir)) return newDir;
  if (fs.existsSync(oldDir)) return oldDir;
  return newDir;
}

function getBundledTemplateDir() {
  if (process.resourcesPath) {
    const p1 = path.join(process.resourcesPath, 'templates/motion-starter');
    if (fs.existsSync(p1)) return p1;
  }
  const p2 = path.resolve(__dirname, '../../templates/motion-starter');
  if (fs.existsSync(p2)) return p2;
  const p3 = path.resolve(__dirname, '../templates/motion-starter');
  if (fs.existsSync(p3)) return p3;
  return p2;
}

const BUNDLED_TEMPLATE_DIR = getBundledTemplateDir();
const WORKSPACE_DIR = isPackaged ? getUserWorkspaceDir() : path.resolve(__dirname, '../..');
const TEMPLATE_DIR = isPackaged ? path.join(WORKSPACE_DIR, 'templates/motion-starter') : path.resolve(__dirname, '../../templates/motion-starter');
const SESSIONS_DIR = isPackaged ? path.join(WORKSPACE_DIR, 'sessions') : path.resolve(__dirname, 'sessions');
const ACTIVE_SCENE_PATH = path.join(TEMPLATE_DIR, 'src/Scene.tsx');
const ACTIVE_SCENE_DATA_PATH = path.join(TEMPLATE_DIR, 'src/scene-data.json');
const STARTER_SCENE_PATH = path.join(TEMPLATE_DIR, 'src/Scene.starter.tsx');
const STARTER_SCENE_DATA_PATH = path.join(TEMPLATE_DIR, 'src/scene-data.starter.json');
const sceneDataUndoStack = [];
const MAX_UNDO_STACK_SIZE = 30;
const AUDIO_ASSETS_DIR = isPackaged ? path.join(WORKSPACE_DIR, 'audio_assets') : path.resolve(__dirname, 'audio_assets');
const AUDIO_UPLOADS_DIR = isPackaged ? path.join(WORKSPACE_DIR, 'audio_uploads') : path.resolve(__dirname, 'audio_uploads');
const PUBLIC_AUDIO_DIR = path.join(TEMPLATE_DIR, 'public/audio');
const PUBLIC_UPLOADS_DIR = path.join(PUBLIC_AUDIO_DIR, 'uploads');
const PUBLIC_IMAGES_DIR = path.join(TEMPLATE_DIR, 'public/images/uploads');
const CHAT_UPLOADS_DIR = isPackaged ? path.join(WORKSPACE_DIR, 'chat_uploads') : path.resolve(__dirname, 'chat_uploads');
const PUBLIC_VIDEOS_DIR = path.join(TEMPLATE_DIR, 'public/videos/uploads');
const CHAT_VIDEOS_DIR = isPackaged ? path.join(WORKSPACE_DIR, 'chat_videos') : path.resolve(__dirname, 'chat_videos');
const AUTH_FILE_PATH = isPackaged ? path.join(WORKSPACE_DIR, 'user-auth.json') : path.join(__dirname, 'user-auth.json');
const AGENT_CONFIG_PATH = isPackaged ? path.join(WORKSPACE_DIR, 'agent-config.json') : path.join(__dirname, 'agent-config.json');
const CACHED_MODELS_PATH = isPackaged ? path.join(WORKSPACE_DIR, 'cached-models.json') : path.join(__dirname, 'cached-models.json');


function bootstrapWorkspaceTemplate() {
  if (!isPackaged) return;
  const targetScene = path.join(TEMPLATE_DIR, 'src/Scene.tsx');
  if (!fs.existsSync(targetScene)) {
    console.log(`[Workspace] Bootstrapping starter template to user workspace: ${TEMPLATE_DIR}`);
    try {
      fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
      if (fs.existsSync(BUNDLED_TEMPLATE_DIR)) {
        fs.cpSync(BUNDLED_TEMPLATE_DIR, TEMPLATE_DIR, { recursive: true });
        console.log('[Workspace] Starter template copied successfully.');
      }
    } catch (err) {
      console.error('[Workspace] Error bootstrapping starter template:', err.message);
    }
  } else if (fs.existsSync(BUNDLED_TEMPLATE_DIR)) {
    // Keep GEMINI.md and AGENTS.md continuously synchronized with app updates
    const docFiles = ['GEMINI.md', 'AGENTS.md'];
    for (const docFile of docFiles) {
      const srcDoc = path.join(BUNDLED_TEMPLATE_DIR, docFile);
      const dstDoc = path.join(TEMPLATE_DIR, docFile);
      if (fs.existsSync(srcDoc)) {
        try {
          fs.copyFileSync(srcDoc, dstDoc);
        } catch (_) {}
      }
    }
  }

  // Ensure template has node_modules linked for tsc, npm run check, and Vite compilation
  const templateNodeModules = path.join(TEMPLATE_DIR, 'node_modules');
  if (!fs.existsSync(templateNodeModules)) {
    const candidates = [
      path.resolve(__dirname, '../node_modules'),
      path.resolve(__dirname, '../../node_modules'),
      path.resolve(__dirname, '../../templates/motion-starter/node_modules'),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        try {
          fs.symlinkSync(cand, templateNodeModules, 'junction');
          console.log(`[Workspace] Linked node_modules junction: ${templateNodeModules} -> ${cand}`);
          break;
        } catch (linkErr) {
          console.warn(`[Workspace] Could not link node_modules junction:`, linkErr.message);
        }
      }
    }
  }
}
bootstrapWorkspaceTemplate();

// Ensure directories exist
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}
if (!fs.existsSync(AUDIO_ASSETS_DIR)) {
  fs.mkdirSync(AUDIO_ASSETS_DIR, { recursive: true });
}
if (!fs.existsSync(AUDIO_UPLOADS_DIR)) {
  fs.mkdirSync(AUDIO_UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_AUDIO_DIR)) {
  fs.mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
  fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_IMAGES_DIR)) {
  fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
}
if (!fs.existsSync(CHAT_UPLOADS_DIR)) {
  fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_VIDEOS_DIR)) {
  fs.mkdirSync(PUBLIC_VIDEOS_DIR, { recursive: true });
}
if (!fs.existsSync(CHAT_VIDEOS_DIR)) {
  fs.mkdirSync(CHAT_VIDEOS_DIR, { recursive: true });
}

// Static Media Routes
app.use('/api/images/uploads', express.static(PUBLIC_IMAGES_DIR));
app.use('/api/chat-uploads', express.static(CHAT_UPLOADS_DIR));
app.use('/api/audio', express.static(PUBLIC_AUDIO_DIR));
app.use('/audio', express.static(PUBLIC_AUDIO_DIR));
app.use('/images', express.static(path.join(TEMPLATE_DIR, 'public/images')));
app.use('/api/videos/uploads', express.static(PUBLIC_VIDEOS_DIR));
app.use('/videos', express.static(path.join(TEMPLATE_DIR, 'public/videos')));

// Map of active agy child processes by sessionId
const activeChildProcesses = new Map();
// Map of active disconnect grace timers by sessionKey
const activeDisconnectTimers = new Map();
// Map of active custom agent abort controllers by sessionKey
const activeCustomAgentControllers = new Map();

function terminateSessionProcess(sessionKey, reason = 'Stop requested') {
  let stopped = false;

  const customController = activeCustomAgentControllers.get(sessionKey);
  if (customController) {
    console.log(`[API] Aborting custom agent for session ${sessionKey} (${reason})...`);
    customController.abort();
    activeCustomAgentControllers.delete(sessionKey);
    stopped = true;
  }

  const child = activeChildProcesses.get(sessionKey);
  if (child) {
    console.log(`[API] Terminating process for session ${sessionKey} (${reason}). PID ${child.pid}...`);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
      } else {
        child.kill('SIGKILL');
      }
    } catch (e) {
      console.error('[API] Failed to kill child process:', e.message);
    }
    activeChildProcesses.delete(sessionKey);
    stopped = true;
  }

  if (activeDisconnectTimers.has(sessionKey)) {
    clearTimeout(activeDisconnectTimers.get(sessionKey));
    activeDisconnectTimers.delete(sessionKey);
  }

  if (!stopped) return false;

  // Auto-save whatever was produced in Scene.tsx so far
  if (sessionKey && sessionKey !== 'default' && fs.existsSync(ACTIVE_SCENE_PATH)) {
    try {
      const sessionFile = path.join(SESSIONS_DIR, `${sessionKey}.json`);
      if (fs.existsSync(sessionFile)) {
        const sData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
        sData.sceneCode = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');
        if (fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
          try {
            sData.sceneData = JSON.parse(fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8'));
          } catch (_) {}
        }
        if (Array.isArray(sData.messages)) {
          const lastMsg = sData.messages[sData.messages.length - 1];
          if (lastMsg && lastMsg.sender === 'agent' && lastMsg.isStreaming) {
            delete lastMsg.isStreaming;
            if (!lastMsg.text || lastMsg.text.trim() === '') {
              lastMsg.text = 'تم إيقاف عملية التوليد أو انتهاء مهلة الاتصال.';
            }
          }
        }
        sData.updatedAt = Date.now();
        fs.writeFileSync(sessionFile, JSON.stringify(sData, null, 2), 'utf8');
      }
    } catch (err) {}
  }
  return true;
}

// Helper: Ensure at least one default session exists
function ensureDefaultSession() {
  const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    let currentCode = '';
    if (fs.existsSync(ACTIVE_SCENE_PATH)) {
      currentCode = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');
    } else if (fs.existsSync(STARTER_SCENE_PATH)) {
      currentCode = fs.readFileSync(STARTER_SCENE_PATH, 'utf8');
    }

    const defaultSession = {
      id: 'session_default',
      title: 'مشروع الفيديو الافتراضي',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'Claude Sonnet 4.6 (Thinking)',
      messages: [
        {
          id: 'welcome',
          sender: 'agent',
          text: 'مرحباً بك في استوديو Remotion الذكي.\n\nوكيل البرمجة متصل وجاهز لتعديل المشاهد وتطبيق الحركات الفيزيائية والانتقالات. اكتب توجيهك الإبداعي في الأسفل لتعديل كود المشهد والمعاينة فوراً.',
          timestamp: 'الآن',
        },
      ],
      sceneCode: currentCode,
    };

    fs.writeFileSync(
      path.join(SESSIONS_DIR, 'session_default.json'),
      JSON.stringify(defaultSession, null, 2),
      'utf8'
    );
  }
}

ensureDefaultSession();

// Health and Status Check
app.get('/api/status', (req, res) => {
  const agyExists = fs.existsSync(AGY_EXECUTABLE);
  const templateExists = fs.existsSync(TEMPLATE_DIR);
  res.json({
    status: 'ok',
    agyExecutable: AGY_EXECUTABLE,
    agyFound: agyExists,
    templateDir: TEMPLATE_DIR,
    templateFound: templateExists,
  });
});

// ==========================================
// Check for New Release on GitHub
// ==========================================
function compareSemver(latest, current) {
  if (!latest || !current) return false;
  const l = latest.replace(/^v/, '').split('.').map((p) => parseInt(p, 10) || 0);
  const c = current.replace(/^v/, '').split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lPart = l[i] || 0;
    const cPart = c[i] || 0;
    if (lPart > cPart) return true;
    if (lPart < cPart) return false;
  }
  return false;
}

app.get('/api/check-update', async (req, res) => {
  let currentVersion = '1.2.0';
  try {
    const pkgPath = path.join(__dirname, '../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) currentVersion = pkg.version;
    }
  } catch {}

  try {
    const ghRes = await fetch('https://api.github.com/repos/alabereche/afterAi/releases/latest', {
      headers: {
        'User-Agent': 'afterAi-Studio',
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!ghRes.ok) {
      return res.json({ hasUpdate: false, currentVersion });
    }

    const data = await ghRes.json();
    const latestVersion = (data.tag_name || '').replace(/^v/, '').trim();
    const releaseUrl = data.html_url || 'https://github.com/alabereche/afterAi/releases';
    const releaseName = data.name || data.tag_name || `v${latestVersion}`;
    const hasUpdate = compareSemver(latestVersion, currentVersion);

    return res.json({
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseName,
      releaseUrl,
      publishedAt: data.published_at,
    });
  } catch (err) {
    return res.json({ hasUpdate: false, currentVersion, error: err.message });
  }
});

// ==========================================
// System Prerequisites Verification & Installer
// ==========================================
function isSimulatedMissing(toolName) {
  // In production environments (bundled desktop app), simulation is strictly disabled
  if (process.env.NODE_ENV === 'production') return false;
  const envVal = (process.env.AFTERAI_SIMULATE_MISSING || '').toLowerCase();
  if (!envVal) return false;
  const parts = envVal.split(',').map((p) => p.trim());
  return parts.includes(toolName.toLowerCase());
}

function verifyAgyExecutable(exePath) {
  if (!exePath || !fs.existsSync(exePath)) {
    return { valid: false, version: null };
  }
  try {
    const verOut = execSync(`"${exePath}" --version`, {
      encoding: 'utf8',
      timeout: 4000,
      windowsHide: true,
    }).trim();
    if (!verOut) return { valid: false, version: null };

    const firstLine = verOut.split('\n')[0].trim();
    const isSemver = /^v?\d+\.\d+(\.\d+)?(-[\w.]+)?$/i.test(firstLine);
    const hasAgyInVer = /antigravity|agy/i.test(verOut);

    if (hasAgyInVer) {
      return { valid: true, version: firstLine };
    }

    if (isSemver) {
      try {
        const helpOut = execSync(`"${exePath}" --help`, {
          encoding: 'utf8',
          timeout: 4000,
          windowsHide: true,
        });
        if (/antigravity|agy|Usage of agy/i.test(helpOut)) {
          return { valid: true, version: firstLine };
        }
      } catch (_) {
        return { valid: true, version: firstLine };
      }
      const baseName = path.basename(exePath).toLowerCase();
      if (baseName === 'agy.exe' || baseName === 'agy.cmd' || baseName === 'agy') {
        return { valid: true, version: firstLine };
      }
    }
    return { valid: false, version: null };
  } catch (_) {
    return { valid: false, version: null };
  }
}

function checkNodeAvailability() {
  if (isSimulatedMissing('node')) {
    return { installed: false, version: null };
  }
  try {
    const stdout = execSync('node -v', { encoding: 'utf8', timeout: 3000, windowsHide: true });
    return { installed: true, version: stdout.trim() };
  } catch (_) {
    if (process.platform === 'win32') {
      const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const nodeExe = path.join(progFiles, 'nodejs', 'node.exe');
      if (fs.existsSync(nodeExe)) {
        return { installed: true, version: 'v20+' };
      }
    }
    return { installed: false, version: null };
  }
}

function checkAgyAvailability() {
  if (isSimulatedMissing('agy')) {
    return { installed: false, version: null, path: null };
  }

  const customOrAppData = findAgyExecutable();
  if (customOrAppData && customOrAppData !== 'agy' && fs.existsSync(customOrAppData)) {
    const verified = verifyAgyExecutable(customOrAppData);
    if (verified.valid) {
      return { installed: true, version: verified.version, path: customOrAppData };
    }
  }

  if (process.platform === 'win32') {
    const localAgy = path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'agy',
      'bin',
      'agy.exe'
    );
    if (fs.existsSync(localAgy)) {
      const verified = verifyAgyExecutable(localAgy);
      if (verified.valid) {
        return { installed: true, version: verified.version, path: localAgy };
      }
    }

    // Verify agy via %APPDATA%\npm\agy.cmd and ensure output belongs to agy
    const npmGlobalAgy = path.join(process.env.APPDATA || '', 'npm', 'agy.cmd');
    if (fs.existsSync(npmGlobalAgy)) {
      const verified = verifyAgyExecutable(npmGlobalAgy);
      if (verified.valid) {
        return { installed: true, version: verified.version, path: npmGlobalAgy };
      }
    }
  }

  try {
    const verOut = execSync('agy --version', { encoding: 'utf8', timeout: 3000, windowsHide: true }).trim();
    const firstLine = verOut.split('\n')[0].trim();
    if (firstLine) {
      try {
        const helpOut = execSync('agy --help', { encoding: 'utf8', timeout: 3000, windowsHide: true });
        if (/antigravity|agy|Usage of agy/i.test(helpOut)) {
          return { installed: true, version: firstLine, path: 'agy' };
        }
      } catch (_) {
        if (/^v?\d+\.\d+/.test(firstLine)) {
          return { installed: true, version: firstLine, path: 'agy' };
        }
      }
    }
  } catch (_) {}

  return { installed: false, version: null, path: null };
}

app.get('/api/system/prerequisites', (req, res) => {
  const nodeStatus = checkNodeAvailability();
  const agyStatus = checkAgyAvailability();

  res.json({
    nodeInstalled: nodeStatus.installed,
    nodeVersion: nodeStatus.version,
    agyInstalled: agyStatus.installed,
    agyVersion: agyStatus.version,
    agyPath: agyStatus.path,
  });
});

// Installation Process State Management & Cancellation
function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /t /f`, { stdio: 'ignore', windowsHide: true });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (_) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (__) {}
  }
}

let currentInstallOp = null;

function broadcastInstallEvent(eventData) {
  if (!currentInstallOp || !currentInstallOp.subscribers) return;
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const clientRes of currentInstallOp.subscribers) {
    try {
      clientRes.write(payload);
    } catch (_) {}
  }
}

function closeAllInstallSubscribers() {
  if (currentInstallOp && currentInstallOp.subscribers) {
    for (const clientRes of currentInstallOp.subscribers) {
      try {
        clientRes.end();
      } catch (_) {}
    }
    currentInstallOp.subscribers.clear();
  }
}

// 1. POST /api/system/install-agy/start: Requires custom header, enforces mutual exclusion & 5-minute timeout
app.post('/api/system/install-agy/start', (req, res) => {
  const customHeader = req.headers['x-afterai-action'] || req.headers['x-requested-with'];
  if (!customHeader || (customHeader !== 'install-agy' && customHeader !== 'afterAi-Client' && customHeader !== 'efterAi-Client')) {
    return res.status(400).json({ error: 'Missing or invalid custom authorization header' });
  }

  // Prevent running two installations concurrently
  if (currentInstallOp && currentInstallOp.status === 'running') {
    return res.status(409).json({
      error: 'عملية تثبيت أخرى قيد التشغيل بالفعل',
      installId: currentInstallOp.id,
    });
  }

  const installId = `install_${Date.now()}`;
  const isWin = process.platform === 'win32';

  // 5-minute timeout limit (300,000 ms)
  const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;
  const timeoutTimer = setTimeout(() => {
    if (currentInstallOp && currentInstallOp.id === installId && currentInstallOp.status === 'running') {
      console.warn(`[Install] Installation timed out after 5 minutes (installId: ${installId})`);
      killProcessTree(currentInstallOp.process?.pid);
      currentInstallOp.status = 'failed';
      currentInstallOp.error = 'انتهت المهلة الزمنية للتثبيت (5 دقائق) وتم إيقاف العملية تلقائياً.';
      broadcastInstallEvent({ type: 'error', line: currentInstallOp.error, code: 'TIMEOUT' });
      closeAllInstallSubscribers();
    }
  }, INSTALL_TIMEOUT_MS);

  let child;
  if (isWin) {
    // Official installation command for Windows
    child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://antigravity.google/cli/install.ps1 | iex'],
      { windowsHide: true }
    );
  } else {
    child = spawn('npm', ['install', '-g', '@google/antigravity'], {
      shell: true,
      windowsHide: true,
    });
  }

  currentInstallOp = {
    id: installId,
    process: child,
    status: 'running',
    logs: ['بدء تشغيل عملية التثبيت...'],
    lastLine: 'بدء تشغيل عملية التثبيت...',
    error: null,
    timeoutTimer,
    subscribers: new Set(),
  };

  const handleOutput = (d) => {
    const lines = d.toString('utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (currentInstallOp && currentInstallOp.id === installId) {
        currentInstallOp.logs.push(line);
        currentInstallOp.lastLine = line;
        broadcastInstallEvent({ type: 'log', line });
      }
    }
  };

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  child.on('close', (code) => {
    clearTimeout(timeoutTimer);
    if (!currentInstallOp || currentInstallOp.id !== installId) return;

    if (currentInstallOp.status !== 'running') {
      closeAllInstallSubscribers();
      return;
    }

    if (code === 0) {
      // Success verification: Check --version on %LOCALAPPDATA%\agy\bin\agy.exe
      const localAgy = path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
        'agy',
        'bin',
        isWin ? 'agy.exe' : 'agy'
      );
      const verified = verifyAgyExecutable(localAgy);

      if (verified.valid) {
        currentInstallOp.status = 'completed';
        broadcastInstallEvent({ type: 'log', line: `تم التحقق من تشغيل الأداة بنجاح: ${verified.version}` });
        broadcastInstallEvent({ type: 'done', success: true, version: verified.version });
      } else {
        const fallbackCheck = checkAgyAvailability();
        if (fallbackCheck.installed) {
          currentInstallOp.status = 'completed';
          broadcastInstallEvent({ type: 'log', line: `تم التحقق من تشغيل الأداة بنجاح: ${fallbackCheck.version}` });
          broadcastInstallEvent({ type: 'done', success: true, version: fallbackCheck.version });
        } else {
          currentInstallOp.status = 'failed';
          currentInstallOp.error = 'اكتمل أمر التثبيت ولكن تعذر التحقق من تشغيل agy --version على الملف التنفيذي.';
          broadcastInstallEvent({ type: 'error', line: currentInstallOp.error });
        }
      }
    } else {
      currentInstallOp.status = 'failed';
      currentInstallOp.error = `فشلت عملية التثبيت (رمز الخطأ: ${code}).`;
      broadcastInstallEvent({ type: 'error', line: currentInstallOp.error });
    }
    closeAllInstallSubscribers();
  });

  return res.json({ ok: true, installId });
});

// 2. POST /api/system/install-agy/cancel: Kills the entire process tree using taskkill /t /f
app.post('/api/system/install-agy/cancel', (req, res) => {
  const customHeader = req.headers['x-afterai-action'] || req.headers['x-requested-with'];
  if (!customHeader || (customHeader !== 'install-agy' && customHeader !== 'afterAi-Client' && customHeader !== 'efterAi-Client')) {
    return res.status(400).json({ error: 'Missing or invalid custom authorization header' });
  }

  const { installId } = req.body || {};
  if (currentInstallOp && (!installId || currentInstallOp.id === installId) && currentInstallOp.status === 'running') {
    clearTimeout(currentInstallOp.timeoutTimer);
    killProcessTree(currentInstallOp.process?.pid);
    currentInstallOp.status = 'cancelled';
    currentInstallOp.error = 'تم إلغاء عملية التثبيت بواسطة المستخدم.';
    broadcastInstallEvent({ type: 'cancelled', line: currentInstallOp.error });
    closeAllInstallSubscribers();
    return res.json({ ok: true, cancelled: true });
  }

  return res.status(404).json({ error: 'لا توجد عملية تثبيت نشطة مطابقة للإلغاء' });
});

// 3. GET /api/system/install-agy/stream: Pure read-only SSE stream (starts nothing)
app.get('/api/system/install-agy/stream', (req, res) => {
  const { installId } = req.query;
  if (!installId || !currentInstallOp || currentInstallOp.id !== installId) {
    return res.status(404).json({ error: 'معرّف عملية التثبيت غير موجود أو انتهت صلاحيته' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (type, payload = {}) => {
    try {
      res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
    } catch (_) {}
  };

  // Replay accumulated historical logs to the new subscriber
  for (const line of currentInstallOp.logs) {
    sendEvent('log', { line });
  }

  if (currentInstallOp.status === 'completed') {
    sendEvent('done', { success: true });
    res.end();
    return;
  }

  if (currentInstallOp.status === 'failed' || currentInstallOp.status === 'cancelled') {
    sendEvent('error', { line: currentInstallOp.error });
    res.end();
    return;
  }

  currentInstallOp.subscribers.add(res);

  req.on('close', () => {
    if (currentInstallOp && currentInstallOp.subscribers) {
      currentInstallOp.subscribers.delete(res);
    }
  });
});

// ==========================================
// Encrypted User Auth Storage (AES-256-GCM)
// Storage path defined dynamically based on environment
// ==========================================

function getEncryptionKey() {
  const machineEntropy = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.userInfo().username,
    'RemotionAIStudioKeySalt_2026'
  ].join('::');
  return crypto.scryptSync(machineEntropy, 'remotion-app-auth-salt', 32);
}

function encryptAuthData(data) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const jsonString = JSON.stringify(data);
  let encrypted = cipher.update(jsonString, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return {
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: iv.toString('hex'),
    authTag,
    data: encrypted,
    updatedAt: Date.now()
  };
}

function decryptAuthData(encryptedObj) {
  try {
    if (!encryptedObj || !encryptedObj.iv || !encryptedObj.authTag || !encryptedObj.data) {
      return null;
    }
    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedObj.iv, 'hex');
    const authTag = Buffer.from(encryptedObj.authTag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (err) {
    console.error('[Auth] Decryption failed:', err.message);
    return null;
  }
}

function saveUserAuth(user, tokens) {
  try {
    const payload = {
      user,
      tokens: tokens || null,
      savedAt: Date.now()
    };
    const encrypted = encryptAuthData(payload);
    fs.writeFileSync(AUTH_FILE_PATH, JSON.stringify(encrypted, null, 2), 'utf8');
    console.log('[Auth] User auth session securely saved to user-auth.json (AES-256-GCM)');
  } catch (err) {
    console.error('[Auth] Failed to write encrypted user-auth.json:', err.message);
  }
}

function readUserAuth() {
  try {
    if (!fs.existsSync(AUTH_FILE_PATH)) return null;
    const content = fs.readFileSync(AUTH_FILE_PATH, 'utf8');
    const encryptedObj = JSON.parse(content);
    return decryptAuthData(encryptedObj);
  } catch (err) {
    console.error('[Auth] Failed to read user-auth.json:', err.message);
    return null;
  }
}

function clearUserAuth() {
  try {
    if (fs.existsSync(AUTH_FILE_PATH)) {
      fs.unlinkSync(AUTH_FILE_PATH);
      console.log('[Auth] Removed user-auth.json on logout');
    }
  } catch (err) {
    console.error('[Auth] Failed to clear user-auth.json:', err.message);
  }
}

// Endpoint to get active authenticated user from user-auth.json
app.get('/api/auth/me', (req, res) => {
  const authSession = readUserAuth();
  if (authSession && authSession.user) {
    return res.json({
      authenticated: true,
      user: authSession.user,
    });
  }
  res.json({
    authenticated: false,
    user: null,
  });
});

// Endpoint to logout and wipe user-auth.json
app.post('/api/auth/logout', (req, res) => {
  clearUserAuth();
  res.json({ success: true });
});

// Endpoint to sync user profile into user-auth.json
app.post('/api/auth/sync', (req, res) => {
  const { user, tokens } = req.body;
  if (user && user.email) {
    saveUserAuth(user, tokens || null);
  }
  res.json({ success: true });
});

// ==========================================
// Dual-Agent Engine Configuration & Mode State
// ==========================================
function readAgentConfig() {
  try {
    if (!fs.existsSync(AGENT_CONFIG_PATH)) return null;
    const content = fs.readFileSync(AGENT_CONFIG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('[AgentConfig] Failed to read agent-config.json:', err.message);
    return null;
  }
}

function saveAgentConfig(config) {
  try {
    fs.writeFileSync(AGENT_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    console.log('[AgentConfig] Saved agent-config.json');
  } catch (err) {
    console.error('[AgentConfig] Failed to save agent-config.json:', err.message);
  }
}

// Endpoint to get agent configuration
app.get('/api/agent/config', (req, res) => {
  const cfg = readAgentConfig();
  res.json({
    mode: cfg?.mode || 'google',
    provider: cfg?.provider || 'openrouter',
    modelId: cfg?.modelId || 'liquid/lfm-2.5-2.6b:free',
    hasKey: Boolean(cfg?.apiKey),
    apiKeyMasked: cfg?.apiKey ? `${cfg.apiKey.slice(0, 10)}...${cfg.apiKey.slice(-4)}` : null,
    customBaseUrl: cfg?.customBaseUrl || '',
  });
});

// Endpoint to update agent configuration
app.post('/api/agent/config', (req, res) => {
  const { mode, provider, apiKey, modelId, customBaseUrl } = req.body;
  const current = readAgentConfig() || {};
  const updated = {
    mode: mode || current.mode || 'api_key',
    provider: provider || current.provider || 'openrouter',
    apiKey: apiKey !== undefined ? apiKey : current.apiKey,
    modelId: modelId || current.modelId || 'liquid/lfm-2.5-2.6b:free',
    customBaseUrl: customBaseUrl !== undefined ? customBaseUrl : (current.customBaseUrl || ''),
    updatedAt: Date.now(),
  };
  saveAgentConfig(updated);
  res.json({
    success: true,
    config: {
      mode: updated.mode,
      provider: updated.provider,
      modelId: updated.modelId,
      hasKey: Boolean(updated.apiKey),
    },
  });
});

// Endpoint to switch active mode (google vs api_key)
app.post('/api/agent/switch-mode', (req, res) => {
  const { mode } = req.body;
  const current = readAgentConfig() || {};
  current.mode = mode === 'api_key' ? 'api_key' : 'google';
  saveAgentConfig(current);
  res.json({ success: true, mode: current.mode });
});

// Endpoint to test custom API key connection
app.post('/api/agent/test', async (req, res) => {
  const { provider, apiKey, modelId, customBaseUrl } = req.body || {};
  const cfg = readAgentConfig() || {};
  const activeKey = apiKey || cfg.apiKey;
  if (!activeKey) {
    return res.status(400).json({ ok: false, error: 'مفتاح API غير متوفر للاختبار' });
  }

  const result = await testProviderConnection({
    provider: provider || cfg.provider || 'openrouter',
    apiKey: activeKey,
    modelId: modelId || cfg.modelId || 'liquid/lfm-2.5-2.6b:free',
    customBaseUrl: customBaseUrl || cfg.customBaseUrl || '',
  });

  res.json(result);
});

// ==========================================
// Genuine Google OAuth 2.0 PKCE Authentication
// ==========================================
const pendingAuthSessions = new Map();

// Google OAuth 2.0 Client Credentials (configurable via .env: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
const DEFAULT_GOOGLE_CLIENT_ID = '884354919052-36trc1jjb3tguiac32ov6cod268c5blh.apps.googleusercontent.com';
const DEFAULT_GOOGLE_CLIENT_SECRET = '';

function getGoogleCredentials() {
  loadAllEnvFiles();
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim() || DEFAULT_GOOGLE_CLIENT_ID;
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim() || DEFAULT_GOOGLE_CLIENT_SECRET;
  return { clientId, clientSecret };
}

// 1. Endpoint to initiate Google OAuth in user's default browser
app.post('/api/auth/google/start', (req, res) => {
  const { clientId } = getGoogleCredentials();

  const authId = 'auth_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  pendingAuthSessions.set(authId, {
    status: 'pending',
    codeVerifier,
    createdAt: Date.now(),
    user: null,
  });

  const redirectUri = `http://localhost:${PORT}/oauth2callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/cloud-platform',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: authId,
    access_type: 'offline',
    prompt: 'consent select_account',
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  res.json({
    success: true,
    authId,
    authUrl,
  });
});

// 2. Status polling endpoint for Studio frontend
app.get('/api/auth/google/check', (req, res) => {
  const { authId } = req.query;
  if (!authId || !pendingAuthSessions.has(authId)) {
    return res.status(404).json({ error: 'جلسة التوثيق غير موجودة أو منتهية الصلاحية' });
  }

  const session = pendingAuthSessions.get(authId);
  if (session.status === 'completed' && session.user) {
    setTimeout(() => pendingAuthSessions.delete(authId), 60000);
    return res.json({
      authenticated: true,
      user: session.user,
    });
  }

  res.json({
    authenticated: false,
    status: session.status,
  });
});

// 3. Official Google OAuth Redirect Callback Handler
app.get('/oauth2callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('[Google OAuth Error]:', error, error_description);
    return res.status(400).send(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>فشل تسجيل الدخول | Google OAuth</title>
        <style>
          body { background: #08080b; color: #fff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #121216; border: 1px solid #ef4444; padding: 36px; border-radius: 16px; text-align: center; max-width: 440px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2 style="color: #ef4444; margin-top: 0;">تم إلغاء تسجيل الدخول أو حدث خطأ</h2>
          <p style="color: #a1a1aa; line-height: 1.6;">${escapeHtml(error_description || error)}</p>
          <p style="color: #71717a; font-size: 13px;">يمكنك إغلاق هذا التبويب والمحاولة مرة أخرى من داخل الاستوديو.</p>
        </div>
      </body>
      </html>
    `);
  }

  if (!state || !pendingAuthSessions.has(state)) {
    return res.status(400).send('انتهت صلاحية جلسة التوثيق');
  }

  const session = pendingAuthSessions.get(state);

  try {
    const { clientId, clientSecret } = getGoogleCredentials();
    const redirectUri = `http://localhost:${PORT}/oauth2callback`;

    const tokenParams = {
      client_id: clientId,
      code: code,
      code_verifier: session.codeVerifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };
    if (clientSecret) {
      tokenParams.client_secret = clientSecret;
    }

    // Exchange authorization code for genuine Google Tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenParams),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('[Google OAuth Token Exchange Failed]:', tokenData);
      throw new Error(tokenData.error_description || tokenData.error || 'فشل استبدال رمز المصادقة من Google');
    }

    // Fetch genuine user identity from Google UserInfo endpoint
    let userProfile = {
      name: 'مستخدم Google',
      email: '',
      avatar: '',
      isGuest: false,
      authenticatedAt: Date.now(),
    };

    if (tokenData.access_token) {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        userProfile.name = userInfo.name || userInfo.email.split('@')[0];
        userProfile.email = userInfo.email;
        userProfile.avatar = userInfo.picture || '';
      }
    }

    session.status = 'completed';
    session.user = userProfile;
    session.tokens = tokenData;

    // Securely encrypt and persist user session to studio/server/user-auth.json (AES-256-GCM)
    saveUserAuth(userProfile, tokenData);

    // Render luxurious Google Success page
    res.send(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تم تسجيل الدخول بنجاح | Remotion AI Studio</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #08080b;
            color: #f4f4f5;
            font-family: 'Cairo', system-ui, sans-serif;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
          }
          .card {
            background: #0e0e12;
            border: 1px solid #27272a;
            border-radius: 20px;
            padding: 44px;
            text-align: center;
            max-width: 460px;
            box-shadow: 0 25px 60px rgba(0,0,0,0.6);
          }
          .avatar {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            border: 3px solid #10b981;
            margin: 0 auto 16px auto;
            object-fit: cover;
            display: block;
          }
          .icon {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.4);
            color: #10b981;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px auto;
            font-size: 28px;
          }
          h2 { font-size: 22px; font-weight: 700; margin: 0 0 10px 0; color: #fff; }
          .user-name { font-size: 16px; font-weight: 700; color: #f97316; margin-bottom: 4px; }
          .user-email { font-size: 13px; color: #a1a1aa; margin-bottom: 20px; }
          p { font-size: 14px; color: #71717a; line-height: 1.6; margin: 0; }
        </style>
        <script>
          setTimeout(() => {
            window.close();
          }, 3500);
        </script>
      </head>
      <body>
        <div class="card">
          ${userProfile.avatar ? `
            <img class="avatar" src="${escapeHtml(userProfile.avatar)}" referrerpolicy="no-referrer" crossorigin="anonymous" onerror="this.style.display='none'; document.getElementById('fb-icon').style.display='flex';" alt="${escapeHtml(userProfile.name)}">
            <div id="fb-icon" class="icon" style="display: none;">✓</div>
          ` : '<div class="icon">✓</div>'}
          <h2>تم تسجيل الدخول بنجاح</h2>
          <div class="user-name">${escapeHtml(userProfile.name)}</div>
          <div class="user-email">${escapeHtml(userProfile.email)}</div>
          <p style="font-size: 14px; color: #a1a1aa; line-height: 1.6; margin: 16px 0 0 0;">يمكنك الآن إغلاق هذه الصفحة والعودة إلى التطبيق.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('[OAuth token exchange error]:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>خطأ في استبدال التوكن</title>
        <style>
          body { background: #08080b; color: #fff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #121216; border: 1px solid #ef4444; padding: 36px; border-radius: 16px; text-align: center; max-width: 440px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2 style="color: #ef4444; margin-top: 0;">فشل استلام التوكن من Google</h2>
          <p style="color: #a1a1aa; line-height: 1.6;">${escapeHtml(err.message)}</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Fetch current code of Scene.tsx
app.get('/api/scene-code', (req, res) => {
  try {
    if (fs.existsSync(ACTIVE_SCENE_PATH)) {
      const code = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');
      res.json({ code });
    } else {
      res.status(404).json({ error: 'Scene.tsx not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vite Dynamic Scene Bundler Service (compiles Scene.tsx to memory IIFE bundle)
let cachedSceneBundle = null;
let cachedSceneMtime = 0;
let isCompilingScene = false;
let compileQueue = [];

async function buildSceneBundle() {
  if (!fs.existsSync(ACTIVE_SCENE_PATH)) {
    throw new Error('Scene.tsx not found on disk');
  }

  const stat = fs.statSync(ACTIVE_SCENE_PATH);
  if (cachedSceneBundle && stat.mtimeMs === cachedSceneMtime) {
    return cachedSceneBundle;
  }

  if (isCompilingScene) {
    return new Promise((resolve, reject) => {
      compileQueue.push({ resolve, reject });
    });
  }

  isCompilingScene = true;
  try {
    const res = await vite.build({
      root: path.dirname(ACTIVE_SCENE_PATH),
      configFile: false,
      build: {
        write: false,
        lib: {
          entry: ACTIVE_SCENE_PATH,
          name: 'DynamicSceneModule',
          formats: ['iife'],
          fileName: () => 'scene.bundle.js',
        },
        rollupOptions: {
          external: ['react', 'react/jsx-runtime', 'remotion', 'react-dom'],
          output: {
            exports: 'named',
            footer: '\nif (typeof window !== "undefined") { window.DynamicSceneModule = DynamicSceneModule; }\n',
            globals: {
              react: 'window.__EFTERAI_REACT__',
              'react/jsx-runtime': 'window.__EFTERAI_JSX__',
              'react-dom': 'window.__EFTERAI_REACT_DOM__',
              remotion: 'window.__EFTERAI_REMOTION__',
            },
          },
        },
      },
    });

    const output = (res && res[0] ? res[0] : res).output[0];
    cachedSceneBundle = output.code;
    cachedSceneMtime = stat.mtimeMs;
    console.log(`[Vite Bundler] Scene.tsx compiled successfully (${cachedSceneBundle.length} bytes)`);

    const pending = [...compileQueue];
    compileQueue = [];
    pending.forEach((p) => p.resolve(cachedSceneBundle));

    return cachedSceneBundle;
  } catch (err) {
    console.error(`[Vite Bundler] Scene.tsx compilation failed:`, err.message);
    const pending = [...compileQueue];
    compileQueue = [];
    pending.forEach((p) => p.reject(err));
    throw err;
  } finally {
    isCompilingScene = false;
  }
}

app.get('/api/scene-bundle.js', async (req, res) => {
  try {
    const code = await buildSceneBundle();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(code);
  } catch (err) {
    console.error('[API] /api/scene-bundle.js error:', err.message);
    res.status(500).send(`/* Compilation error: ${err.message} */`);
  }
});

// Helper: Calculate effective duration respecting holdToEnd
function getElementEffectiveDuration(item, sceneDuration) {
  if (item && item.holdToEnd) {
    return Math.max(1, sceneDuration - (Number(item.startFrame) || 0));
  }
  return Math.max(1, Number(item?.durationInFrames) || 1);
}

// Helper: Check overlap between items on same track
function checkTrackOverlap(items, candidate, sceneDuration) {
  const candStart = Number(candidate.startFrame) || 0;
  const candEnd = candStart + getElementEffectiveDuration(candidate, sceneDuration);
  const candTrack = Number(candidate.track) || 0;

  for (const item of items) {
    if (item.id === candidate.id) continue;
    if (item.isDeleted) continue;
    const itemTrack = Number(item.track) || 0;
    if (itemTrack !== candTrack) continue;

    const itemStart = Number(item.startFrame) || 0;
    const itemEnd = itemStart + getElementEffectiveDuration(item, sceneDuration);

    if (candStart < itemEnd && candEnd > itemStart) {
      return true;
    }
  }
  return false;
}

// Helper: Normalize tracks in scene-data.json
function normalizeSceneData(data) {
  if (!data || typeof data !== 'object') {
    return { durationInFrames: 180, fps: 30, shots: [], texts: [], cards: [], audio: [] };
  }
  const sceneDuration = Number(data.durationInFrames) || 180;
  const fps = Number(data.fps) || 30;
  const audio = Array.isArray(data.audio) ? data.audio : [];

  const normalizeShots = (rawShots) => {
    if (!Array.isArray(rawShots)) return [];
    const sorted = [...rawShots].sort((a, b) => (Number(a.startFrame) || 0) - (Number(b.startFrame) || 0));
    return sorted.map((shot, idx) => {
      const start = Math.max(0, Math.floor(Number(shot.startFrame) || 0));
      let dur = Math.max(1, Math.floor(Number(shot.durationInFrames) || 30));
      const nextShot = sorted[idx + 1];
      if (nextShot) {
        const nextStart = Math.max(0, Math.floor(Number(nextShot.startFrame) || 0));
        if (nextStart > start && start + dur > nextStart) {
          dur = nextStart - start;
        }
      }
      return {
        ...shot,
        startFrame: start,
        durationInFrames: dur,
      };
    });
  };

  const shots = normalizeShots(data.shots);

  const normalizeList = (rawList) => {
    if (!Array.isArray(rawList)) return [];
    const result = [];
    for (const rawItem of rawList) {
      if (rawItem.isDeleted) {
        result.push(rawItem);
        continue;
      }
      const item = { ...rawItem };
      let desiredTrack = typeof item.track === 'number' && item.track >= 0 ? Math.floor(item.track) : 0;
      while (
        checkTrackOverlap(
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
      result.push(item);
    }
    return result;
  };

  const texts = normalizeList(data.texts);
  const cards = normalizeList(data.cards);

  return {
    ...data,
    durationInFrames: sceneDuration,
    fps,
    shots,
    texts,
    cards,
    audio,
  };
}

// Helper: Read active scene-data.json
function readSceneData() {
  if (fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
    const raw = fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      return normalizeSceneData(parsed);
    } catch (e) {
      console.error('[API] Failed to parse scene-data.json:', e);
    }
  }
  return { durationInFrames: 180, fps: 30, shots: [], texts: [], cards: [], audio: [] };
}

// Fetch active scene data
app.get('/api/scene-data', (req, res) => {
  try {
    const data = readSceneData();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update text element in scene-data.json
app.patch('/api/scene-data/text', (req, res) => {
  try {
    const { id, text, fontSize, color, isDeleted, startFrame, durationInFrames, track, holdToEnd } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Element ID is required' });
    }

    if (!fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
      return res.status(404).json({ success: false, error: 'scene-data.json not found' });
    }

    const raw = fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8');
    const data = JSON.parse(raw);

    // Save snapshot to undo stack
    sceneDataUndoStack.push(raw);
    if (sceneDataUndoStack.length > MAX_UNDO_STACK_SIZE) {
      sceneDataUndoStack.shift();
    }

    if (!Array.isArray(data.texts)) {
      data.texts = [];
    }

    const itemIndex = data.texts.findIndex((t) => t.id === id);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: `Text element with ID ${id} not found` });
    }

    const item = data.texts[itemIndex];
    if (text !== undefined) item.text = String(text);
    if (fontSize !== undefined) item.fontSize = Number(fontSize);
    if (color !== undefined) item.color = String(color);
    if (isDeleted !== undefined) item.isDeleted = Boolean(isDeleted);
    if (startFrame !== undefined) item.startFrame = Number(startFrame);
    if (durationInFrames !== undefined) item.durationInFrames = Number(durationInFrames);
    if (track !== undefined) item.track = Math.floor(Number(track));
    if (holdToEnd !== undefined) item.holdToEnd = Boolean(holdToEnd);

    fs.writeFileSync(ACTIVE_SCENE_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    const normalized = normalizeSceneData(data);
    res.json({ success: true, data: normalized, updatedItem: item });
  } catch (err) {
    console.error('[API] Error in /api/scene-data/text:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generalized timing, track and state mutation for text or card element
app.patch('/api/scene-data/element', (req, res) => {
  try {
    const { kind, id, startFrame, durationInFrames, track, holdToEnd, isDeleted } = req.body;
    if (!kind || !['text', 'card'].includes(kind)) {
      return res.status(400).json({ success: false, error: 'Kind must be "text" or "card"' });
    }
    if (!id) {
      return res.status(400).json({ success: false, error: 'Element ID is required' });
    }

    if (!fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
      return res.status(404).json({ success: false, error: 'scene-data.json not found' });
    }

    const raw = fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8');
    const data = JSON.parse(raw);
    const sceneDuration = Number(data.durationInFrames) || 180;

    const listKey = kind === 'text' ? 'texts' : 'cards';
    if (!Array.isArray(data[listKey])) {
      data[listKey] = [];
    }

    const itemIndex = data[listKey].findIndex((item) => item.id === id);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: `Element ${id} not found in ${listKey}` });
    }

    const item = data[listKey][itemIndex];

    // Compute proposed values
    const newStart = startFrame !== undefined ? Math.floor(Number(startFrame)) : (Number(item.startFrame) || 0);
    const newHoldToEnd = holdToEnd !== undefined ? Boolean(holdToEnd) : Boolean(item.holdToEnd);
    const newDuration = durationInFrames !== undefined
      ? Math.floor(Number(durationInFrames))
      : (newHoldToEnd ? Math.max(1, sceneDuration - newStart) : (Number(item.durationInFrames) || 1));
    const newTrack = track !== undefined ? Math.floor(Number(track)) : (typeof item.track === 'number' ? item.track : 0);

    // Validation
    if (newStart < 0 || newStart >= sceneDuration) {
      return res.status(400).json({ success: false, error: 'startFrame must be between 0 and durationInFrames - 1' });
    }
    if (newTrack < 0 || newTrack > 50) {
      return res.status(400).json({ success: false, error: 'track must be between 0 and 50' });
    }

    // Smoothly clamp duration so extension never exceeds scene bounds
    let safeDuration = Math.max(1, newDuration);
    if (newStart + safeDuration > sceneDuration && !newHoldToEnd) {
      safeDuration = Math.max(1, sceneDuration - newStart);
    }

    // Check collision on candidate track against other active elements in same list
    const otherItemsOnTrack = data[listKey].filter(
      (x) => x.id !== id && !x.isDeleted && (typeof x.track === 'number' ? x.track : 0) === newTrack
    );

    // If candidate would overlap with another item to its right, clamp safeDuration to the gap cleanly
    for (const other of otherItemsOnTrack) {
      const otherStart = Number(other.startFrame) || 0;
      if (newStart < otherStart && (newStart + safeDuration) > otherStart) {
        safeDuration = Math.max(1, otherStart - newStart);
      }
    }

    const candidate = {
      id,
      startFrame: newStart,
      durationInFrames: safeDuration,
      track: newTrack,
      holdToEnd: newHoldToEnd,
    };
    if (checkTrackOverlap(data[listKey], candidate, sceneDuration)) {
      return res.status(409).json({
        success: false,
        error: 'تداخل زمني مع عنصر آخر على نفس المسار. انقل العنصر إلى مسار فارغ أو اضبط التوقيت.',
      });
    }

    // Save snapshot to undo stack
    sceneDataUndoStack.push(raw);
    if (sceneDataUndoStack.length > MAX_UNDO_STACK_SIZE) {
      sceneDataUndoStack.shift();
    }

    // Apply updates
    item.startFrame = newStart;
    item.durationInFrames = safeDuration;
    item.track = newTrack;
    item.holdToEnd = newHoldToEnd;
    if (isDeleted !== undefined) {
      item.isDeleted = Boolean(isDeleted);
    }

    fs.writeFileSync(ACTIVE_SCENE_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    const normalized = normalizeSceneData(data);
    res.json({ success: true, data: normalized, updatedItem: item });
  } catch (err) {
    console.error('[API] Error in /api/scene-data/element:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Split an element into two distinct pieces at a given frame (Razor / Split Tool)
app.post('/api/scene-data/split', (req, res) => {
  try {
    const { kind, id, splitFrame, sessionId } = req.body;
    if (!kind || !['text', 'card'].includes(kind)) {
      return res.status(400).json({ success: false, error: 'Kind must be "text" or "card"' });
    }
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Element ID is required' });
    }
    const targetSplit = Math.floor(Number(splitFrame));
    if (isNaN(targetSplit)) {
      return res.status(400).json({ success: false, error: 'splitFrame must be a valid number' });
    }

    if (!fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
      return res.status(404).json({ success: false, error: 'scene-data.json not found' });
    }

    const raw = fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8');
    const data = JSON.parse(raw);
    const sceneDuration = Number(data.durationInFrames) || 240;

    const listKey = kind === 'text' ? 'texts' : 'cards';
    if (!Array.isArray(data[listKey])) {
      data[listKey] = [];
    }

    const itemIndex = data[listKey].findIndex((item) => item.id === id);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: `Element ${id} not found in ${listKey}` });
    }

    const item = data[listKey][itemIndex];
    if (item.isDeleted) {
      return res.status(400).json({ success: false, error: 'لا يمكن تقسيم عنصر محذوف' });
    }

    const start = Number(item.startFrame) || 0;
    const holdToEnd = Boolean(item.holdToEnd);
    const duration = holdToEnd ? Math.max(1, sceneDuration - start) : (Number(item.durationInFrames) || 1);
    const end = start + duration;

    // Split point must fall strictly inside the element's active lifespan
    if (targetSplit <= start || targetSplit >= end) {
      return res.status(400).json({
        success: false,
        error: `نقطة القص (${targetSplit}) يجب أن تكون داخل المدى الزمني للعنصر [${start + 1}..${end - 1}]`,
      });
    }

    // Save snapshot to undo stack
    sceneDataUndoStack.push(raw);
    if (sceneDataUndoStack.length > MAX_UNDO_STACK_SIZE) {
      sceneDataUndoStack.shift();
    }

    // Piece 1 (Left piece)
    const leftDuration = targetSplit - start;
    item.durationInFrames = leftDuration;
    item.holdToEnd = false;

    // Piece 2 (Right piece)
    const baseId = item.baseId || item.id;
    const existingParts = data[listKey].filter(
      (x) => x.baseId === baseId || (typeof x.id === 'string' && x.id.startsWith(`${baseId}_part_`))
    );
    const rightId = `${baseId}_part_${existingParts.length + 1}`;
    const rightDuration = end - targetSplit;

    const rightPiece = {
      ...item,
      id: rightId,
      baseId,
      startFrame: targetSplit,
      durationInFrames: rightDuration,
      holdToEnd: holdToEnd,
      isDeleted: false,
    };

    // Insert right piece immediately after the left piece
    data[listKey].splice(itemIndex + 1, 0, rightPiece);

    fs.writeFileSync(ACTIVE_SCENE_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

    // Sync to active session file if available
    const activeSid = sessionId || req.query?.sessionId;
    if (activeSid && isValidSessionId(activeSid)) {
      const sFile = path.join(SESSIONS_DIR, `${activeSid}.json`);
      if (fs.existsSync(sFile)) {
        try {
          const sJson = JSON.parse(fs.readFileSync(sFile, 'utf8'));
          sJson.sceneData = data;
          sJson.updatedAt = new Date().toISOString();
          fs.writeFileSync(sFile, JSON.stringify(sJson, null, 2), 'utf8');
        } catch (_) {}
      }
    }

    const normalized = normalizeSceneData(data);
    res.json({
      success: true,
      data: normalized,
      leftPiece: item,
      rightPiece,
    });
  } catch (err) {
    console.error('[API] Error in /api/scene-data/split:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update element transform in scene-data.json
app.patch('/api/scene-data/transform', (req, res) => {
  try {
    const { kind, id, transform } = req.body;
    if (!kind || !['text', 'card'].includes(kind)) {
      return res.status(400).json({ success: false, error: 'Kind must be "text" or "card"' });
    }
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Element ID is required' });
    }
    if (!transform || typeof transform !== 'object') {
      return res.status(400).json({ success: false, error: 'Transform object is required' });
    }

    const { x, y, scale, rotation } = transform;
    if (
      typeof x !== 'number' || !Number.isFinite(x) ||
      typeof y !== 'number' || !Number.isFinite(y) ||
      typeof scale !== 'number' || !Number.isFinite(scale) ||
      typeof rotation !== 'number' || !Number.isFinite(rotation)
    ) {
      return res.status(400).json({
        success: false,
        error: 'x, y, scale, and rotation must be finite numbers',
      });
    }

    // Clamp values
    const clampedX = Math.round(Math.min(200, Math.max(-200, x)) * 1000) / 1000;
    const clampedY = Math.round(Math.min(200, Math.max(-200, y)) * 1000) / 1000;
    const clampedScale = Math.round(Math.min(10, Math.max(0.1, scale)) * 1000) / 1000;
    const clampedRotation = Math.round(Math.min(360, Math.max(-360, rotation)) * 1000) / 1000;

    if (!fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
      return res.status(404).json({ success: false, error: 'scene-data.json not found' });
    }

    const raw = fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8');
    const data = JSON.parse(raw);
    let targetData = data;
    let listKey = kind === 'text' ? 'texts' : 'cards';
    let otherKey = kind === 'text' ? 'cards' : 'texts';

    if (!Array.isArray(targetData[listKey])) {
      targetData[listKey] = [];
    }

    let itemIndex = targetData[listKey].findIndex((item) => item.id === id);

    // If not found in primary listKey, check the other listKey
    if (itemIndex === -1 && Array.isArray(targetData[otherKey])) {
      const otherIndex = targetData[otherKey].findIndex((item) => item.id === id);
      if (otherIndex !== -1) {
        listKey = otherKey;
        itemIndex = otherIndex;
      }
    }

    // If still not found in active scene-data.json, check active session file
    const activeSid = req.body.sessionId;
    if (itemIndex === -1 && activeSid && isValidSessionId(activeSid)) {
      const sFile = path.join(SESSIONS_DIR, `${activeSid}.json`);
      if (fs.existsSync(sFile)) {
        try {
          const sJson = JSON.parse(fs.readFileSync(sFile, 'utf8'));
          if (sJson.sceneData) {
            const sTexts = Array.isArray(sJson.sceneData.texts) ? sJson.sceneData.texts : [];
            const sCards = Array.isArray(sJson.sceneData.cards) ? sJson.sceneData.cards : [];
            const textIdx = sTexts.findIndex((t) => t.id === id);
            const cardIdx = sCards.findIndex((c) => c.id === id);

            if (textIdx !== -1) {
              targetData = sJson.sceneData;
              listKey = 'texts';
              itemIndex = textIdx;
            } else if (cardIdx !== -1) {
              targetData = sJson.sceneData;
              listKey = 'cards';
              itemIndex = cardIdx;
            }
          }
        } catch (_) {}
      }
    }

    // Save snapshot to undo stack
    sceneDataUndoStack.push(raw);
    if (sceneDataUndoStack.length > MAX_UNDO_STACK_SIZE) {
      sceneDataUndoStack.shift();
    }

    // If element still not found, add a new element entry dynamically
    if (itemIndex === -1) {
      const newItem = {
        id,
        isDeleted: false,
        transform: {
          x: clampedX,
          y: clampedY,
          scale: clampedScale,
          rotation: clampedRotation,
        },
      };
      if (listKey === 'texts') {
        newItem.text = '';
        newItem.fontSize = 24;
      }
      targetData[listKey].push(newItem);
      itemIndex = targetData[listKey].length - 1;
    }

    const item = targetData[listKey][itemIndex];

    // If reset to default values, remove transform property to keep clean JSON
    if (clampedX === 0 && clampedY === 0 && clampedScale === 1 && clampedRotation === 0) {
      delete item.transform;
    } else {
      item.transform = {
        x: clampedX,
        y: clampedY,
        scale: clampedScale,
        rotation: clampedRotation,
      };
    }

    fs.writeFileSync(ACTIVE_SCENE_DATA_PATH, JSON.stringify(targetData, null, 2), 'utf8');

    // Also persist into active session file if available
    if (activeSid && isValidSessionId(activeSid)) {
      const sFile = path.join(SESSIONS_DIR, `${activeSid}.json`);
      if (fs.existsSync(sFile)) {
        try {
          const sJson = JSON.parse(fs.readFileSync(sFile, 'utf8'));
          sJson.sceneData = targetData;
          sJson.updatedAt = Date.now();
          fs.writeFileSync(sFile, JSON.stringify(sJson, null, 2), 'utf8');
        } catch (_) {}
      }
    }

    const normalized = normalizeSceneData(targetData);
    res.json({ success: true, data: normalized, updatedItem: item });
  } catch (err) {
    console.error('[API] Error in /api/scene-data/transform:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Full update of scene-data.json
app.put('/api/scene-data', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid scene data provided' });
    }

    if (fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
      const raw = fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8');
      sceneDataUndoStack.push(raw);
      if (sceneDataUndoStack.length > MAX_UNDO_STACK_SIZE) {
        sceneDataUndoStack.shift();
      }
    }

    fs.writeFileSync(ACTIVE_SCENE_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true, data });
  } catch (err) {
    console.error('[API] Error in PUT /api/scene-data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Undo last scene-data mutation
app.post('/api/scene-data/undo', (req, res) => {
  try {
    if (sceneDataUndoStack.length === 0) {
      return res.status(400).json({ success: false, error: 'No undo history available' });
    }

    const previousJson = sceneDataUndoStack.pop();
    fs.writeFileSync(ACTIVE_SCENE_DATA_PATH, previousJson, 'utf8');
    const data = JSON.parse(previousJson);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[API] Error in /api/scene-data/undo:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Sessions Management Endpoints
// ==========================================

// List all sessions (metadata only for fast UI rendering)
app.get('/api/sessions', (req, res) => {
  try {
    ensureDefaultSession();
    const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
    const sessions = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8');
        const data = JSON.parse(content);
        sessions.push({
          id: data.id,
          title: data.title,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          model: data.model,
          messageCount: data.messages ? data.messages.length : 0,
        });
      } catch (e) {
        console.error(`[API] Failed to parse session file ${file}:`, e.message);
      }
    }

    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new session with clean starter scene
app.post('/api/sessions', (req, res) => {
  try {
    const { title, model, previousSessionId } = req.body;

    // If a previous session ID was passed, ensure its current scene code and sceneData are captured first
    if (isValidSessionId(previousSessionId)) {
      const prevFile = path.join(SESSIONS_DIR, `${previousSessionId}.json`);
      if (fs.existsSync(prevFile)) {
        try {
          const prevData = JSON.parse(fs.readFileSync(prevFile, 'utf8'));
          if (fs.existsSync(ACTIVE_SCENE_PATH)) {
            prevData.sceneCode = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');
          }
          if (fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
            prevData.sceneData = JSON.parse(fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8'));
          }
          prevData.updatedAt = Date.now();
          fs.writeFileSync(prevFile, JSON.stringify(prevData, null, 2), 'utf8');
        } catch (e) {
          console.error(`[API] Could not backup previous session data:`, e.message);
        }
      }
    }

    // Read clean starter scene code
    let starterCode = '';
    if (fs.existsSync(STARTER_SCENE_PATH)) {
      starterCode = fs.readFileSync(STARTER_SCENE_PATH, 'utf8');
    } else if (fs.existsSync(ACTIVE_SCENE_PATH)) {
      starterCode = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');
    }

    // Read clean starter scene data
    let starterData = null;
    if (fs.existsSync(STARTER_SCENE_DATA_PATH)) {
      try {
        starterData = JSON.parse(fs.readFileSync(STARTER_SCENE_DATA_PATH, 'utf8'));
      } catch (e) {
        console.error('[API] Failed to parse starter scene data:', e.message);
      }
    }

    // Overwrite Scene.tsx with clean starter code
    if (starterCode) {
      fs.writeFileSync(ACTIVE_SCENE_PATH, starterCode, 'utf8');
    }

    // Overwrite scene-data.json with clean starter data
    if (starterData) {
      fs.writeFileSync(ACTIVE_SCENE_DATA_PATH, JSON.stringify(starterData, null, 2), 'utf8');
    }

    // Reset undo stack for fresh session
    sceneDataUndoStack.length = 0;

    const newId = `session_${Date.now()}`;
    const cfgForSession = readAgentConfig();
    const defaultModel = (cfgForSession && cfgForSession.mode === 'api_key')
      ? (cfgForSession.modelId || 'liquid/lfm-2.5-2.6b:free')
      : 'gemini-3.8-flash-high';
    const isGoogleCustomSession = cfgForSession?.provider === 'google' || cfgForSession?.provider === 'google_ai_studio';
    const sessionModel = (model && (model.includes('/') || !model.startsWith('gemini-') || isGoogleCustomSession || cfgForSession?.mode !== 'api_key'))
      ? model
      : defaultModel;

    const newSession = {
      id: newId,
      title: title || 'مشروع جديد ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: sessionModel,
      agyConversationId: null,
      messages: [
        {
          id: `welcome-${Date.now()}`,
          sender: 'agent',
          text: 'مرحباً بك في جلسة عمل جديدة.\n\nتم تهيئة قالب المشهد الأولي. اكتب فكرتك الإبداعية وسيقوم وكيل البرمجة بتنفيذها على الفور.',
          timestamp: 'الآن',
        },
      ],
      sceneCode: starterCode,
      sceneData: starterData,
      audioClips: [],
    };

    fs.writeFileSync(
      path.join(SESSIONS_DIR, `${newId}.json`),
      JSON.stringify(newSession, null, 2),
      'utf8'
    );

    res.json({ session: newSession, sceneData: starterData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific session (full data including messages, scene code and sceneData)
app.get('/api/sessions/:id', (req, res) => {
  try {
    const sessionFile = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(sessionFile)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));

    // Synchronize Scene.tsx and scene-data.json if requested (e.g. on editor/player mount)
    // NEVER overwrite disk if an agent process is actively running for this session!
    const isAgentBusy = activeChildProcesses.has(req.params.id) || activeChildProcesses.has('default') || activeChildProcesses.size > 0 || activeCustomAgentControllers.size > 0;
    if (req.query.sync === 'true' && !isAgentBusy) {
      if (data.sceneCode) {
        fs.writeFileSync(ACTIVE_SCENE_PATH, data.sceneCode, 'utf8');
        console.log(`[API] Synced Scene.tsx with session ${data.id} code`);
      }
      if (data.sceneData) {
        data.sceneData = normalizeSceneData(data.sceneData);
        fs.writeFileSync(ACTIVE_SCENE_DATA_PATH, JSON.stringify(data.sceneData, null, 2), 'utf8');
        console.log(`[API] Synced scene-data.json with session ${data.id} data`);
      }
    }

    if (data.sceneData) {
      data.sceneData = normalizeSceneData(data.sceneData);
    }
    res.json({ session: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Switch active session (loads session messages and writes its saved sceneCode and sceneData)
app.post('/api/sessions/:id/switch', (req, res) => {
  try {
    const { currentSessionId } = req.body;
    const targetFile = path.join(SESSIONS_DIR, `${req.params.id}.json`);

    if (!fs.existsSync(targetFile)) {
      return res.status(404).json({ error: 'Target session not found' });
    }

    // Save current session code and sceneData first before switching
    if (isValidSessionId(currentSessionId) && currentSessionId !== req.params.id) {
      const currentFile = path.join(SESSIONS_DIR, `${currentSessionId}.json`);
      if (fs.existsSync(currentFile)) {
        try {
          const currentData = JSON.parse(fs.readFileSync(currentFile, 'utf8'));
          if (fs.existsSync(ACTIVE_SCENE_PATH)) {
            currentData.sceneCode = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');
          }
          if (fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
            currentData.sceneData = JSON.parse(fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8'));
          }
          currentData.updatedAt = Date.now();
          fs.writeFileSync(currentFile, JSON.stringify(currentData, null, 2), 'utf8');
        } catch (e) {
          console.error(`[API] Failed to snapshot current session before switch:`, e.message);
        }
      }
    }

    // Load target session
    const targetData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));

    // Write target sceneCode to Scene.tsx so player updates immediately
    let targetCode = targetData.sceneCode;
    if (!targetCode && fs.existsSync(STARTER_SCENE_PATH)) {
      targetCode = fs.readFileSync(STARTER_SCENE_PATH, 'utf8');
      targetData.sceneCode = targetCode;
    }
    if (targetCode) {
      fs.writeFileSync(ACTIVE_SCENE_PATH, targetCode, 'utf8');
    }

    // Write target sceneData to scene-data.json
    let targetSceneData = targetData.sceneData;
    if (!targetSceneData && fs.existsSync(STARTER_SCENE_DATA_PATH)) {
      try {
        targetSceneData = JSON.parse(fs.readFileSync(STARTER_SCENE_DATA_PATH, 'utf8'));
        targetData.sceneData = targetSceneData;
      } catch (_) {}
    }
    if (targetSceneData) {
      fs.writeFileSync(ACTIVE_SCENE_DATA_PATH, JSON.stringify(targetSceneData, null, 2), 'utf8');
    }

    // Reset undo stack for the switched session
    sceneDataUndoStack.length = 0;

    targetData.updatedAt = Date.now();
    fs.writeFileSync(targetFile, JSON.stringify(targetData, null, 2), 'utf8');

    res.json({ session: targetData, sceneData: targetSceneData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update session (save messages, rename title, or update model)
app.put('/api/sessions/:id', (req, res) => {
  try {
    const sessionFile = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(sessionFile)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    const { title, messages, model, captureCurrentCode, audioClips } = req.body;

    if (title !== undefined) sessionData.title = title;
    if (messages !== undefined) sessionData.messages = messages;
    if (model !== undefined) sessionData.model = model;
    if (audioClips !== undefined) sessionData.audioClips = audioClips;

    if (captureCurrentCode && fs.existsSync(ACTIVE_SCENE_PATH)) {
      sessionData.sceneCode = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');
      if (fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
        try {
          sessionData.sceneData = JSON.parse(fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8'));
        } catch (_) {}
      }
    }

    sessionData.updatedAt = Date.now();
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');

    res.json({ session: sessionData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a session
app.delete('/api/sessions/:id', (req, res) => {
  try {
    const sessionFile = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Audio & SFX Presets and Streaming Endpoints
// ==========================================
const AUDIO_PRESETS = [
  {
    id: 'metal_impact',
    name: 'ارتطام معدني ثقيل (Metal Impact)',
    category: 'Impact',
    duration: 0.9,
    durationFrames: 27,
    filename: 'metal_impact.wav',
    url: '/api/audio/file/metal_impact.wav',
    color: '#f97316',
    description: 'صوت صدمة وارتطام معدني قوي يناسب سقوط العناصر'
  },
  {
    id: 'mechanical_spin',
    name: 'دوران واحتكاك تروس (Mechanical Spin)',
    category: 'Motion',
    duration: 1.0,
    durationFrames: 30,
    filename: 'mechanical_spin.wav',
    url: '/api/audio/file/mechanical_spin.wav',
    color: '#eab308',
    description: 'صوت دوران مسننات واحتكاك ميكانيكي سريع'
  },
  {
    id: 'whoosh_fast',
    name: 'انتقال حركي خاطف (Fast Whoosh)',
    category: 'Transition',
    duration: 0.6,
    durationFrames: 18,
    filename: 'whoosh_fast.wav',
    url: '/api/audio/file/whoosh_fast.wav',
    color: '#3b82f6',
    description: 'صوت هواء خاطف يناسب سرعة الحركات والانتقالات'
  },
  {
    id: 'cinematic_boom',
    name: 'ضربة سينمائية عميقة (Cinematic Boom)',
    category: 'Impact',
    duration: 1.4,
    durationFrames: 42,
    filename: 'cinematic_boom.wav',
    url: '/api/audio/file/cinematic_boom.wav',
    color: '#8b5cf6',
    description: 'صوت باس سينمائي عميق لتعزيز دراما المشهد'
  },
  {
    id: 'tech_click',
    name: 'نقرة تقنية رقمية (Tech Click)',
    category: 'UI',
    duration: 0.15,
    durationFrames: 5,
    filename: 'tech_click.wav',
    url: '/api/audio/file/tech_click.wav',
    color: '#06b6d4',
    description: 'نقرة واضحة وحديثة لظهور الأزرار والنصوص'
  },
  {
    id: 'success_bell',
    name: 'رنين كريستالي نقي (Success Bell)',
    category: 'Musical',
    duration: 1.2,
    durationFrames: 36,
    filename: 'success_bell.wav',
    url: '/api/audio/file/success_bell.wav',
    color: '#10b981',
    description: 'رنين نغمي متناغم للإشارة إلى اكتمال الحدث'
  }
];

app.get('/api/audio/presets', (req, res) => {
  res.json({ presets: AUDIO_PRESETS });
});

app.get('/api/audio/file/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  let filePath = path.join(AUDIO_ASSETS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(AUDIO_UPLOADS_DIR, filename);
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Audio file not found');
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = ext === '.mp3' ? 'audio/mpeg' : ext === '.wav' ? 'audio/wav' : ext === '.ogg' ? 'audio/ogg' : 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  fs.createReadStream(filePath).pipe(res);
});

app.post('/api/audio/upload', (req, res) => {
  try {
    const { name, dataUrl, duration, durationFrames } = req.body;
    if (!dataUrl || !name) {
      return res.status(400).json({ error: 'dataUrl and name are required' });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid data URL format' });
    }

    const mime = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    let ext = '.mp3';
    if (mime.includes('wav')) ext = '.wav';
    else if (mime.includes('ogg')) ext = '.ogg';
    else if (mime.includes('m4a') || mime.includes('mp4')) ext = '.m4a';

    const safeName = `${Date.now()}_${name.replace(/[^a-zA-Z0-9_\u0600-\u06FF.-]/g, '_')}${ext}`;
    const targetPath = path.join(AUDIO_UPLOADS_DIR, safeName);
    fs.writeFileSync(targetPath, buffer);

    try {
      fs.writeFileSync(path.join(PUBLIC_UPLOADS_DIR, safeName), buffer);
    } catch (mirrorErr) {
      console.warn('[API] Could not mirror upload to template public dir:', mirrorErr.message);
    }

    res.json({
      preset: {
        id: `custom_${Date.now()}`,
        name: name.replace(/\.[^/.]+$/, ''),
        category: 'Custom',
        filename: safeName,
        url: `/api/audio/file/${safeName}`,
        duration: duration || 2.0,
        durationFrames: durationFrames || 60,
        color: '#ec4899',
        description: 'مؤثر صوتي مخصص تم رفعه محلياً'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Scene Audio Synchronization & Removal
// ==========================================

function removeAudioFromSceneCode(srcCode, options = {}) {
  let updated = srcCode;
  const { filename, src, startFrame, removeAllVoiceovers, clearAll } = options;

  if (clearAll) {
    // 1. Remove all conditional Audio blocks: {frame >= ... && ( <Audio ... /> )}
    updated = updated.replace(
      /\{\s*frame\b[^}]*&&\s*\(?\s*<Audio\b[^>]*(?:\/>|>[\s\S]*?<\/Audio>)\s*\)?\s*\};?/gi,
      ''
    );
    // 2. Remove all standalone <Audio ... /> tags
    updated = updated.replace(
      /<Audio\b[^>]*(?:\/>|>[\s\S]*?<\/Audio>)/gi,
      ''
    );
    // 3. Remove section comments if any
    updated = updated.replace(
      /\{\/\*\s*=+[\s\S]*?1\.\s*Voiceover Audio[\s\S]*?=+\s*\*\/\}[\r\n]*/gi,
      ''
    );
    return updated;
  }

  if (removeAllVoiceovers) {
    const voStandaloneRegex = /<Audio\b[^>]*src=\{staticFile\(['"][^'"]*voiceover[^'"]*['"]\)\}[^>]*(?:\/>|>[\s\S]*?<\/Audio>)/gi;
    updated = updated.replace(voStandaloneRegex, '');
    const voCondRegex = /\{\s*frame\b[^}]*&&\s*\(?\s*<Audio\b[^>]*src=\{staticFile\(['"][^'"]*voiceover[^'"]*['"]\)\}[^>]*(?:\/>|>[\s\S]*?<\/Audio>)\s*\)?\s*\};?/gi;
    updated = updated.replace(voCondRegex, '');
  }

  const targetFile = filename || (src ? path.basename(src.split('?')[0].replace(/['"]/g, '')) : null);
  if (targetFile) {
    const cleanFn = path.basename(targetFile);
    const escaped = cleanFn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Conditional block with matching startFrame if specified
    if (typeof startFrame === 'number') {
      const specificCondRegex = new RegExp(
        `\\{\\s*frame\\s*>=\\s*${startFrame}\\s*&&[^}]*<Audio\\b[^>]*${escaped}[^>]*(?:\\/>|>[\\s\\S]*?<\\/Audio>)\\s*\\)?\\s*\\};?`,
        'gi'
      );
      updated = updated.replace(specificCondRegex, '');
    }

    // 2. General conditional block with this filename
    const condRegex = new RegExp(
      `\\{\\s*frame\\b[^}]*&&\\s*\\(?\\s*<Audio\\b[^>]*${escaped}[^>]*(?:\\/>|>[\\s\\S]*?<\\/Audio>)\\s*\\)?\\s*\\};?`,
      'gi'
    );
    updated = updated.replace(condRegex, '');

    // 3. Standalone <Audio ... filename ... />
    const tagRegex = new RegExp(
      `<Audio\\b[^>]*${escaped}[^>]*(?:\\/>|>[\\s\\S]*?<\\/Audio>)`,
      'gi'
    );
    updated = updated.replace(tagRegex, '');
  }

  return updated;
}

function parseAudioClipsFromSceneCode(srcCode) {
  const clips = [];
  const durMatch = srcCode.match(/export\s+const\s+DURATION_IN_FRAMES\s*=\s*(\d+)/);
  const totalDuration = durMatch ? parseInt(durMatch[1], 10) : 240;

  // 1. Matches conditional wrappers: {frame >= START && frame < END && ... <Audio ... />}
  const condPattern = /\{frame\s*>=\s*(\d+)\s*&&\s*frame\s*<\s*(\d+)\s*&&\s*\(?\s*<Audio\b([^>]*)\/>\s*\)?\s*\}/g;
  let match;
  const processedMatches = new Set();

  while ((match = condPattern.exec(srcCode)) !== null) {
    const startFrame = parseInt(match[1], 10);
    const endFrame = parseInt(match[2], 10);
    const duration = Math.max(1, endFrame - startFrame);
    const attrs = match[3];

    const srcMatch = attrs.match(/src=\{staticFile\(['"]([^'"]+)['"]\)\}|src=['"]([^'"]+)['"]/);
    const rawSrc = srcMatch ? (srcMatch[1] || srcMatch[2]) : '';
    const filename = path.basename(rawSrc);

    const volMatch = attrs.match(/volume=\{?([0-9.]+)\}?/);
    const volume = volMatch ? parseFloat(volMatch[1]) : 1.0;

    const id = `parsed_${filename}_${startFrame}`;
    processedMatches.add(match[0]);

    clips.push({
      id,
      name: filename.replace(/\.[^/.]+$/, ''),
      src: rawSrc.startsWith('http') || rawSrc.startsWith('/') ? rawSrc : `/${rawSrc}`,
      filename,
      startFrame,
      durationInFrames: duration,
      volume,
      color: filename.includes('voiceover') ? '#f97316' : '#3b82f6',
    });
  }

  // 2. Matches standalone <Audio ... />
  const standalonePattern = /<Audio\b([^>]*)\/>/g;
  while ((match = standalonePattern.exec(srcCode)) !== null) {
    const fullTag = match[0];
    const attrs = match[1];

    let alreadyHandled = false;
    for (const pm of processedMatches) {
      if (pm.includes(fullTag)) {
        alreadyHandled = true;
        break;
      }
    }
    if (alreadyHandled) continue;

    const srcMatch = attrs.match(/src=\{staticFile\(['"]([^'"]+)['"]\)\}|src=['"]([^'"]+)['"]/);
    const rawSrc = srcMatch ? (srcMatch[1] || srcMatch[2]) : '';
    const filename = path.basename(rawSrc);

    const volMatch = attrs.match(/volume=\{?([0-9.]+)\}?/);
    const volume = volMatch ? parseFloat(volMatch[1]) : 1.0;

    const isVoiceover = filename.includes('voiceover');
    const id = `parsed_${filename}_0`;

    clips.push({
      id,
      name: isVoiceover ? `تعليق صوتي (${filename})` : filename.replace(/\.[^/.]+$/, ''),
      src: rawSrc.startsWith('http') || rawSrc.startsWith('/') ? rawSrc : `/${rawSrc}`,
      filename,
      startFrame: 0,
      durationInFrames: totalDuration,
      volume,
      color: isVoiceover ? '#f97316' : '#10b981',
    });
  }

  return clips;
}

// Endpoint to remove deleted audio clips from Scene.tsx and session
app.post('/api/scene/sync-audio', (req, res) => {
  try {
    const { sessionId, deletedClip, remainingClips, clearAll } = req.body;

    if (!fs.existsSync(ACTIVE_SCENE_PATH)) {
      return res.status(404).json({ error: 'Scene.tsx not found' });
    }

    let code = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');

    if (clearAll) {
      code = removeAudioFromSceneCode(code, { clearAll: true });
    } else if (deletedClip) {
      const filename = deletedClip.filename || path.basename((deletedClip.src || '').split('?')[0].replace(/['"]/g, ''));
      const isVoiceover = Boolean(
        (deletedClip.id && deletedClip.id.startsWith('voice_')) ||
        (filename && filename.includes('voiceover')) ||
        (deletedClip.name && deletedClip.name.includes('تعليق صوتي'))
      );

      const hasRemainingVoiceover = Array.isArray(remainingClips) && remainingClips.some((c) => {
        const fn = c.filename || path.basename((c.src || '').split('?')[0].replace(/['"]/g, ''));
        return (c.id && c.id.startsWith('voice_')) || (fn && fn.includes('voiceover')) || (c.name && c.name.includes('تعليق صوتي'));
      });

      code = removeAudioFromSceneCode(code, {
        filename,
        src: deletedClip.src,
        startFrame: deletedClip.startFrame,
        removeAllVoiceovers: isVoiceover && !hasRemainingVoiceover,
      });
    }

    // Write updated code back to ACTIVE_SCENE_PATH
    fs.writeFileSync(ACTIVE_SCENE_PATH, code, 'utf8');

    // Update current session file
    if (isValidSessionId(sessionId)) {
      const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
      if (fs.existsSync(sessionFile)) {
        try {
          const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
          sessionData.sceneCode = code;
          if (Array.isArray(remainingClips)) {
            sessionData.audioClips = remainingClips;
          }
          sessionData.updatedAt = Date.now();
          fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');
        } catch (sessErr) {
          console.error('[API] Failed to update session file on sync-audio:', sessErr.message);
        }
      }
    }

    res.json({
      success: true,
      updatedCode: code,
      remainingClips: remainingClips || [],
    });
  } catch (err) {
    console.error('[API /api/scene/sync-audio] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to parse audio clips currently in Scene.tsx
app.get('/api/scene/parse-audio', (req, res) => {
  try {
    if (!fs.existsSync(ACTIVE_SCENE_PATH)) {
      return res.status(404).json({ error: 'Scene.tsx not found' });
    }
    const code = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');
    const clips = parseAudioClipsFromSceneCode(code);
    res.json({ clips });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Dynamic Live Models Endpoint from agy
// ==========================================
function readDiskCachedModels() {
  try {
    if (!fs.existsSync(CACHED_MODELS_PATH)) return null;
    const content = fs.readFileSync(CACHED_MODELS_PATH, 'utf8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const filtered = parsed.filter((m) => m && typeof m.id === 'string' && m.id.startsWith('gemini-3.8-flash-'));
      if (filtered.length >= 3) {
        return filtered;
      }
      saveDiskCachedModels(DEFAULT_FALLBACK_MODELS);
      return DEFAULT_FALLBACK_MODELS;
    }
    return null;
  } catch (err) {
    console.warn('[Models] Failed to read cached-models.json:', err.message);
    return null;
  }
}

function saveDiskCachedModels(models) {
  try {
    if (Array.isArray(models) && models.length > 0) {
      fs.writeFileSync(CACHED_MODELS_PATH, JSON.stringify(models, null, 2), 'utf8');
      console.log(`[Models] Persisted ${models.length} models to ${CACHED_MODELS_PATH}`);
    }
  } catch (err) {
    console.warn('[Models] Failed to save cached-models.json:', err.message);
  }
}

const DEFAULT_FALLBACK_MODELS = [
  {
    id: 'gemini-3.8-flash-high',
    name: 'Gemini 3.8 Flash (High)',
    badge: 'High',
    description: 'النموذج الافتراضي • تفكير عميق وهندسة حركية سينمائية متقدمة',
    provider: 'Google',
  },
  {
    id: 'gemini-3.8-flash-medium',
    name: 'Gemini 3.8 Flash (Medium)',
    badge: 'Medium',
    description: 'استهلاك متزن للحصة وسرعة ممتازة للمهام والتعديلات القياسية',
    provider: 'Google',
  },
  {
    id: 'gemini-3.8-flash-low',
    name: 'Gemini 3.8 Flash (Low)',
    badge: 'Fast',
    description: 'استجابة فائقة السرعة وأقل استهلاك للحصة للتعديلات السريعة الخفيفة',
    provider: 'Google',
  },
];

let cachedModels = readDiskCachedModels() || DEFAULT_FALLBACK_MODELS;
let lastModelsFetch = readDiskCachedModels() ? Date.now() : 0;
let isRefreshingModels = false;

function refreshAgyModelsInBackground() {
  if (isRefreshingModels) return;
  isRefreshingModels = true;

  exec(`"${AGY_EXECUTABLE}" models`, { timeout: 90000 }, (error, stdout) => {
    isRefreshingModels = false;
    if (error || !stdout) {
      console.warn('[Models] Background agy models fetch encountered error:', error?.message || 'Empty stdout');
      return;
    }

    const lines = stdout.split('\n');
    const parsed = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('Fetching')) continue;
      const parts = trimmed.split('\t');
      if (parts.length >= 2) {
        const id = parts[0].trim();
        const name = parts[1].trim();

        // Strictly retain gemini-3.8-flash tiers
        if (!id.startsWith('gemini-3.8-flash-')) continue;

        let badge = 'High';
        const provider = 'Google';
        let description = 'النموذج الافتراضي • تفكير عميق وهندسة حركية سينمائية متقدمة';

        if (id.endsWith('-medium')) {
          badge = 'Medium';
          description = 'استهلاك متزن للحصة وسرعة ممتازة للمهام والتعديلات القياسية';
        } else if (id.endsWith('-low')) {
          badge = 'Fast';
          description = 'استجابة فائقة السرعة وأقل استهلاك للحصة للتعديلات السريعة الخفيفة';
        }

        parsed.push({
          id,
          name,
          badge,
          description,
          provider,
        });
      }
    }

    if (parsed.length > 0) {
      const curatedOrder = [
        'gemini-3.8-flash-high',
        'gemini-3.8-flash-medium',
        'gemini-3.8-flash-low',
      ];

      parsed.sort((a, b) => {
        const indexA = curatedOrder.indexOf(a.id);
        const indexB = curatedOrder.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });

      cachedModels = parsed;
      lastModelsFetch = Date.now();
      saveDiskCachedModels(parsed);
      console.log(`[Models] Successfully refreshed and cached ${parsed.length} models from agy.`);
    }
  });
}


app.get('/api/models', (req, res) => {
  const reqMode = req.query.mode;
  const cfg = readAgentConfig();
  const isApiKeyMode = reqMode === 'api_key' || (!reqMode && cfg && cfg.mode === 'api_key');

  if (isApiKeyMode) {
    const provider = (req.query.provider || (cfg && cfg.provider) || 'openrouter').toLowerCase();
    const activeCustomId = (cfg && cfg.modelId) || req.query.modelId || '';

    let providerModels = [];
    if (provider === 'openrouter') {
      providerModels = [
        {
          id: 'liquid/lfm-2.5-2.6b:free',
          name: 'Liquid LFM 2.6B (Free)',
          badge: 'FREE',
          isFree: true,
          description: 'مجاني وفائق السرعة • ممتاز لتعديل المشاهد الفورية',
          provider: 'OpenRouter',
        },
        {
          id: 'meta-llama/llama-3.3-70b-instruct:free',
          name: 'Llama 3.3 70B (Free)',
          badge: 'FREE',
          isFree: true,
          description: 'مجاني وقوي جداً • معالجة ذكية وتفكير برمجي متقدم',
          provider: 'OpenRouter',
        },
        {
          id: 'google/gemini-2.0-flash-exp:free',
          name: 'Gemini 2.0 Flash (Free)',
          badge: 'FREE',
          isFree: true,
          description: 'مجاني من Google عبر OpenRouter • سرعة خارقة',
          provider: 'OpenRouter',
        },
        {
          id: 'google/gemini-2.0-pro-exp-02-05:free',
          name: 'Gemini 2.0 Pro (Free)',
          badge: 'FREE',
          isFree: true,
          description: 'مجاني من Google عبر OpenRouter • تفكير برمجي فائق',
          provider: 'OpenRouter',
        },
        {
          id: 'qwen/qwen-2.5-coder-32b-instruct:free',
          name: 'Qwen 2.5 Coder 32B (Free)',
          badge: 'FREE',
          isFree: true,
          description: 'مجاني ومتخصص في كتابة وتعديل كود البرمجة',
          provider: 'OpenRouter',
        },
        {
          id: 'mistralai/mistral-small-24b-instruct-2501:free',
          name: 'Mistral Small 24B (Free)',
          badge: 'FREE',
          isFree: true,
          description: 'مجاني وسريع ودقيق في تنفيذ التعليمات البرمجية',
          provider: 'OpenRouter',
        },
        {
          id: 'deepseek/deepseek-r1:free',
          name: 'DeepSeek R1 (Free)',
          badge: 'FREE',
          isFree: true,
          description: 'مجاني • استنتاج منطقي عميق وهندسة حركية',
          provider: 'OpenRouter',
        },
        {
          id: 'deepseek/deepseek-chat:free',
          name: 'DeepSeek V3 (Free)',
          badge: 'FREE',
          isFree: true,
          description: 'مجاني • توازن استثنائي بين السرعة والذكاء',
          provider: 'OpenRouter',
        },
        {
          id: 'openchat/openchat-7b:free',
          name: 'OpenChat 7B (Free)',
          badge: 'FREE',
          isFree: true,
          description: 'مجاني وخفيف للمحادثة والتعديلات البسيطة',
          provider: 'OpenRouter',
        },
        {
          id: 'deepseek/deepseek-chat',
          name: 'DeepSeek V3',
          badge: 'Pro Value',
          isFree: false,
          description: 'توازن استثنائي بين السرعة والذكاء البرمجي',
          provider: 'OpenRouter',
        },
        {
          id: 'deepseek/deepseek-r1',
          name: 'DeepSeek R1',
          badge: 'Reasoning',
          isFree: false,
          description: 'استنتاج منطقي عميق وهندسة حركية معقدة',
          provider: 'OpenRouter',
        },
        {
          id: 'anthropic/claude-3.5-sonnet',
          name: 'Claude 3.5 Sonnet',
          badge: 'Opus Grade',
          isFree: false,
          description: 'أعلى دقة للمهام البرمجية وتصميم كود Remotion',
          provider: 'OpenRouter',
        },
        {
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          badge: 'Pro High',
          isFree: false,
          description: 'ذكاء عام متقدم ومتعدد الوسائط',
          provider: 'OpenRouter',
        },
        {
          id: 'openai/gpt-4o-mini',
          name: 'GPT-4o Mini',
          badge: 'Fast',
          isFree: false,
          description: 'استجابة سريعة واقتصادي جداً',
          provider: 'OpenRouter',
        },
      ];
    } else if (provider === 'deepseek') {
      providerModels = [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek V3 (Chat)',
          badge: 'Default',
          isFree: false,
          description: 'النموذج الافتراضي • سريع وفائق الدقة في البرمجة',
          provider: 'DeepSeek',
        },
        {
          id: 'deepseek-reasoner',
          name: 'DeepSeek R1 (Reasoner)',
          badge: 'Reasoning',
          isFree: false,
          description: 'استدلال برمجي عميق وهندسة بصرية متقدمة',
          provider: 'DeepSeek',
        },
      ];
    } else if (provider === 'anthropic') {
      providerModels = [
        {
          id: 'claude-3-7-sonnet-20250219',
          name: 'Claude 3.7 Sonnet',
          badge: 'Hybrid Think',
          isFree: false,
          description: 'الجيل الأحدث • قدرات هجينة وتفكير عميق',
          provider: 'Anthropic',
        },
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          badge: 'Default',
          isFree: false,
          description: 'أعلى دقة وموثوقية في كتابة وتعديل كود Remotion',
          provider: 'Anthropic',
        },
        {
          id: 'claude-3-5-haiku-20241022',
          name: 'Claude 3.5 Haiku',
          badge: 'Fast',
          isFree: false,
          description: 'استجابة فائقة السرعة للمهام والتعديلات البسيطة',
          provider: 'Anthropic',
        },
      ];
    } else if (provider === 'openai') {
      providerModels = [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          badge: 'Default',
          isFree: false,
          description: 'ذكاء عام متقدم ومناسب لجميع مهام الفيديو',
          provider: 'OpenAI',
        },
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          badge: 'Fast',
          isFree: false,
          description: 'استجابة فائقة السرعة واقتصادي',
          provider: 'OpenAI',
        },
        {
          id: 'o3-mini',
          name: 'o3-mini',
          badge: 'Reasoning',
          isFree: false,
          description: 'استنتاج منطقي برمجي متقدم',
          provider: 'OpenAI',
        },
      ];
    } else if (provider === 'google_ai_studio' || provider === 'google') {
      providerModels = [
        {
          id: 'gemini-3.8-flash-high',
          name: 'Gemini 3.8 Flash (High)',
          badge: 'High',
          isFree: false,
          description: 'النموذج الافتراضي • تفكير عميق وهندسة حركية سينمائية متقدمة',
          provider: 'Google AI Studio',
        },
        {
          id: 'gemini-3.8-flash-medium',
          name: 'Gemini 3.8 Flash (Medium)',
          badge: 'Medium',
          isFree: false,
          description: 'استهلاك متزن للحصة وسرعة ممتازة للمهام والتعديلات القياسية',
          provider: 'Google AI Studio',
        },
        {
          id: 'gemini-3.8-flash-low',
          name: 'Gemini 3.8 Flash (Low)',
          badge: 'Fast',
          isFree: false,
          description: 'استجابة فائقة السرعة وأقل استهلاك للحصة للتعديلات السريعة الخفيفة',
          provider: 'Google AI Studio',
        },
      ];
    } else {
      providerModels = [
        {
          id: activeCustomId || 'custom-model',
          name: activeCustomId || 'Custom Model',
          badge: 'Custom',
          isFree: false,
          description: 'نموذج مخصص عبر واجهة API',
          provider: provider.toUpperCase(),
        },
      ];
    }

    if (activeCustomId) {
      const existingIdx = providerModels.findIndex((m) => m.id === activeCustomId);
      if (existingIdx !== -1) {
        const [foundModel] = providerModels.splice(existingIdx, 1);
        providerModels.unshift({
          ...foundModel,
          badge: foundModel.isFree ? 'FREE Active' : 'Active',
        });
      } else {
        providerModels.unshift({
          id: activeCustomId,
          name: activeCustomId,
          badge: activeCustomId.includes(':free') ? 'FREE Active' : 'Custom Active',
          description: 'النموذج المحدد في إعداداتك حالياً',
          provider: provider.toUpperCase(),
          isCustom: true,
          isFree: activeCustomId.includes(':free'),
        });
      }
    }

    return res.json({ models: providerModels, mode: 'api_key', provider });
  }

  const now = Date.now();
  // Trigger background refresh if cache is older than 30 minutes
  if (!lastModelsFetch || now - lastModelsFetch > 30 * 60 * 1000) {
    refreshAgyModelsInBackground();
  }

  // Return cached models immediately, ensuring strictly gemini-3.8-flash tiers
  const candidateList = (cachedModels && Array.isArray(cachedModels) && cachedModels.length > 0)
    ? cachedModels
    : DEFAULT_FALLBACK_MODELS;
  const filteredList = candidateList.filter((m) => m && typeof m.id === 'string' && m.id.startsWith('gemini-3.8-flash-'));
  const modelsToReturn = filteredList.length > 0 ? filteredList : DEFAULT_FALLBACK_MODELS;

  return res.json({ models: modelsToReturn, mode: 'google', provider: 'google' });
});

// Endpoint to register/activate custom user model ID
app.post('/api/models/custom', (req, res) => {
  const { modelId } = req.body;
  if (!modelId || typeof modelId !== 'string') {
    return res.status(400).json({ error: 'معرف النموذج غير صالح' });
  }
  const cleanId = modelId.trim();
  const current = readAgentConfig() || {};
  current.modelId = cleanId;
  current.updatedAt = Date.now();
  saveAgentConfig(current);
  console.log(`[API /api/models/custom] Activated and saved custom model ID: ${cleanId}`);
  res.json({ success: true, modelId: cleanId });
});

const DEFAULT_MODEL_ID = 'gemini-3.8-flash-high';
// CLI model IDs: lowercase letters, digits, dots, dashes; must not start with "-" (argument injection)
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9.-]{0,63}$/;

function normalizeModelId(inputModel) {
  if (typeof inputModel !== 'string' || !inputModel.trim()) return DEFAULT_MODEL_ID;
  const str = inputModel.toLowerCase().trim();

  // If already exact gemini-3.8-flash tier
  if (str === 'gemini-3.8-flash-high' || str === 'gemini-3.8-flash-medium' || str === 'gemini-3.8-flash-low') {
    return str;
  }

  // Shorthand aliases & reasoning effort mapping
  if (str.includes('low')) return 'gemini-3.8-flash-low';
  if (str.includes('medium') || str.includes('med')) return 'gemini-3.8-flash-medium';
  if (str.includes('high') || str.includes('3.8') || str.includes('flash') || str.includes('gemini') || str.includes('3.7') || str.includes('3.6') || str.includes('pro')) {
    return 'gemini-3.8-flash-high';
  }

  if (MODEL_ID_PATTERN.test(str)) {
    return str;
  }
  return DEFAULT_MODEL_ID;
}

// Only raster image types are accepted; SVG/HTML would be served back from this origin (stored XSS)
const ALLOWED_IMAGE_MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const ALLOWED_AUDIO_MIME_EXT = {
  'audio/mp3': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
};

const ALLOWED_VIDEO_MIME_EXT = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'mp4',
};

// ==========================================
// Reference Video Upload & Keyframes Endpoint
// ==========================================
app.post('/api/upload-reference-video', (req, res) => {
  try {
    const { name, size, durationSeconds, durationFrames, videoBase64, keyframes } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'اسم ملف الفيديو مطلوب.' });
    }

    const dur = Number(durationSeconds);
    if (!Number.isFinite(dur) || dur <= 0) {
      return res.status(400).json({ success: false, error: 'مدة الفيديو غير صالحة.' });
    }

    // Protection limit: reject videos longer than 32 seconds to protect memory and prevent context collapse
    if (dur > 32) {
      return res.status(400).json({
        success: false,
        error: `مدة الفيديو (${dur.toFixed(1)} ثانية) تتجاوز الحد الأقصى المسموح (30 ثانية). يرجى اختيار مقطع قصير لا يتعدى 30 ثانية لتفادي استهلاك الذاكرة.`,
      });
    }

    let ext = 'mp4';
    let base64Data = null;

    if (videoBase64 && typeof videoBase64 === 'string') {
      const match = videoBase64.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1].toLowerCase();
        ext = ALLOWED_VIDEO_MIME_EXT[mimeType] || 'mp4';
        base64Data = match[2];
      }
    }

    const safeTimestamp = Date.now();
    const cleanBaseName = path.basename(name, path.extname(name)).replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_').slice(0, 40) || 'ref_video';
    const videoFileName = `ref_${cleanBaseName}_${safeTimestamp}.${ext}`;

    const fullPublicVideoPath = path.join(PUBLIC_VIDEOS_DIR, videoFileName);
    const fullChatVideoPath = path.join(CHAT_VIDEOS_DIR, videoFileName);

    if (base64Data) {
      const videoBuffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(fullPublicVideoPath, videoBuffer);
      fs.writeFileSync(fullChatVideoPath, videoBuffer);
    }

    // Process and save keyframe images
    const savedKeyframes = [];
    if (Array.isArray(keyframes)) {
      for (let i = 0; i < keyframes.length; i++) {
        const kf = keyframes[i];
        if (!kf || !kf.dataUrl) continue;

        try {
          const kfMatch = kf.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (kfMatch) {
            const kfBuffer = Buffer.from(kfMatch[2], 'base64');
            const kfFileName = `keyframe_${safeTimestamp}_${i}.jpg`;
            const fullKfPublicPath = path.join(PUBLIC_IMAGES_DIR, kfFileName);
            const fullKfChatPath = path.join(CHAT_UPLOADS_DIR, kfFileName);

            fs.writeFileSync(fullKfPublicPath, kfBuffer);
            fs.writeFileSync(fullKfChatPath, kfBuffer);

            savedKeyframes.push({
              timeSeconds: Number(kf.timeSeconds) || 0,
              frameIndex: Number(kf.frameIndex) || Math.round((Number(kf.timeSeconds) || 0) * 30),
              serverUrl: `/api/images/uploads/${kfFileName}`,
              relativePath: `images/uploads/${kfFileName}`,
              fullPath: fullKfPublicPath,
            });
          }
        } catch (kfErr) {
          console.warn(`[API] Failed to save keyframe ${i}:`, kfErr.message);
        }
      }
    }

    const relativeRemotionPath = `videos/uploads/${videoFileName}`;
    const serverUrl = `/api/videos/uploads/${videoFileName}`;
    const firstKeyframe = savedKeyframes[0];
    const thumbUrl = firstKeyframe ? firstKeyframe.serverUrl : undefined;

    res.json({
      success: true,
      video: {
        id: `video_${safeTimestamp}`,
        name,
        durationSeconds: dur,
        durationFrames: Number(durationFrames) || Math.round(dur * 30),
        size: Number(size) || 0,
        serverUrl,
        relativePath: relativeRemotionPath,
        fullPath: fullPublicVideoPath,
        thumbnailUrl: thumbUrl,
        keyframes: savedKeyframes,
      },
    });
  } catch (err) {
    console.error('[API /api/upload-reference-video] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function getToolActionTitle(toolName, params) {
  if (toolName === 'view_file') {
    const p = (params?.AbsolutePath || '').toLowerCase();
    if (p.endsWith('.mp4') || p.endsWith('.mov') || p.endsWith('.webm') || p.endsWith('.mkv')) {
      return 'معاينة وفحص الفيديو المرجعي الأصلي';
    }
    return 'قراءة وفحص ملف في المشروع';
  }
  if (toolName === 'replace_file_content' || toolName === 'sed_file' || toolName === 'multi_replace_file_content') {
    return 'تعديل كود وعناصر المشهد';
  }
  if (toolName === 'write_to_file') {
    return 'كتابة وحفظ ملف المشهد';
  }
  if (toolName === 'run_command') {
    const cmd = (params?.CommandLine || '').toLowerCase();
    if (cmd.includes('check') || cmd.includes('test') || cmd.includes('tsc')) {
      return 'تشغيل فحص التحقق من المشهد';
    }
    return 'تنفيذ أمر في النظام';
  }
  if (toolName === 'grep_search' || toolName === 'find_by_name' || toolName === 'list_dir') {
    return 'استكشاف بنية المشروع';
  }
  return `تنفيذ أداة: ${toolName}`;
}

function getToolTargetLabel(params) {
  if (!params || typeof params !== 'object') return '';
  const target = params.AbsolutePath || params.TargetFile || params.Target || params.CommandLine || '';
  if (typeof target === 'string' && target.trim().length > 0) {
    const cleanTarget = target.trim();
    if (cleanTarget.includes('\\') || cleanTarget.includes('/')) {
      return path.basename(cleanTarget);
    }
    return cleanTarget.length > 50 ? cleanTarget.slice(0, 47) + '...' : cleanTarget;
  }
  return '';
}

// ==========================================
// SSE Streaming Chat Endpoint to trigger agy
// ==========================================
app.post('/api/chat', (req, res) => {
  const { prompt, continueConversation, model, sessionId, images, audio, video, language: uiLanguage } = req.body;
  const effectiveModel = normalizeModelId(model);

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Valid prompt is required.' });
  }
  if (sessionId !== undefined && sessionId !== null && !isValidSessionId(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' });
  }

  console.log(`[API /api/chat] Received prompt: "${prompt}" (model: ${effectiveModel}, continue: ${continueConversation}, session: ${sessionId}, images: ${Array.isArray(images) ? images.length : 0}, audio: ${Boolean(audio)})`);

  // Handle multimodal image attachments
  let multimodalContext = '';
  const savedImages = [];

  if (images && Array.isArray(images) && images.length > 0) {
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img.dataUrl || typeof img.dataUrl !== 'string') continue;

      try {
        const matches = img.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1].toLowerCase();
          const base64Data = matches[2];
          const ext = ALLOWED_IMAGE_MIME_EXT[mimeType];
          if (!ext) {
            console.warn(`[API /api/chat] Rejected unsupported image type: ${mimeType}`);
            continue;
          }
          const safeFrame = Number.isFinite(Number(img.frame)) ? Math.max(0, Math.trunc(Number(img.frame))) : 0;
          const fileName = `${img.source === 'snapshot' ? 'snapshot_frame_' + safeFrame : 'asset'}_${Date.now()}_${i}.${ext}`;

          const fullPublicPath = path.join(PUBLIC_IMAGES_DIR, fileName);
          const fullChatPath = path.join(CHAT_UPLOADS_DIR, fileName);
          const buffer = Buffer.from(base64Data, 'base64');

          fs.writeFileSync(fullPublicPath, buffer);
          fs.writeFileSync(fullChatPath, buffer);

          const relativeRemotionPath = `images/uploads/${fileName}`;
          const serverUrl = `/api/images/uploads/${fileName}`;

          savedImages.push({
            id: img.id || `img_${Date.now()}_${i}`,
            name: img.name || fileName,
            source: img.source,
            frame: img.frame,
            timeSeconds: img.timeSeconds,
            dataUrl: img.dataUrl,
            serverUrl,
            fileName,
            relativePath: relativeRemotionPath,
            fullPath: fullPublicPath,
          });

          multimodalContext += `\n- [مرفق بصري ${i + 1}]: "${img.name || fileName}"
  * نوع المرفق: ${img.source === 'snapshot' ? `لقطة شاشة من المشهد الحالي عند الإطار ${img.frame || 0}` : 'صورة مرفقة من المستخدم'}
  * مسار الملف في مساحة العمل: "${fullPublicPath}"
  * لاستخدامها كعنصر بصري داخل كود Remotion في Scene.tsx:
    import { staticFile, Img } from 'remotion';
    <Img src={staticFile('${relativeRemotionPath}')} style={{ ... }} />\n`;
        }
      } catch (err) {
        console.error(`[API /api/chat] Failed to process image ${i}:`, err.message);
      }
    }
  }

  // Handle attached audio voiceover
  let audioContext = '';
  let savedAudio = null;

  if (audio && audio.dataUrl && typeof audio.dataUrl === 'string') {
    try {
      const matches = audio.dataUrl.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1].toLowerCase();
        const base64Data = matches[2];
        const ext = ALLOWED_AUDIO_MIME_EXT[mimeType] || 'mp3';
        const fileName = `voiceover_${Date.now()}.${ext}`;

        const fullAudioPath = path.join(PUBLIC_UPLOADS_DIR, fileName);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(fullAudioPath, buffer);

        // Also save canonical copy in public/audio
        try {
          fs.writeFileSync(path.join(PUBLIC_AUDIO_DIR, `voiceover.${ext}`), buffer);
        } catch (_) {}

        const relativeRemotionPath = `audio/uploads/${fileName}`;
        const durationSec = typeof audio.durationSeconds === 'number' && audio.durationSeconds > 0
          ? audio.durationSeconds
          : 10;
        const durationFrames = typeof audio.durationFrames === 'number' && audio.durationFrames > 0
          ? audio.durationFrames
          : Math.round(durationSec * 30);

        savedAudio = {
          id: audio.id || `audio_${Date.now()}`,
          name: audio.name || fileName,
          durationSeconds: durationSec,
          durationFrames,
          transcript: audio.transcript || '',
          source: audio.source || 'recorded',
          serverUrl: `/audio/uploads/${fileName}`,
          relativePath: relativeRemotionPath,
          fullPath: fullAudioPath,
        };

        const isVoiceover = audio.mode === 'voiceover';

        if (isVoiceover) {
          audioContext = `\n- [ملف التعليق الصوتي المرفق (Voiceover Audio)]:
  * اسم الملف: "${savedAudio.name}"
  * المدة الزمنية الحقيقية للصوت: ${durationSec.toFixed(1)} ثانية.
  * عدد الإطارات المستهدفة لمطابقة الصوت بدقة: ${durationFrames} إطار (بمعدل 30 إطار/ثانية).
  * مسار الملف في مساحة العمل: "${fullAudioPath}"
  ${audio.transcript ? `* تفريغ نص الكلام المنطوق في التعليق الصوتي:\n  "${audio.transcript}"\n` : ''}
  * طريقة استدعاء وتشغيل الصوت داخل كود Remotion في Scene.tsx:
    import { Audio, staticFile } from 'remotion';
    <Audio src={staticFile('${relativeRemotionPath}')} />
  * إرشادات التزامن الحركي والصوتي الإلزامية:
    1. حدّد مدة المشهد بدقة لتطابق مدة الصوت: export const DURATION_IN_FRAMES = ${durationFrames};
    2. نسّق الحركات الانتقالية وظهور البطاقات والعناوين والأيقونات لتتزامن بدقة مع الجمل والكلمات المنطوقة في التعليق الصوتي.`;
        } else {
          audioContext = `\n- [تسجيل صوتي من المستخدم (محادثة أو توجيه برمجيات)]:
  * اسم الملف: "${savedAudio.name}"
  * مسار الملف في مساحة العمل: "${fullAudioPath}"
  ${audio.transcript ? `* نص الأمر المنطوق بصوت المستخدم:\n  "${audio.transcript}"\n` : ''}
  * إرشادات صارمة وحاسمة للوكيل:
    1. هذا تسجيل صوتي من المستخدم يتحدث معك (محادثة أو استفسار أو أمر لتعديل المشهد).
    2. تنبيه حاسم: لا تضف هذا التسجيل الصوتي إلى الفيديو إطلاقاً، ولا تضعه في التايم لاين، ولا تستخدم مكوّن <Audio /> له، ولا تغيّر DURATION_IN_FRAMES بناءً على طوله.
    3. تصنيف طلب المستخدم:
       - إذا كان كلام المستخدم مجرد تحية أو سؤال أو محادثة عادية (مثل: "أهلاً"، "كيف حالك"، "ما رأيك"):
         أجب عليه فوراً كنص عادي وودود واحترافي في المحادثة. لا تقم بتعديل كود المشهد (Scene.tsx) إطلاقاً ولا تستدعِ أي أدوات نهائياً.
       - إذا كان كلام المستخدم أمراً برمجياً لتعديل المشهد (مثل: "غير لون الخلفية"، "أضف نصاً"):
         قم بتطبيق التعديل المطلوب برمجياً في Scene.tsx.`;
        }
      }
    } catch (audioErr) {
      console.error('[API /api/chat] Failed to process audio attachment:', audioErr.message);
    }
  }

  // Handle reference video attachment
  let videoContext = '';
  let savedVideo = null;

  if (video && typeof video === 'object') {
    try {
      const durSec = Number(video.durationSeconds) || 10;
      const durFrames = Number(video.durationFrames) || Math.round(durSec * 30);
      const vName = video.name || 'reference_video.mp4';
      const keyframesList = Array.isArray(video.keyframes) ? video.keyframes : [];

      let resolvedFullPath = video.fullPath;
      if (!resolvedFullPath && video.name) {
        const candidate = path.join(PUBLIC_VIDEOS_DIR, video.name);
        if (fs.existsSync(candidate)) {
          resolvedFullPath = candidate;
        }
      }
      if (resolvedFullPath && !path.isAbsolute(resolvedFullPath)) {
        resolvedFullPath = path.resolve(TEMPLATE_DIR, resolvedFullPath);
      }

      savedVideo = {
        id: video.id || `video_${Date.now()}`,
        name: vName,
        durationSeconds: durSec,
        durationFrames: durFrames,
        serverUrl: video.serverUrl,
        fullPath: resolvedFullPath,
        thumbnailUrl: video.thumbnailUrl,
        keyframes: keyframesList,
      };

      videoContext = `\n- [فيديو مرجعي ملهم من المستخدم (Reference Motion Graphics Video)]:
  * اسم الملف: "${savedVideo.name}"
  * المدة الزمنية للفيديو المرجعي: ${durSec.toFixed(1)} ثانية.
  * عدد الإطارات المقابلة للمدة: ${durFrames} إطار (بمعدل 30 إطار/ثانية).
  ${savedVideo.fullPath ? `* مسار ملف الفيديو الأصلي الكامل في مساحة العمل (Native MP4 File): "${savedVideo.fullPath}"` : ''}
  * إرشادات التحليل والإخراج الإبداعي الإلزامية للوكيل:
    1. خطوة أولى وإلزامية: استدعِ أداة view_file مباشرة على مسار ملف الفيديو الأصلي:
       view_file(AbsolutePath: "${savedVideo.fullPath}")
       يدعم نظام AGY قراءة ومعاينة ملفات الفيديو (MP4) بصرياً وصوتياً بكامل ثوانيها وانتقالاتها ونصوصها ثانية بثانية دون أي نقص.
    2. تفحص تدفق الفيديو المرجعي بدقة:
       - النصوص والعبارات المكتوبة وتسلسل ظهورها وتوقيتها.
       - الحركات والانتقالات الفيزيائية بين المشاهد (Spring Animations).
       - لوحة الألوان والخلفيات والمؤثرات البصرية.
       - الصوت والمؤثرات الصوتية وتوافقها مع الحركات.
    3. أعد بناء وتصميم المشهد في Scene.tsx كوداً تفاعلياً كاملاً بالـ Remotion ليعكس نفس الاحترافية والحيوية والإبداع.
    4. سجّل كافة النصوص والبطاقات في src/scene-data.json بالمسارات والأوقات الصحيحة.`;
    } catch (vErr) {
      console.error('[API /api/chat] Failed to process video context:', vErr.message);
    }
  }

  let effectivePrompt = prompt;
  if (multimodalContext) {
    effectivePrompt = `${effectivePrompt}\n\n[معلومات المرفقات البصرية]:${multimodalContext}\nتعليمات للوكيل: تم إرفاق الصور أعلاه وهي موجودة في مساحة العمل. يمكنك استخدام أداة view_file لمعاينتها وتحليلها بصرياً وتعديل الكود بناءً على ما تراه أو إدراجها كصورة داخل المشهد.`;
  }
  if (audioContext) {
    if (audio.mode === 'voiceover') {
      effectivePrompt = `${effectivePrompt}\n\n[معلومات التعليق الصوتي والتزامن الزمني - أمر تصميم فيديو إلزامي]:${audioContext}\nتعليمات حاسمة وإلزامية للوكيل (هذا أمر تصميم فيديو وليس محادثة عادية مهما كان نص المستخدم):\n1. خطوة أولى إلزامية: استدعِ أداة view_file فوراً على مسار ملف التعليق الصوتي "${savedAudio.fullPath}" لمعاينة محتواه الكلامي واستخراج النصوص المنطوقة.\n2. خطوة ثانية إلزامية: صمم وابرمج مشهداً سينمائياً كاملاً في src/Scene.tsx يعرض النصوص والعناوين والبطاقات الحركية بتزامن دقيق مع مدة الصوت.\n3. حدّد DURATION_IN_FRAMES = ${savedAudio.durationFrames} واستدعِ مكوّن <Audio src={staticFile('${savedAudio.relativePath}')} /> في Scene.tsx.\n4. ممنوع منعاً باتاً إنهاء الرد دون تعديل فعلي على كود Scene.tsx. عدد التعديلات على Scene.tsx يجب أن يكون أكبر من صفر.`;
    } else {
      effectivePrompt = `${effectivePrompt}\n\n[معلومات التوجيه والمحادثة الصوتية]:${audioContext}\nتعليمات للوكيل: استمع إلى صوت المستخدم. إذا كان مجرد تحية أو سؤال أو محادثة عادية، أجب عليه فوراً بلباقة في الشات دون استدعاء أي أدوات لتعديل المشهد. وإذا كان طلباً لتعديل المشهد، فنفذ التعديل في Scene.tsx دون وضع الصوت في الفيديو.`;
    }
  }
  if (videoContext) {
    effectivePrompt = `${effectivePrompt}\n\n[معلومات الفيديو المرجعي الكامل]:${videoContext}\nتوجيه إلزامي حاسم للوكيل:
1. استدعِ أداة view_file فوراً لمعاينة الفيديو المرجعي الأصلي على المسار "${savedVideo.fullPath}".
2. فور معاينة الفيديو، توجّه مباشرة إلى كتابة وتصميم كود المشهد في src/Scene.tsx وتحديث src/scene-data.json.
3. ممنوع نهائياً تشغيل أوامر بحث عشوائية في مساحة العمل (مثل Get-ChildItem -Recurse أو استكشاف node_modules). ركّز كامل وقتك على إنجاز كود المشهد في src/Scene.tsx و src/scene-data.json والتحقق منه فوراً.`;
  }

  // Determine target language: if prompt contains Arabic, use Arabic; otherwise mirror English or UI language
  const isArabicPrompt = /[\u0600-\u06FF]/.test(prompt);
  const targetLang = isArabicPrompt ? 'ar' : (uiLanguage === 'ar' ? 'ar' : 'en');

  const languageDirective = targetLang === 'en'
    ? `[MANDATORY LANGUAGE & COMMUNICATION POLICY]:
- The user is communicating in ENGLISH. You MUST respond, explain your actions, and interact with the user ENTIRELY IN ENGLISH.
- NEVER respond in Arabic to an English request.
- Create on-screen video texts, titles, cards, and metadata in ENGLISH (using 'Plus Jakarta Sans' font).`
    : `[قاعدة لغة الرد والتواصل الإلزامية]:
- المستخدم يتواصل باللغة العربية. يجب أن يكون ردك وشرحك كاملاً باللغة العربية الفصحى.
- أنشئ النصوص والعناوين والبطاقات باللغة العربية (باستخدام خط 'Cairo').`;

  const motionStandards = targetLang === 'en'
    ? `[MANDATORY AFTER EFFECTS GRADE MOTION STANDARDS]:
- Direct the scene with premier motion graphics aesthetics (After Effects Quality): deep radial glows, refined glassmorphism, sophisticated color palettes, kinetic typography (Plus Jakarta Sans for English), and cohesive interactive cards (STRICT ZERO-EMOJI POLICY).
- Motion Physics: Use Remotion spring() smoothly, orchestrate staggered entrance animations (3-6 frames apart), and maintain continuous ambient floating motion.
- Full Responsiveness: Use useVideoConfig() metrics so the scene looks stunning across 16:9, 9:16, and 1:1 without clipping.
- Unified SceneItem Contract: Every visible element (text, card, button) in Scene.tsx must be rendered via <SceneItem id="..."> reading all data from src/scene-data.json.
- Compound Components: Interactive buttons and cards must be a single unified track on the timeline.
- Strict Audio Policy: Never add audio tracks unless an actual audio file exists in the workspace.
- Timing & Split: Elements that do not persist to the end must have holdToEnd: false with concrete durationInFrames.
- Procedural Backgrounds: SVG/canvas backgrounds must be coded directly in src/Scene.tsx.
- User Feedback: If the user requests an adjustment or fix, apply concrete code diffs in src/Scene.tsx.
- If the user's prompt is a simple greeting or conversation with no media attachments, reply conversationally in English without touching code.`
    : `[معايير الإخراج الفني والموشن جرافيك الإلزامية]:
- أخرج المشهد بأعلى درجات الفخامة والاحترافية الحركية (After Effects Quality): خلفيات سينمائية ذات إضاءة شعاعية عميقة، زجاج بلوري مصقول (Glassmorphism)، تدرجات لونية راقية، طباعة حركية أنيقة بالخط العربي (Cairo)، وبطاقات تفاعلية متناسقة (مع منع الإيموجي نهائياً).
- فيزياء الحركة: استخدم spring بانسيابية ناعمة، ووزع ظهور العناصر بتتابع زمني مدروس (Staggered Animations)، مع إبقاء المشهد نابضاً بالحركة المستمرة (Ambient Floating Motion).
- التجاوب الكامل: استخدم useVideoConfig() والمقاييس الديناميكية ليظهر المشهد بأبهى حلة في 16:9 و 9:16 و 1:1 دون أي قص أو خروج عن الإطار.
- قاعدة معمارية حاسمة لنظام التايم لاين والربط الموحد (Unified SceneItem Contract):
  1. كل عنصر مرئي (نص أو بطاقة أو زر) في المشهد يجب عرضه عبر مكوّن <SceneItem id="..."> في Scene.tsx وقراءة توقيته وبياناته بالكامل من src/scene-data.json.
  2. تسمية العناصر المركبة والبطاقات: يجب إعطاء كافة البطاقات والأزرار أسماء واضحة ودقيقة بلغة المشهد في خاصية name.
  3. دمج المكونات المركبة: الأزرار والبطاقات التفاعلية تكون مساراً واحداً موحداً في التايم لاين يجمع الخلفية والأيقونة والنص دون تفكيكها إلى مسارين منفصلين مشتتين.
  4. سياسة الصوت الصارمة: يُمنع منعاً باتاً إضافة مسارات صوتية أو استدعاء ملفات صوت غير موجودة. الصوت يُضاف فقط عندما يوفّر المستخدم ملف صوت حقيقي بالفعل. في حال عدم وجود ملف صوت، يجب أن تظل مصفوفة audio في scene-data.json فارغة [] دون أي مسارات وهمية.
  5. التوقيت والقص: العناصر التي لا تستمر للنهاية يجب أن تكون holdToEnd: false مع تحديد durationInFrames بدقة ليعمل القص اليدوي وأداة التقسيم (Split) بسلاسة.
  6. عند إضافة أو تعديل عناصر، حافظ على التعديلات اليدوية السابقة للمستخدم في scene-data.json دون مسحها أو استبدالها.
- قاعدة حاسمة لتصميم وبرمجة الخلفيات والأنماط البصرية (Procedural Animated Backgrounds Rule):
  1. ملف src/scene-data.json هو مجرد ملف بيانات وصفية لتوقيت وأسماء العناصر، ولا يحتوي على أي محرك لرسم الخلفيات تلقائياً!
  2. أي خلفية يطلبها المستخدم (مثل خلفية طوبوغرافية عضوية، خطوط متحركة، أمواج، شبكات هندسية، جزيئات، تدرجات ضوئية، أو أنماط مستوحاة من صورة مرفقة) يجب برمجتها كوداً فعلياً مباشراً داخل src/Scene.tsx في طبقة الخلفية (داخل مكوّن AbsoluteFill تحت كافة العناصر) باستخدام عناصر SVG مسارات منحنية (<path d="...">) أو Canvas أو معادلات رياضية تعتمد على frame.
  3. يُمنع منعاً باتاً الاكتفاء بإضافة مدخل إلى scene-data.json دون كتابة كود الرسم المقابل له في src/Scene.tsx.
- قاعدة صارمة لمعالجة ملاحظات وشكاوى المستخدم ومنع الهلوسة الصفرية (Zero-Diff Hallucination Prevention):
  1. إذا اشتكى المستخدم من عدم ظهور عنصر أو عدم تطبيق خلفية أو قال ("لم تظهر الخلفية"، "لم يتغير شيء"، أو ما شابه)، يُمنع منعاً باتاً الاكتفاء بأوامر فحص فقط مثل npm run check ثم الادعاء بالنجاح دون لمس الكود!
  2. يجب فوراً فحص كود src/Scene.tsx وتحديد الجزء المفقود وبرمجته فعلياً داخل src/Scene.tsx.
  3. إنهاء دور الوكيل والادعاء بالنجاح بينما عدد التعديلات على كود Scene.tsx هو صفر يُعد خطأً جسيماً وهلوسة مرفوضة.
- إذا كان طلب المستخدم مجرد محادثة أو تحية عادية ${audio && audio.mode === 'voiceover' ? 'ولكن يوجد تعليق صوتي مرفق (voiceover)، فهذا أمر تصميم فيديو وليس محادثة عادية! يجب تعديل كود Scene.tsx و scene-data.json فوراً لإنشاء مشهد متزامن مع التعليق الصوتي حتى لو كان نص المستخدم مجرد تحية.' : 'ولا يوجد مرفق صوتي أو بصري، أجب عليه كنص فقط دون تعديل الكود.'} أما إذا كان طلباً لتصميم أو تعديل الفيديو، فطبق هذه المعايير بأعلى إبداع.`;

  effectivePrompt = `${effectivePrompt}\n\n${languageDirective}\n\n${motionStandards}`;

  // Load target session metadata if available
  const sessionFile = sessionId ? path.join(SESSIONS_DIR, `${sessionId}.json`) : null;
  let sessionData = null;
  if (sessionFile && fs.existsSync(sessionFile)) {
    try {
      sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    } catch (e) {
      console.error(`[API] Failed to parse session file for /api/chat:`, e.message);
    }
  }

  // Pre-synchronize Scene.tsx with current session sceneCode before agy inspects or edits files
  if (sessionData && sessionData.sceneCode && fs.existsSync(ACTIVE_SCENE_PATH)) {
    try {
      const currentDiskCode = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');
      if (currentDiskCode !== sessionData.sceneCode) {
        fs.writeFileSync(ACTIVE_SCENE_PATH, sessionData.sceneCode, 'utf8');
        console.log(`[API] Pre-synchronized Scene.tsx with session ${sessionId} code before invoking agy.`);
      }
    } catch (syncErr) {
      console.warn(`[API] Could not pre-sync Scene.tsx:`, syncErr.message);
    }
  }

  // Set headers for Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Socket Keep-Alive & Timeout Prevention
  if (req.socket) {
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);
  }

  // SSE Keepalive heartbeat every 7 seconds to keep browser & proxy connections alive
  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keepalive\n\n');
    }
  }, 7000);

  const sendEvent = (event, payload) => {
    const finalPayload = typeof payload === 'object' && payload !== null
      ? { ...payload, event: payload.event || event }
      : { event, data: payload };
    res.write(`event: ${event}\ndata: ${JSON.stringify(finalPayload)}\n\n`);
  };

  sendEvent('start', { message: 'Spawning agy agent session...', timestamp: Date.now() });
  if (savedImages.length > 0) {
    sendEvent('saved_images', { images: savedImages });
  }
  if (savedAudio) {
    sendEvent('saved_audio', { audio: savedAudio });
  }

  // Inject clean recent conversation context (last 3 messages) without passing bloated conversation histories
  if (sessionData && Array.isArray(sessionData.messages) && sessionData.messages.length > 1) {
    const previousMessages = sessionData.messages.slice(-4);
    const contextSummary = previousMessages
      .map((m) => `[${m.sender === 'user' ? 'طلب المستخدم' : 'رد الوكيل'}]: ${m.text || ''}`)
      .join('\n');
    if (contextSummary.trim()) {
      effectivePrompt = `${effectivePrompt}\n\n[سياق الرسائل والمحادثة السابقة في هذا المشروع]:\n${contextSummary}`;
    }
  }

  // Inject Speed & Immediate Completion Directive
  effectivePrompt = `${effectivePrompt}\n\n[توجيه حاسم للسرعة والتركيز]:
- نفّذ التعديل المطلوب على Scene.tsx و scene-data.json مباشرة في خطوة أو خطوتين دون قراءة متكررة لنفس الملف أو دوران في حلقات.
- عند طلب تعديل بصري أو شكوى من عدم ظهور شيء، تأكد دائماً أنك قمت بتعديل وحقن الكود الفعلي في src/Scene.tsx قبل إنهاء الرد.
- فور إنجاز التعديل الفعلي، لخّص ما أنجزته وأنهِ ردك للمستخدم فوراً لتوفير الوقت.`;

  const sessionKey = sessionId || 'default';
  const agentConfig = readAgentConfig();
  const isApiKeyMode = req.body.agentMode === 'api_key' || (agentConfig && agentConfig.mode === 'api_key' && agentConfig.apiKey);

  if (isApiKeyMode) {
    console.log(`[API /api/chat] Dispatching to Custom Agent Engine (${agentConfig.provider} • ${agentConfig.modelId})...`);
    const abortController = new AbortController();
    activeCustomAgentControllers.set(sessionKey, abortController);

    let resolvedModelId = req.body.model || agentConfig.modelId || ((agentConfig.provider === 'google' || agentConfig.provider === 'google_ai_studio') ? 'gemini-3.8-flash-high' : 'liquid/lfm-2.5-2.6b:free');

    runCustomAgentTurn({
      prompt: effectivePrompt,
      provider: agentConfig.provider || 'openrouter',
      apiKey: agentConfig.apiKey,
      modelId: resolvedModelId,
      customBaseUrl: agentConfig.customBaseUrl,
      templateDir: TEMPLATE_DIR,
      sessionId,
      sendEvent,
      signal: abortController.signal,
    }).then((turnResult) => {
      clearInterval(heartbeatInterval);
      activeCustomAgentControllers.delete(sessionKey);

      if (sessionId) {
        try {
          const sFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
          if (fs.existsSync(sFile)) {
            const sData = JSON.parse(fs.readFileSync(sFile, 'utf8'));
            if (fs.existsSync(ACTIVE_SCENE_PATH)) sData.sceneCode = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');
            if (fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
              try { sData.sceneData = JSON.parse(fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8')); } catch (_) {}
            }
            if (turnResult?.diffSummaries?.length > 0) sData.lastDiffSummary = turnResult.diffSummaries;
            if (turnResult?.verificationResult) sData.lastVerificationResult = turnResult.verificationResult;
            sData.updatedAt = Date.now();
            fs.writeFileSync(sFile, JSON.stringify(sData, null, 2), 'utf8');
            console.log(`[API] Auto-saved updated scene code and data for session: ${sessionId}`);
          }
        } catch (err) {
          console.error(`[API] Failed to auto-save scene code:`, err.message);
        }
      }
      res.end();
    }).catch((err) => {
      clearInterval(heartbeatInterval);
      activeCustomAgentControllers.delete(sessionKey);
      if (!abortController.signal.aborted) {
        console.error(`[API /api/chat] Custom Agent Engine error:`, err.message);
        sendEvent('error', { message: err.message });
      }
      res.end();
    });
    return;
  }

  const args = [
    '--add-dir', TEMPLATE_DIR,
    '-p', effectivePrompt,
    '--dangerously-skip-permissions',
    '--output-format', 'stream-json',
    '--model', effectiveModel
  ];

  console.log(`[API agy] Starting fast unbloated execution turn for session ${sessionId}`);
  console.log(`[API] Spawning agy with args:`, args);

  const preExecutionSnapshot = {
    sceneCode: fs.existsSync(ACTIVE_SCENE_PATH) ? fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8') : '',
    sceneData: fs.existsSync(ACTIVE_SCENE_DATA_PATH) ? fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8') : '',
  };

  const child = spawn(AGY_EXECUTABLE, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    cwd: TEMPLATE_DIR
  });

  // If a disconnect timer was pending for this session, clear it now since the client is active
  if (activeDisconnectTimers.has(sessionKey)) {
    clearTimeout(activeDisconnectTimers.get(sessionKey));
    activeDisconnectTimers.delete(sessionKey);
    console.log(`[API] Client active for session ${sessionKey}. Cleared disconnect timer.`);
  }

  activeChildProcesses.set(sessionKey, child);

  // Maximum execution time safeguard (8 minutes) to allow complex After Effects grade motion code generation
  const MAX_AGENT_EXECUTION_TIME_MS = 480000;
  const maxExecutionTimer = setTimeout(() => {
    if (activeChildProcesses.has(sessionKey)) {
      console.warn(`[API] Max execution time (${MAX_AGENT_EXECUTION_TIME_MS / 1000}s) reached for session ${sessionKey}. Stopping agent.`);
      terminateSessionProcess(sessionKey, 'Max execution time reached');
    }
  }, MAX_AGENT_EXECUTION_TIME_MS);

  const rl = readline.createInterface({
    input: child.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    line = line.trim();
    if (!line) return;

    try {
      const parsed = JSON.parse(line);

      // Capture and link agy conversation ID to the session file
      const convId = parsed.conversation_id || parsed.step_update?.conversation_id || parsed.result?.conversation_id;
      if (convId && sessionFile && fs.existsSync(sessionFile)) {
        if (!sessionData || !sessionData.agyConversationId) {
          try {
            sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            sessionData.agyConversationId = convId;
            sessionData.updatedAt = Date.now();
            fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');
            console.log(`[API agy] Bound session ${sessionId} to agy conversation ID: ${convId}`);
          } catch (e) {
            console.error(`[API] Could not save conversation ID:`, e.message);
          }
        }
      }

      if (parsed.event === 'step_update') {
        const step = parsed.step_update;
        if (step?.step_type === 'tool') {
          const toolName = step.tool_name || step.tool_info?.name || 'tool';
          const toolParams = step.tool_info?.parameters || {};
          const actionTitle = getToolActionTitle(toolName, toolParams);
          const target = getToolTargetLabel(toolParams);
          sendEvent('tool_event', {
            toolName,
            actionTitle,
            target,
            state: step.state || 'ACTIVE',
            stepIndex: step.step_index,
            durationSeconds: step.duration_seconds || 0,
          });
        } else if (step?.step_type === 'agent_response' && step.usage) {
          sendEvent('token_usage', {
            thinkingTokens: step.usage.thinking_tokens || 0,
            outputTokens: step.usage.output_tokens || 0,
            stepIndex: step.step_index,
          });
        }
      } else if (parsed.event === 'result' && parsed.result?.usage) {
        sendEvent('token_usage', {
          thinkingTokens: parsed.result.usage.thinking_tokens || 0,
          outputTokens: parsed.result.usage.output_tokens || 0,
        });
      }

      sendEvent('agy_event', parsed);
    } catch {
      sendEvent('raw_output', { line });
    }
  });

  let stderrBuffer = '';
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrBuffer += text;
    console.error(`[API agy stderr]:`, text);
    sendEvent('stderr', { text });
  });

  child.on('close', (code) => {
    clearInterval(heartbeatInterval);
    clearTimeout(maxExecutionTimer);
    if (activeDisconnectTimers.has(sessionKey)) {
      clearTimeout(activeDisconnectTimers.get(sessionKey));
      activeDisconnectTimers.delete(sessionKey);
    }
    console.log(`[API agy] Child process closed with code:`, code);
    activeChildProcesses.delete(sessionKey);

    // Compute unified diffs for modified scene files
    const postSceneCode = fs.existsSync(ACTIVE_SCENE_PATH) ? fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8') : '';
    const postSceneData = fs.existsSync(ACTIVE_SCENE_DATA_PATH) ? fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8') : '';

    const diffSummaries = [];
    if (preExecutionSnapshot.sceneCode !== postSceneCode) {
      const sceneDiff = computeFileDiff(preExecutionSnapshot.sceneCode, postSceneCode, 'src/Scene.tsx');
      if (sceneDiff.changed) {
        diffSummaries.push(sceneDiff);
        buildSceneBundle().catch((e) => console.warn('[Vite Bundler] Pre-warm failed:', e.message));
      }
    }
    if (preExecutionSnapshot.sceneData !== postSceneData) {
      const dataDiff = computeFileDiff(preExecutionSnapshot.sceneData, postSceneData, 'src/scene-data.json');
      if (dataDiff.changed) diffSummaries.push(dataDiff);
    }

    let verificationResult = null;
    if (diffSummaries.length > 0) {
      sendEvent('diff_summary', { diffs: diffSummaries });

      try {
        const checkOutput = execSync('npm run check', {
          cwd: TEMPLATE_DIR,
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

    // Auto-persist the updated scene code and scene data into session file
    if (sessionId) {
      try {
        const sFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
        if (fs.existsSync(sFile)) {
          const sData = JSON.parse(fs.readFileSync(sFile, 'utf8'));
          if (fs.existsSync(ACTIVE_SCENE_PATH)) {
            sData.sceneCode = fs.readFileSync(ACTIVE_SCENE_PATH, 'utf8');
          }
          if (fs.existsSync(ACTIVE_SCENE_DATA_PATH)) {
            try {
              sData.sceneData = JSON.parse(fs.readFileSync(ACTIVE_SCENE_DATA_PATH, 'utf8'));
            } catch (e) {}
          }
          if (diffSummaries.length > 0) {
            sData.lastDiffSummary = diffSummaries;
          }
          if (verificationResult) {
            sData.lastVerificationResult = verificationResult;
          }
          sData.updatedAt = Date.now();
          fs.writeFileSync(sFile, JSON.stringify(sData, null, 2), 'utf8');
          console.log(`[API] Auto-saved updated scene code and data for session: ${sessionId}`);
        }
      } catch (err) {
        console.error(`[API] Failed to auto-save scene code and data:`, err.message);
      }
    }

    sendEvent('done', {
      exitCode: code,
      error: code !== 0 ? stderrBuffer.trim() : null,
      timestamp: Date.now()
    });
    res.end();
  });

  child.on('error', (err) => {
    clearInterval(heartbeatInterval);
    clearTimeout(maxExecutionTimer);
    if (activeDisconnectTimers.has(sessionKey)) {
      clearTimeout(activeDisconnectTimers.get(sessionKey));
      activeDisconnectTimers.delete(sessionKey);
    }
    console.error(`[API agy] Child process error:`, err);
    activeChildProcesses.delete(sessionKey);
    sendEvent('error', { message: err.message });
    res.end();
  });

  res.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log(`[API] Response stream closed for session ${sessionKey}.`);
    if (activeChildProcesses.has(sessionKey)) {
      const active = activeChildProcesses.get(sessionKey);
      console.log(`[API] Agent process PID ${active?.pid} active. Starting 45s disconnect safeguard timer...`);
      // Allow 45s grace period for client refresh or reconnection
      const graceTimer = setTimeout(() => {
        if (activeChildProcesses.has(sessionKey)) {
          console.log(`[API] Disconnect grace period expired for session ${sessionKey}. Terminating orphaned agent.`);
          terminateSessionProcess(sessionKey, 'Client disconnected without reconnect within 45s');
        }
        activeDisconnectTimers.delete(sessionKey);
      }, 45000);
      activeDisconnectTimers.set(sessionKey, graceTimer);
    }
  });
});

// Stop active generation for a session on demand
app.post('/api/chat/stop', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId !== undefined && sessionId !== null && !isValidSessionId(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' });
  }
  const sessionKey = sessionId || 'default';
  const stopped = terminateSessionProcess(sessionKey, 'Stop requested by user');
  if (stopped) {
    return res.json({ success: true, message: 'Generation stopped successfully' });
  }
  res.json({ success: true, message: 'No active generation found to stop' });
});

// ==========================================
// Video Export Endpoints (Multi-format, Custom Name, Custom Path)
// ==========================================

// Get system folder presets
app.get('/api/export-presets', (req, res) => {
  const home = os.homedir();
  const presets = {
    downloads: path.join(home, 'Downloads'),
    desktop: path.join(home, 'Desktop'),
    projectOut: path.join(TEMPLATE_DIR, 'out'),
  };
  res.json({ presets });
});

// Allowlists for render options (anything else is rejected before reaching the CLI)
const EXPORT_FORMATS = { mp4: '.mp4', webm: '.webm', mov: '.mov', gif: '.gif' };
const EXPORT_CODECS = new Set(['default', 'h264', 'h265', 'vp8', 'vp9', 'prores', 'gif']);
const EXPORT_MIN_SCALE = 0.1;
const EXPORT_MAX_SCALE = 4;
const REMOTION_CLI_PATH = path.join(TEMPLATE_DIR, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');

// Dynamically locate Edge or Chrome across Windows, macOS, and Linux
function findBrowserExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.platform === 'win32') {
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

    const candidates = [
      path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(localAppData, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
    ];
    for (const cand of candidates) {
      if (cand && fs.existsSync(cand)) return cand;
    }
  } else if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) return cand;
    }
  } else {
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) return cand;
    }
  }
  return null;
}

// Files produced by this server; only these (or files in the project out folder) may be downloaded
const exportedFiles = new Set();

// Render Video with Custom Format, Codec, Name, and Location
app.post('/api/export', (req, res) => {
  const {
    format = 'mp4',
    codec = 'h264',
    fileName = 'video',
    outputDir,
    scale = 1,
  } = req.body;

  // Strict input validation
  if (typeof format !== 'string' || !Object.hasOwn(EXPORT_FORMATS, format)) {
    return res.status(400).json({ error: 'صيغة الفيديو غير مدعومة' });
  }
  if (typeof codec !== 'string' || !EXPORT_CODECS.has(codec)) {
    return res.status(400).json({ error: 'الترميز غير مدعوم' });
  }
  const numericScale = Number(scale);
  if (!Number.isFinite(numericScale) || numericScale < EXPORT_MIN_SCALE || numericScale > EXPORT_MAX_SCALE) {
    return res.status(400).json({ error: 'مقياس الفيديو غير صالح' });
  }
  if (typeof fileName !== 'string' || fileName.length > 200) {
    return res.status(400).json({ error: 'اسم الملف غير صالح' });
  }
  if (outputDir !== undefined && outputDir !== null && outputDir !== '' && typeof outputDir !== 'string') {
    return res.status(400).json({ error: 'مسار الحفظ غير صالح' });
  }

  // Resolve file extension
  const ext = EXPORT_FORMATS[format];

  // Sanitize filename
  const cleanName = fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || `video-${Date.now()}`;
  const fullFileName = cleanName.endsWith(ext) ? cleanName : `${cleanName}${ext}`;

  // Resolve output folder
  let targetDir = outputDir ? path.resolve(outputDir) : path.join(TEMPLATE_DIR, 'out');
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
  } catch (err) {
    console.error('[API export] Could not create targetDir, falling back to project out:', err.message);
    targetDir = path.join(TEMPLATE_DIR, 'out');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  }

  const outPath = path.join(targetDir, fullFileName);

  // Set SSE headers for real-time render progress updates
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (event, payload) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  sendEvent('render_start', {
    message: `بدء إعداد رندر ${format.toUpperCase()} (${codec})...`,
    fileName: fullFileName,
    outPath,
  });

  // Build Remotion CLI Arguments (passed as a real argv array; no shell quoting needed)
  const browserPath = findBrowserExecutable();
  const remotionArgs = [
    REMOTION_CLI_PATH, 'render', 'src/index.ts', 'Main', outPath,
    '--gl=angle'
  ];

  if (browserPath) {
    remotionArgs.push(`--browser-executable=${browserPath}`);
  }

  if (codec !== 'default') {
    remotionArgs.push(`--codec=${codec}`);
  }

  if (format === 'mov' && codec === 'prores') {
    remotionArgs.push('--prores-profile=standard');
  }

  if (format === 'gif') {
    remotionArgs.push('--image-format=gif');
  }

  if (numericScale !== 1) {
    remotionArgs.push(`--scale=${numericScale}`);
  }

  console.log(`[API export] Executing: node ${remotionArgs.join(' ')}`);

  // shell: false -> cmd.exe never parses the arguments, so "&", "|", etc. have no special meaning
  const renderProc = spawn(process.execPath, remotionArgs, {
    shell: false,
    cwd: TEMPLATE_DIR,
    windowsHide: true,
  });

  renderProc.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    sendEvent('render_progress', { text });
  });

  renderProc.stderr.on('data', (chunk) => {
    sendEvent('render_stderr', { text: chunk.toString() });
  });

  renderProc.on('close', (code) => {
    if (code === 0) {
      exportedFiles.add(path.resolve(outPath).toLowerCase());
      sendEvent('render_complete', {
        success: true,
        outputPath: outPath,
        fileName: fullFileName,
        fileSize: fs.existsSync(outPath) ? fs.statSync(outPath).size : 0,
      });
    } else {
      sendEvent('render_failed', { success: false, exitCode: code });
    }
    res.end();
  });

  renderProc.on('error', (err) => {
    console.error('[API export error]:', err);
    sendEvent('render_failed', { success: false, error: err.message });
    res.end();
  });
});

// Only rendered videos may be downloaded: files exported in this server run, or files inside the project out folder
const DOWNLOADABLE_EXTENSIONS = new Set(Object.values(EXPORT_FORMATS));
const PROJECT_OUT_DIR = path.join(TEMPLATE_DIR, 'out');

function isDownloadAllowed(resolvedPath) {
  if (!DOWNLOADABLE_EXTENSIONS.has(path.extname(resolvedPath).toLowerCase())) return false;
  if (exportedFiles.has(resolvedPath.toLowerCase())) return true;
  const relative = path.relative(PROJECT_OUT_DIR, resolvedPath);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

// Download Rendered File
app.get('/api/download', (req, res) => {
  const filePath = req.query.file;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'File parameter is required' });
  }

  const resolved = path.resolve(filePath);
  if (!isDownloadAllowed(resolved)) {
    return res.status(403).json({ error: 'غير مسموح بتنزيل هذا الملف' });
  }
  if (fs.existsSync(resolved)) {
    const baseName = path.basename(resolved);
    res.download(resolved, baseName);
  } else {
    res.status(404).json({ error: 'ملف الفيديو غير موجود' });
  }
});

// Open File or Containing Folder in Windows Explorer
app.post('/api/open-folder', (req, res) => {
  const { filePath } = req.body;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'filePath is required' });
  }

  // spawn with an argv array (no shell) so the path is never parsed as a command line
  const openInExplorer = (args) => {
    const proc = spawn('explorer.exe', args, { shell: false, windowsHide: true, stdio: 'ignore' });
    proc.on('error', (err) => console.error('[API open-folder error]:', err.message));
    proc.unref();
  };

  const resolved = path.resolve(filePath);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    openInExplorer([`/select,${resolved}`]);
    return res.json({ success: true });
  }

  // If file doesn't exist, try opening the parent directory
  const dir = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    openInExplorer([dir]);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'المسار غير موجود' });
  }
});

// Serve packaged frontend dist static assets when available
const DIST_DIR = path.resolve(__dirname, '../dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/audio') ||
      req.path.startsWith('/images') ||
      req.path.startsWith('/videos')
    ) {
      return next();
    }
    const indexHtml = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      next();
    }
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('[API Server Error]:', err.message);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error' });
});

// Bind to loopback only so the API is never reachable from other machines on the network
app.listen(PORT, HOST, () => {
  console.log(`[Studio] Remotion AI Studio API server listening on http://${HOST}:${PORT}`);
});
