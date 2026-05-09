"use client"

/**
 * App-wide sound effects (Phase 12.8).
 *
 * No audio files — every sound is synthesised with the Web Audio API,
 * so nothing extra ships in /public and the app works offline.
 *
 * Sounds:
 *   • playRequestSent      — buyer submitted a deal request (ascending tone)
 *   • playApproval         — seller approved the deal (success chime)
 *   • playRejection        — seller rejected the deal (descending tone)
 *   • playPaymentSubmitted — buyer uploaded proof (notification ding)
 *   • playDealCompleted    — seller released shares (celebratory triad)
 *   • playNotification     — generic two-tone chime
 *
 * AudioContext can only be constructed/resumed in response to a user
 * gesture in some browsers. We create it lazily on the first call.
 *
 * All public APIs are no-ops on the server / when audio is unavailable
 * — they never throw.
 */

let _audioCtx: AudioContext | null = null
let _muted = false

interface ToneSpec {
  /** Frequency in Hz. */
  freq: number
  /** Start time relative to "now" (in seconds). */
  start: number
  /** Total duration of the tone (in seconds). */
  dur: number
  /** Peak gain (0..1). Defaults to 0.22 — pleasant, not too loud. */
  gain?: number
  /** Oscillator type. Defaults to "sine" (mellow). */
  type?: OscillatorType
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (_audioCtx) return _audioCtx
  try {
    type W = Window & { webkitAudioContext?: typeof AudioContext }
    const Ctx = window.AudioContext || (window as W).webkitAudioContext
    if (!Ctx) return null
    _audioCtx = new Ctx()
    return _audioCtx
  } catch {
    return null
  }
}

/**
 * Play a sequence of sine-wave tones with a soft attack/release
 * envelope so they don't click.
 */
function play(tones: ToneSpec[]) {
  if (_muted) return
  const ctx = getCtx()
  if (!ctx) return
  try {
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined)
    }
    const now = ctx.currentTime
    for (const t of tones) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = t.type ?? "sine"
      osc.frequency.value = t.freq
      const peak = t.gain ?? 0.22
      const startAt = now + t.start
      gain.gain.setValueAtTime(0, startAt)
      gain.gain.linearRampToValueAtTime(peak, startAt + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + t.dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(startAt)
      osc.stop(startAt + t.dur + 0.05)
    }
  } catch {
    /* best-effort */
  }
}

// ─── Public API ───────────────────────────────────────────────────

/** Mute/unmute all sounds globally (for settings toggle in future). */
export function setSoundsMuted(muted: boolean) {
  _muted = muted
}

/** Generic two-tone chime (legacy notification ding). */
export function playNotification() {
  play([
    { freq: 880,  start: 0,    dur: 0.14 },
    { freq: 1320, start: 0.12, dur: 0.20 },
  ])
}

/**
 * Soft "pop" for incoming chat messages — quieter and shorter than
 * playNotification so it doesn't get annoying during rapid chats.
 */
export function playChatMessage() {
  play([
    { freq: 1175, start: 0,    dur: 0.08, gain: 0.14 },
    { freq: 1568, start: 0.05, dur: 0.10, gain: 0.14 },
  ])
}

/**
 * Buyer just submitted a deal request — quick ascending blip
 * ("whoosh"-like) that says "sent".
 */
export function playRequestSent() {
  play([
    { freq: 660,  start: 0,    dur: 0.10, gain: 0.18 },
    { freq: 990,  start: 0.06, dur: 0.10, gain: 0.18 },
    { freq: 1480, start: 0.12, dur: 0.14, gain: 0.18 },
  ])
}

/**
 * Phone-style ringtone for the SELLER when a buyer requests a deal.
 * Stronger and longer than playRequestSent — three rings spaced 0.4s
 * apart, each ring = a two-tone alternation (classic phone pattern).
 *
 * Total duration ~2 seconds. Designed to grab attention even from the
 * other side of the room.
 */
export function playIncomingDealRequest() {
  const ring = (start: number) => [
    // First half-ring: high tone
    { freq: 1318, start: start + 0.00, dur: 0.20, gain: 0.30 },
    // Second half-ring: lower companion
    { freq: 988,  start: start + 0.20, dur: 0.20, gain: 0.30 },
  ]
  play([
    ...ring(0.00),  // first ring
    ...ring(0.55),  // second ring
    ...ring(1.10),  // third ring
  ])
}

/**
 * Seller just approved a deal — major-third arpeggio.
 * (C5 → E5 → G5 — a happy ascent.)
 */
export function playApproval() {
  play([
    { freq: 523, start: 0,    dur: 0.16 },
    { freq: 659, start: 0.10, dur: 0.16 },
    { freq: 784, start: 0.20, dur: 0.24 },
  ])
}

/**
 * Seller just rejected a deal — descending minor-second blip.
 * (Soft, not jarring — communicates "no" without being harsh.)
 */
export function playRejection() {
  play([
    { freq: 440, start: 0,    dur: 0.18, gain: 0.18 },
    { freq: 370, start: 0.14, dur: 0.22, gain: 0.18 },
  ])
}

/**
 * Buyer just uploaded payment proof — alert ding aimed at the seller.
 * Three quick beeps so it cuts through other notifications.
 */
export function playPaymentSubmitted() {
  play([
    { freq: 1175, start: 0,    dur: 0.10 },
    { freq: 1175, start: 0.14, dur: 0.10 },
    { freq: 1568, start: 0.28, dur: 0.18 },
  ])
}

/**
 * Deal completed (shares released) — triumphant major triad
 * (C5 + E5 + G5 played together, then the tonic an octave up).
 */
export function playDealCompleted() {
  play([
    // Major triad chord (3 tones at the same start)
    { freq: 523,  start: 0,    dur: 0.40, gain: 0.16 },
    { freq: 659,  start: 0,    dur: 0.40, gain: 0.16 },
    { freq: 784,  start: 0,    dur: 0.40, gain: 0.16 },
    // High C resolution
    { freq: 1046, start: 0.35, dur: 0.40, gain: 0.20 },
  ])
}
