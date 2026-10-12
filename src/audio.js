// =====================================================
// Audio - chiptune music and sound effects made with the Web Audio API.
// Every sound is synthesized in code, so there are no audio files to load.
//   - Browsers only allow sound after the player touches / clicks / presses
//     a key, so the AudioContext is created on the first gesture.
//   - Mute is saved in localStorage and survives a page reload.
//   - Sound pauses while the tab or app is in the background.
// =====================================================

import { CONFIG } from "./config.js";

const MASTER_VOLUME = 0.5;
const MUTE_STORAGE_KEY = "run-to-my-love:muted";

// Music scheduler: wakes up often and queues notes a little ahead of time,
// so the beat stays steady even if a frame is late
const SCHEDULER_INTERVAL = 25; // milliseconds
const SCHEDULE_AHEAD = 0.12; // seconds

// Note name -> frequency, e.g. 'A4' = 440 Hz, 'C#5', 'Bb3'
const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteToFrequency(note) {
  const match = /^([A-G])([#b]?)(\d)$/.exec(note);
  if (!match) return 0;
  const [, letter, accidental, octave] = match;
  let semitone =
    NOTE_INDEX[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  semitone += (Number(octave) + 1) * 12; // MIDI note number
  return 440 * Math.pow(2, (semitone - 69) / 12);
}

// ---------- Music ----------
// Each voice is a list of [note, length in steps]. '-' = rest.

const TRACKS = {
  // Bouncy running theme (8th notes at 150 BPM)
  run: {
    bpm: 150,
    stepsPerBeat: 2,
    voices: [
      {
        wave: "square",
        volume: 0.07,
        notes: [
          ["E5", 1],
          ["G5", 1],
          ["C6", 1],
          ["G5", 1],
          ["A5", 1],
          ["G5", 1],
          ["E5", 1],
          ["G5", 1],
          ["F5", 1],
          ["A5", 1],
          ["D6", 1],
          ["A5", 1],
          ["G5", 1],
          ["F5", 1],
          ["E5", 1],
          ["D5", 1],
          ["E5", 1],
          ["G5", 1],
          ["C6", 1],
          ["G5", 1],
          ["A5", 1],
          ["C6", 1],
          ["B5", 1],
          ["A5", 1],
          ["G5", 1],
          ["E5", 1],
          ["F5", 1],
          ["D5", 1],
          ["C5", 2],
          ["C5", 2],
        ],
      },
      {
        wave: "triangle",
        volume: 0.22,
        notes: [
          ["C3", 2],
          ["C3", 2],
          ["G2", 2],
          ["G2", 2],
          ["F2", 2],
          ["F2", 2],
          ["G2", 2],
          ["G2", 2],
          ["C3", 2],
          ["C3", 2],
          ["A2", 2],
          ["A2", 2],
          ["G2", 2],
          ["G2", 2],
          ["C3", 2],
          ["C3", 2],
        ],
      },
    ],
    hat: { every: 2, offset: 1, volume: 0.03 }, // soft "tss" on the off-beats
  },

  // Wedding march ("Bridal Chorus", Wagner - public domain), slow 16th steps at 80 BPM
  wedding: {
    bpm: 80,
    stepsPerBeat: 4,
    voices: [
      {
        wave: "triangle",
        volume: 0.2,
        notes: [
          ["G4", 4],
          ["C5", 3],
          ["C5", 1],
          ["C5", 8],
          ["G4", 4],
          ["D5", 3],
          ["B4", 1],
          ["C5", 8],
          ["G4", 4],
          ["C5", 3],
          ["F5", 1],
          ["F5", 4],
          ["E5", 3],
          ["D5", 1],
          ["C5", 4],
          ["B4", 3],
          ["C5", 1],
          ["D5", 8],
        ],
      },
      {
        // A quiet sine one octave up makes the melody sound like a music box
        wave: "sine",
        volume: 0.05,
        octave: 2,
        notes: [
          ["G4", 4],
          ["C5", 3],
          ["C5", 1],
          ["C5", 8],
          ["G4", 4],
          ["D5", 3],
          ["B4", 1],
          ["C5", 8],
          ["G4", 4],
          ["C5", 3],
          ["F5", 1],
          ["F5", 4],
          ["E5", 3],
          ["D5", 1],
          ["C5", 4],
          ["B4", 3],
          ["C5", 1],
          ["D5", 8],
        ],
      },
      {
        wave: "triangle",
        volume: 0.16,
        notes: [
          ["C3", 8],
          ["G3", 8],
          ["G2", 8],
          ["F3", 8],
          ["F2", 8],
          ["A2", 8],
          ["G2", 8],
          ["B2", 8],
        ],
      },
    ],
  },
};

// Turns [note, length] lists into "what starts on step N" tables
function prepareTrack(track) {
  const stepTime = 60 / track.bpm / track.stepsPerBeat;
  let loopSteps = 0;
  const voices = track.voices.map((voice) => {
    const starts = new Map();
    let step = 0;
    for (const [note, length] of voice.notes) {
      if (note !== "-") {
        const frequency = noteToFrequency(note) * (voice.octave ?? 1);
        starts.set(step, { frequency, duration: length * stepTime });
      }
      step += length;
    }
    loopSteps = Math.max(loopSteps, step);
    return { ...voice, starts };
  });
  return { ...track, stepTime, loopSteps, voices };
}

const PREPARED_TRACKS = Object.fromEntries(
  Object.entries(TRACKS).map(([name, track]) => [name, prepareTrack(track)]),
);

// ---------- Sound manager ----------

export class SoundManager {
  constructor() {
    this.ctx = null; // AudioContext, created on the first gesture
    this.muted = loadMuted();
    this.wantedTrack = null; // music that should play (even before sound is unlocked)
    this.currentTrack = null; // music that is actually playing
    this.schedulerId = 0;
    this.step = 0;
    this.nextStepTime = 0;

    // Any of these counts as "the player interacted"; iOS prefers touchend / click
    this.unlock = this.unlock.bind(this);
    for (const type of [
      "pointerdown",
      "pointerup",
      "touchend",
      "click",
      "keydown",
    ]) {
      window.addEventListener(type, this.unlock, { capture: true });
    }

    // Pause all sound while the page is hidden (home button, other tab, phone lock)
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  // ---------- Setup ----------

  unlock() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return; // very old browser: play silently
      this.ctx = new AudioContextClass();

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = CONFIG.MUSIC_VOLUME;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = CONFIG.SFX_VOLUME;
      this.sfxGain.connect(this.master);

      this.noiseBuffer = createNoiseBuffer(this.ctx);

      // iOS: playing one silent sound inside the gesture fully wakes the audio up
      const silent = this.ctx.createBufferSource();
      silent.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      silent.connect(this.ctx.destination);
      silent.start();
    }
    if (this.ctx.state === "suspended" && !document.hidden) this.ctx.resume();
    if (this.wantedTrack && !this.currentTrack)
      this.startTrack(this.wantedTrack, 0);
  }

  // ---------- Mute ----------

  toggleMute() {
    this.muted = !this.muted;
    saveMuted(this.muted);
    if (this.ctx) {
      const target = this.muted ? 0 : MASTER_VOLUME;
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
    if (!this.muted) this.play("click");
  }
  // ---------- Music ----------

  // Starts a track by name ('run' or 'wedding'). delay = seconds to wait first.
  playMusic(name, delay = 0) {
    this.wantedTrack = name;
    if (this.currentTrack === name) return;
    this.cutMusic();
    if (this.ctx) this.startTrack(name, delay);
  }

  stopMusic() {
    this.wantedTrack = null;
    this.cutMusic();
  }

  // Stops the scheduler and quickly fades out notes that are already queued,
  // so they do not overlap the next track or end with a click
  cutMusic() {
    clearInterval(this.schedulerId);
    this.schedulerId = 0;
    this.currentTrack = null;
    if (!this.ctx) return;
    const oldGain = this.musicGain;
    oldGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    setTimeout(() => oldGain.disconnect(), 300);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = CONFIG.MUSIC_VOLUME;
    this.musicGain.connect(this.master);
  }

  startTrack(name, delay) {
    this.currentTrack = name;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05 + delay;
    this.schedule();
    this.schedulerId = setInterval(() => this.schedule(), SCHEDULER_INTERVAL);
  }

  // Queues every step that starts within the next SCHEDULE_AHEAD seconds
  schedule() {
    const track = PREPARED_TRACKS[this.currentTrack];
    if (!track) return;
    while (this.nextStepTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      const time = this.nextStepTime;
      for (const voice of track.voices) {
        const note = voice.starts.get(this.step);
        if (note) {
          this.tone(note.frequency, time, note.duration * 0.92, {
            wave: voice.wave,
            volume: voice.volume,
            output: this.musicGain,
            sustain: true,
          });
        }
      }
      if (track.hat && this.step % track.hat.every === track.hat.offset) {
        this.noise(time, 0.03, track.hat.volume, 7000, this.musicGain);
      }
      this.step = (this.step + 1) % track.loopSteps;
      this.nextStepTime += track.stepTime;
    }
  }

  // ---------- Sound effects ----------

  play(name) {
    if (!this.ctx || this.muted || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime + 0.005;

    switch (name) {
      case "jump":
        this.tone(300, t, 0.12, { wave: "square", volume: 0.12, slideTo: 600 });
        break;
      case "doubleJump":
        this.tone(500, t, 0.12, { wave: "square", volume: 0.1, slideTo: 1000 });
        this.tone(1320, t + 0.06, 0.08, { wave: "sine", volume: 0.12 });
        this.tone(1760, t + 0.1, 0.1, { wave: "sine", volume: 0.1 });
        break;
      case "slide":
        this.noise(t, 0.18, 0.18, 1400);
        this.tone(180, t, 0.12, {
          wave: "triangle",
          volume: 0.15,
          slideTo: 110,
        });
        break;
      case "heart":
        this.tone(988, t, 0.06, { wave: "square", volume: 0.08 });
        this.tone(1319, t + 0.06, 0.16, { wave: "square", volume: 0.08 });
        break;
      case "hit":
        this.noise(t, 0.2, 0.3, 2500);
        this.tone(220, t, 0.25, { wave: "square", volume: 0.12, slideTo: 70 });
        break;
      case "milestone":
        ["C5", "E5", "G5", "C6"].forEach((note, i) => {
          this.tone(noteToFrequency(note), t + i * 0.08, 0.14, {
            wave: "square",
            volume: 0.08,
          });
        });
        break;
      case "win":
        ["G4", "C5", "E5", "G5"].forEach((note, i) => {
          this.tone(noteToFrequency(note), t + i * 0.11, 0.12, {
            wave: "square",
            volume: 0.08,
          });
        });
        this.tone(noteToFrequency("C6"), t + 0.44, 0.7, {
          wave: "square",
          volume: 0.08,
          sustain: true,
        });
        this.tone(noteToFrequency("C4"), t + 0.44, 0.7, {
          wave: "triangle",
          volume: 0.2,
          sustain: true,
        });
        break;
      case "gameOver":
        ["G4", "E4", "C4"].forEach((note, i) => {
          this.tone(noteToFrequency(note), t + i * 0.2, 0.18, {
            wave: "square",
            volume: 0.08,
          });
        });
        this.tone(noteToFrequency("C3"), t + 0.6, 0.6, {
          wave: "triangle",
          volume: 0.22,
          slideTo: 98,
        });
        break;
      case "click":
        this.tone(660, t, 0.05, { wave: "square", volume: 0.08 });
        break;
    }
  }

  // ---------- Building blocks ----------

  // One note. sustain = holds its volume (music), otherwise fades out (blips)
  tone(
    frequency,
    start,
    duration,
    {
      wave = "square",
      volume = 0.1,
      slideTo = 0,
      sustain = false,
      output,
    } = {},
  ) {
    if (!frequency) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, start);
    if (slideTo)
      osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);

    const end = start + duration;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.005);
    if (sustain) {
      gain.gain.setValueAtTime(volume, Math.max(start + 0.005, end - 0.04));
      gain.gain.linearRampToValueAtTime(0, end);
    } else {
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
    }

    osc.connect(gain);
    gain.connect(output ?? this.sfxGain);
    osc.start(start);
    osc.stop(end + 0.02);
  }

  // Short burst of filtered noise (hi-hat, swoosh, crash)
  noise(start, duration, volume, cutoff, output) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = cutoff > 5000 ? "highpass" : "lowpass";
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(output ?? this.sfxGain);
    source.start(start);
    source.stop(start + duration + 0.02);
  }
}

function createNoiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 1 second
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// localStorage can throw (private mode, blocked storage), so it is optional
function loadMuted() {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveMuted(muted) {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Not saved, but the toggle still works for this visit
  }
}
