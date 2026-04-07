let audioCtx: AudioContext | null = null

function ctx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function tone(freq: number, duration: number, type: OscillatorType, gain = 0.06) {
  const c = ctx()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  const t0 = c.currentTime
  g.gain.setValueAtTime(gain, t0)
  g.gain.linearRampToValueAtTime(0, t0 + duration)
  o.connect(g)
  g.connect(c.destination)
  o.start(t0)
  o.stop(t0 + duration + 0.02)
}

export function playClick() {
  try {
    tone(880, 0.04, 'sine', 0.04)
  } catch {
    /* ignore */
  }
}

export function playValid() {
  try {
    const c = ctx()
    const freqs = [523.25, 659.25, 783.99]
    freqs.forEach((f, i) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const t0 = c.currentTime + i * 0.05
      g.gain.setValueAtTime(0.055, t0)
      g.gain.linearRampToValueAtTime(0, t0 + 0.18)
      o.connect(g)
      g.connect(c.destination)
      o.start(t0)
      o.stop(t0 + 0.25)
    })
  } catch {
    /* ignore */
  }
}

export function playInvalid() {
  try {
    tone(120, 0.22, 'triangle', 0.07)
  } catch {
    /* ignore */
  }
}

export function resumeAudio() {
  void ctx().resume()
}
