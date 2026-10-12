import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_DIR = path.join(__dirname, 'audio_assets');

// Helper to write a 16-bit Mono PCM WAV file
function writeWav(filePath, sampleRate, samples) {
  const byteRate = sampleRate * 2;
  const blockAlign = 2;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // 'fmt ' chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28);   // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample (16 bits)

  // 'data' chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // PCM samples
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1, 1]
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
    buffer.writeInt16LE(Math.floor(intSample), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`[SFX Generated] ${path.basename(filePath)} (${(samples.length / sampleRate).toFixed(2)}s)`);
}

const SAMPLE_RATE = 44100;

// 1. Whoosh Fast (0.6s)
function generateWhoosh() {
  const duration = 0.6;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;

    // Pitch rises and falls: 150Hz -> 650Hz -> 100Hz
    const freq = 120 + Math.sin(progress * Math.PI) * 550;
    const sine = Math.sin(2 * Math.PI * freq * t);
    
    // Filtered noise
    const noise = (Math.random() * 2 - 1) * 0.4;
    
    // Bell curve envelope
    const env = Math.pow(Math.sin(progress * Math.PI), 2.5);
    samples[i] = (sine * 0.6 + noise * 0.4) * env;
  }
  return samples;
}

// 2. Heavy Metal Impact (0.9s)
function generateMetalImpact() {
  const duration = 0.9;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    
    // Sub bass drop: 120Hz -> 45Hz
    const subFreq = 45 + 75 * Math.exp(-t * 12);
    const sub = Math.sin(2 * Math.PI * subFreq * t) * Math.exp(-t * 4);

    // Metal clank harmonics: 850Hz, 1280Hz, 2150Hz
    const metal1 = Math.sin(2 * Math.PI * 850 * t) * Math.exp(-t * 18);
    const metal2 = Math.sin(2 * Math.PI * 1280 * t) * Math.exp(-t * 24);
    const metal3 = Math.sin(2 * Math.PI * 2150 * t) * Math.exp(-t * 32);

    // Initial click transient (first 10ms)
    const click = t < 0.01 ? (Math.random() * 2 - 1) * Math.exp(-t * 200) : 0;

    samples[i] = (sub * 0.6 + (metal1 + metal2 + metal3) * 0.35 + click * 0.4);
  }
  return samples;
}

// 3. Mechanical Spin / Ratchet (1.0s)
function generateMechanicalSpin() {
  const duration = 1.0;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  // Rapid mechanical clicks speeding up then slowing down
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;

    // Pulse frequency changes from 10Hz -> 35Hz -> 5Hz
    const pulseFreq = 12 + Math.sin(progress * Math.PI) * 28;
    const pulse = Math.sin(2 * Math.PI * pulseFreq * t);
    const isClick = pulse > 0.85;

    const tone = Math.sin(2 * Math.PI * 940 * t) * Math.exp(-((t * 20) % 1) * 15);
    const body = Math.sin(2 * Math.PI * 320 * t) * 0.3;
    const env = Math.sin(progress * Math.PI);

    samples[i] = (isClick ? (Math.random() * 2 - 1) * 0.6 : 0) + tone * 0.4 + body * 0.2;
    samples[i] *= env;
  }
  return samples;
}

// 4. Cinematic Boom / Sub Hit (1.4s)
function generateCinematicBoom() {
  const duration = 1.4;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    
    // Deep sub drop: 75Hz -> 28Hz
    const freq = 28 + 47 * Math.exp(-t * 3.5);
    const sub = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 2.2);
    
    // Low rumble noise
    const rumble = (Math.random() * 2 - 1) * 0.15 * Math.exp(-t * 4);

    samples[i] = sub * 0.85 + rumble;
  }
  return samples;
}

// 5. Tech Click / Crisp UI (0.15s)
function generateTechClick() {
  const duration = 0.15;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const tone = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 50);
    const snap = (Math.random() * 2 - 1) * Math.exp(-t * 120);
    samples[i] = tone * 0.7 + snap * 0.4;
  }
  return samples;
}

// 6. Success Bell / Crystal Chime (1.2s)
function generateSuccessBell() {
  const duration = 1.2;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  // E major chord: E5 (659Hz), G#5 (830Hz), B5 (987Hz), E6 (1318Hz)
  const freqs = [659.25, 830.61, 987.77, 1318.51];

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let mixed = 0;

    freqs.forEach((f, idx) => {
      // Slight stagger on the arpeggio (15ms each)
      const delay = idx * 0.02;
      if (t >= delay) {
        const dt = t - delay;
        mixed += Math.sin(2 * Math.PI * f * dt) * Math.exp(-dt * 3.2) * 0.25;
      }
    });

    samples[i] = mixed;
  }
  return samples;
}

// Run Generation
writeWav(path.join(AUDIO_DIR, 'whoosh_fast.wav'), SAMPLE_RATE, generateWhoosh());
writeWav(path.join(AUDIO_DIR, 'metal_impact.wav'), SAMPLE_RATE, generateMetalImpact());
writeWav(path.join(AUDIO_DIR, 'mechanical_spin.wav'), SAMPLE_RATE, generateMechanicalSpin());
writeWav(path.join(AUDIO_DIR, 'cinematic_boom.wav'), SAMPLE_RATE, generateCinematicBoom());
writeWav(path.join(AUDIO_DIR, 'tech_click.wav'), SAMPLE_RATE, generateTechClick());
writeWav(path.join(AUDIO_DIR, 'success_bell.wav'), SAMPLE_RATE, generateSuccessBell());

console.log('[SFX Generation Complete] All 6 preset sounds generated successfully.');
