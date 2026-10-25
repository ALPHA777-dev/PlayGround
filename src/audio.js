export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.ambient = null
    this.muted = false
    this.heartTimer = 0
    this.ambientStarted = false
    this.lastTension = 0
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.72
    const compressor = this.ctx.createDynamicsCompressor()
    compressor.threshold.value = -16
    compressor.knee.value = 16
    compressor.ratio.value = 5
    compressor.attack.value = 0.004
    compressor.release.value = 0.22
    this.master.connect(compressor).connect(this.ctx.destination)
    this.reverb = this.ctx.createConvolver()
    this.reverb.buffer = this.makeImpulse(2.8, 3.2)
    this.reverbGain = this.ctx.createGain()
    this.reverbGain.gain.value = 0.34
    this.reverb.connect(this.reverbGain).connect(this.master)
    this.noise = this.makeNoise(3)
    this.startAmbient()
  }

  makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate
    const len = Math.floor(rate * seconds)
    const buffer = this.ctx.createBuffer(2, len, rate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        const t = i / len
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay)
      }
    }
    return buffer
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate
    const len = Math.floor(rate * seconds)
    const buffer = this.ctx.createBuffer(1, len, rate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2 + white * 0.35
    }
    return buffer
  }

  setMuted(value) {
    this.muted = value
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime)
      this.master.gain.setTargetAtTime(value ? 0 : 0.72, this.ctx.currentTime, 0.08)
    }
  }

  startAmbient() {
    if (!this.ctx || this.ambientStarted) return
    this.ambientStarted = true
    const ctx = this.ctx
    this.ambient = ctx.createGain()
    this.ambient.gain.value = 0.0001
    this.ambient.connect(this.master)
    this.ambient.gain.setTargetAtTime(0.32, ctx.currentTime, 2.5)

    const wind = ctx.createBufferSource()
    wind.buffer = this.noise
    wind.loop = true
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 340
    windFilter.Q.value = 0.8
    const windGain = ctx.createGain()
    windGain.gain.value = 0.13
    const windPan = ctx.createStereoPanner()
    windPan.pan.value = -0.15
    wind.connect(windFilter).connect(windGain).connect(windPan).connect(this.ambient)
    wind.start()

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.045
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 150
    lfo.connect(lfoGain).connect(windFilter.frequency)
    lfo.start()

    const secondWind = ctx.createBufferSource()
    secondWind.buffer = this.noise
    secondWind.loop = true
    secondWind.playbackRate.value = 0.73
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 780
    band.Q.value = 0.6
    const secondGain = ctx.createGain()
    secondGain.gain.value = 0.026
    const pan2 = ctx.createStereoPanner()
    pan2.pan.value = 0.4
    secondWind.connect(band).connect(secondGain).connect(pan2).connect(this.ambient)
    secondWind.start()

    const drone = ctx.createOscillator()
    drone.type = 'sine'
    drone.frequency.value = 43.65
    const drone2 = ctx.createOscillator()
    drone2.type = 'triangle'
    drone2.frequency.value = 65.4
    drone2.detune.value = 7
    const droneFilter = ctx.createBiquadFilter()
    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = 190
    const droneGain = ctx.createGain()
    droneGain.gain.value = 0.068
    drone.connect(droneFilter)
    drone2.connect(droneFilter)
    droneFilter.connect(droneGain).connect(this.ambient)
    drone.start()
    drone2.start()

    const eerie = ctx.createOscillator()
    eerie.type = 'sine'
    eerie.frequency.value = 622.25
    const eerieGain = ctx.createGain()
    eerieGain.gain.value = 0.0032
    const eerieLfo = ctx.createOscillator()
    eerieLfo.frequency.value = 0.07
    const eerieLfoGain = ctx.createGain()
    eerieLfoGain.gain.value = 0.003
    eerieLfo.connect(eerieLfoGain).connect(eerieGain.gain)
    eerie.connect(eerieGain).connect(this.ambient)
    eerie.start()
    eerieLfo.start()
    this.tensionGain = droneGain
    this.tensionBase = 0.068
  }

  updateTension(exposure, dt, playing) {
    if (!this.ctx || !this.ambient) return
    this.lastTension = exposure
    if (!playing) return
    const now = this.ctx.currentTime
    this.tensionGain.gain.setTargetAtTime(this.tensionBase + exposure * 0.08, now, 0.2)
    this.heartTimer -= dt
    if (exposure > 0.12 && this.heartTimer <= 0) {
      this.heartTimer = 0.72 - exposure * 0.3
      this.heartbeat(exposure)
    }
  }

  heartbeat(strength) {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    for (const [delay, freq, gain] of [[0, 52, 0.2], [0.16, 44, 0.14]]) {
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + delay)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + delay + 0.15)
      env.gain.setValueAtTime(0, now + delay)
      env.gain.linearRampToValueAtTime(gain * (0.5 + strength * 0.6), now + delay + 0.015)
      env.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.22)
      osc.connect(env).connect(this.master)
      osc.start(now + delay)
      osc.stop(now + delay + 0.25)
    }
  }

  tone({ freq, type = 'sine', start = 0, duration = 0.3, gain = 0.1, pan = 0, attack = 0.01, glide = null, filter = null, reverb = 0 }) {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime + start
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide), now + duration)
    env.gain.setValueAtTime(0.0001, now)
    env.gain.exp?.(0)
    env.gain.linearRampToValueAtTime(gain, now + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    let node = osc
    if (filter) {
      const f = ctx.createBiquadFilter()
      f.type = filter.type || 'lowpass'
      f.frequency.value = filter.freq || 800
      f.Q.value = filter.q || 1
      node.connect(f)
      node = f
    }
    node.connect(env).connect(panner).connect(this.master)
    if (reverb > 0) {
      const send = ctx.createGain()
      send.gain.value = reverb
      panner.connect(send).connect(this.reverb)
    }
    osc.start(now)
    osc.stop(now + duration + 0.05)
  }

  noiseBurst({ start = 0, duration = 0.2, gain = 0.1, freq = 800, q = 1, type = 'bandpass', pan = 0, rate = 1, reverb = 0 }) {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime + start
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = rate
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, now)
    env.gain.linearRampToValueAtTime(gain, now + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    src.connect(f).connect(env).connect(panner).connect(this.master)
    if (reverb > 0) {
      const send = ctx.createGain()
      send.gain.value = reverb
      panner.connect(send).connect(this.reverb)
    }
    src.start(now)
    src.stop(now + duration + 0.02)
  }

  ui() {
    this.tone({ freq: 520, type: 'triangle', duration: 0.08, gain: 0.035, glide: 420 })
    this.noiseBurst({ duration: 0.06, gain: 0.02, freq: 1800 })
  }

  scream(power = 1, pan = 0) {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const env = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    osc.type = 'sawtooth'
    osc2.type = 'square'
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(720 * power, now + 0.17)
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.64)
    osc2.frequency.setValueAtTime(70, now)
    osc2.frequency.exponentialRampToValueAtTime(360 * power, now + 0.17)
    osc2.frequency.exponentialRampToValueAtTime(55, now + 0.64)
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(600, now)
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.2)
    filter.frequency.exponentialRampToValueAtTime(340, now + 0.65)
    filter.Q.value = 1.2
    env.gain.setValueAtTime(0.0001, now)
    env.gain.linearRampToValueAtTime(0.23, now + 0.02)
    env.gain.setValueAtTime(0.2, now + 0.24)
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.72)
    osc.connect(filter)
    osc2.connect(filter)
    filter.connect(env).connect(panner).connect(this.master)
    const send = ctx.createGain()
    send.gain.value = 0.55
    panner.connect(send).connect(this.reverb)
    osc.start(now)
    osc2.start(now)
    osc.stop(now + 0.75)
    osc2.stop(now + 0.75)
    this.noiseBurst({ duration: 0.5, gain: 0.12, freq: 1400, q: 0.7, pan, reverb: 0.5 })
    this.tone({ freq: 58, type: 'sine', duration: 0.7, gain: 0.2, glide: 34, pan })
  }

  hit(pan = 0) {
    this.tone({ freq: 980, type: 'triangle', duration: 0.22, gain: 0.07, glide: 1480, pan, reverb: 0.25 })
    this.tone({ freq: 1310, type: 'sine', duration: 0.3, gain: 0.035, glide: 980, pan: pan * 0.6, start: 0.03, reverb: 0.3 })
    this.noiseBurst({ duration: 0.16, gain: 0.05, freq: 2400, q: 1.2, pan })
  }

  banish(pan = 0) {
    this.tone({ freq: 220, type: 'sine', duration: 1.1, gain: 0.12, glide: 880, pan, reverb: 0.6 })
    this.tone({ freq: 440, type: 'triangle', duration: 0.9, gain: 0.055, glide: 1760, start: 0.04, pan, reverb: 0.6 })
    this.tone({ freq: 660, type: 'sine', duration: 1.2, gain: 0.04, glide: 2640, start: 0.09, pan: -pan, reverb: 0.7 })
    this.noiseBurst({ duration: 0.55, gain: 0.09, freq: 3200, q: 0.5, pan, reverb: 0.5 })
    this.tone({ freq: 62, type: 'sine', duration: 0.45, gain: 0.18, glide: 38, pan })
  }

  collect() {
    this.tone({ freq: 1046, type: 'sine', duration: 0.45, gain: 0.06, reverb: 0.4 })
    this.tone({ freq: 1568, type: 'sine', duration: 0.5, gain: 0.035, start: 0.06, reverb: 0.4 })
    this.tone({ freq: 2093, type: 'sine', duration: 0.6, gain: 0.02, start: 0.12, reverb: 0.4 })
  }

  damage() {
    this.tone({ freq: 92, type: 'square', duration: 0.55, gain: 0.12, glide: 38, filter: { type: 'lowpass', freq: 380, q: 3 } })
    this.noiseBurst({ duration: 0.4, gain: 0.16, freq: 420, q: 0.6, type: 'lowpass' })
    this.tone({ freq: 740, type: 'sawtooth', duration: 0.25, gain: 0.045, glide: 180 })
  }

  nightmare() {
    this.scream(1.5, 0)
    this.tone({ freq: 36, type: 'sine', duration: 2.2, gain: 0.24, glide: 26 })
    this.tone({ freq: 73, type: 'triangle', duration: 1.7, gain: 0.11, glide: 49 })
    for (let i = 0; i < 7; i++) {
      this.tone({ freq: 400 + i * 130, type: 'sine', duration: 1.4, gain: 0.025, start: 0.1 + i * 0.04, pan: (i % 2 ? 1 : -1) * 0.5, reverb: 0.7 })
    }
    this.noiseBurst({ duration: 1.7, gain: 0.16, freq: 220, q: 0.4, type: 'lowpass', reverb: 0.8 })
  }

  tick(urgent = false) {
    this.tone({ freq: urgent ? 880 : 620, type: 'square', duration: 0.06, gain: urgent ? 0.035 : 0.018 })
  }

  win() {
    const notes = [261.63, 329.63, 392, 523.25]
    notes.forEach((freq, i) => this.tone({ freq, type: 'triangle', duration: 1.2, gain: 0.04, start: i * 0.13, reverb: 0.5 }))
    this.tone({ freq: 65.4, type: 'sine', duration: 2.4, gain: 0.1, reverb: 0.4 })
  }

  lose() {
    this.tone({ freq: 220, type: 'sawtooth', duration: 1.5, gain: 0.04, glide: 55, filter: { type: 'lowpass', freq: 600 } })
    this.tone({ freq: 110, type: 'sine', duration: 1.8, gain: 0.12, glide: 41 })
  }

  dawn() {
    this.tone({ freq: 98, type: 'sine', duration: 3.6, gain: 0.18, glide: 49, reverb: 0.6 })
    this.tone({ freq: 196, type: 'triangle', duration: 3.0, gain: 0.05, glide: 98, reverb: 0.6 })
    this.noiseBurst({ duration: 2.4, gain: 0.04, freq: 700, q: 0.4, type: 'lowpass', reverb: 0.5 })
  }
}
