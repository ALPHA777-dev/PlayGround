import * as THREE from 'three'

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return c
}

function toTexture(canvas, { srgb = true, repeat = [1, 1] } = {}) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.anisotropy = 4
  return tex
}

function grain(ctx, size, count, alpha, colors, radius = 1) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha * (0.35 + Math.random() * 0.65)
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0]
    const r = radius * (0.35 + Math.random() * 1.4)
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export function makeGrassTexture() {
  const size = 512
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const rng = mulberry32(12)
  ctx.fillStyle = '#172014'
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 2200; i++) {
    const x = rng() * size
    const y = rng() * size
    const len = 3 + rng() * 12
    ctx.strokeStyle = ['#1f2b1a', '#24321d', '#2b3b21', '#131a10', '#39432a'][(rng() * 5) | 0]
    ctx.globalAlpha = 0.25 + rng() * 0.55
    ctx.lineWidth = 0.6 + rng() * 1.1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + (rng() - 0.5) * 4, y - len * 0.5, x + (rng() - 0.5) * 7, y - len)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  for (let i = 0; i < 38; i++) {
    const x = rng() * size
    const y = rng() * size
    const r = 12 + rng() * 52
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(40,34,25,0.28)')
    g.addColorStop(1, 'rgba(28,36,22,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  grain(ctx, size, 2600, 0.16, ['#31402a', '#0d130b', '#4b5032', '#26331f'], 1.1)
  return toTexture(c, { repeat: [16, 16] })
}

export function makeGrassBump() {
  const size = 256
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const rng = mulberry32(91)
  ctx.fillStyle = '#6a6a6a'
  ctx.fillRect(0, 0, size, size)
  grain(ctx, size, 5000, 0.6, ['#9a9a9a', '#404040', '#c0c0c0', '#585858'], 1.4)
  return toTexture(c, { srgb: false, repeat: [16, 16] })
}

export function makeDirtTexture() {
  const size = 512
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const rng = mulberry32(44)
  ctx.fillStyle = '#2a2118'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 900; i++) {
    ctx.globalAlpha = 0.15 + rng() * 0.4
    ctx.fillStyle = ['#3b2d1f', '#201810', '#473726', '#30261b'][(rng() * 4) | 0]
    ctx.beginPath()
    ctx.ellipse(rng() * size, rng() * size, 1 + rng() * 9, 0.5 + rng() * 4, rng() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 420; i++) {
    ctx.globalAlpha = 0.4 + rng() * 0.4
    ctx.fillStyle = ['#5e5447', '#746a58', '#3b332a'][(rng() * 3) | 0]
    ctx.beginPath()
    ctx.ellipse(rng() * size, rng() * size, 0.7 + rng() * 2.4, 0.5 + rng() * 1.4, rng() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  return toTexture(c, { repeat: [2, 16] })
}

export function makeStoneTexture() {
  const size = 512
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const rng = mulberry32(202)
  ctx.fillStyle = '#8b8c84'
  ctx.fillRect(0, 0, size, size)
  grain(ctx, size, 2600, 0.35, ['#6f7069', '#a0a198', '#585a53', '#b4b4aa', '#7d8076'], 3.4)
  for (let i = 0; i < 22; i++) {
    ctx.globalAlpha = 0.12 + rng() * 0.2
    ctx.strokeStyle = '#3d3f3a'
    ctx.lineWidth = 0.6 + rng() * 1.6
    let x = rng() * size
    let y = rng() * size
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let j = 0; j < 5; j++) {
      x += (rng() - 0.5) * 46
      y += rng() * 30
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  for (let i = 0; i < 220; i++) {
    ctx.globalAlpha = 0.12 + rng() * 0.2
    ctx.fillStyle = '#4d5a43'
    ctx.beginPath()
    ctx.arc(rng() * size, rng() * size, 1 + rng() * 7, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  return toTexture(c, { repeat: [1, 1] })
}

export function makeStoneBump() {
  const size = 256
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const rng = mulberry32(311)
  ctx.fillStyle = '#777'
  ctx.fillRect(0, 0, size, size)
  grain(ctx, size, 3200, 0.55, ['#b0b0b0', '#454545', '#e0e0e0', '#656565'], 2.2)
  return toTexture(c, { srgb: false, repeat: [1, 1] })
}

export function makeClothTexture() {
  const size = 512
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const rng = mulberry32(77)
  ctx.fillStyle = '#08080a'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 1800; i++) {
    ctx.globalAlpha = 0.04 + rng() * 0.11
    ctx.strokeStyle = ['#3a3b42', '#101014', '#4a4a54', '#1d1e24'][(rng() * 4) | 0]
    ctx.lineWidth = 0.5 + rng() * 2
    const x = rng() * size
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(x + (rng() - 0.5) * 40, size * 0.35, x + (rng() - 0.5) * 40, size * 0.65, x + (rng() - 0.5) * 20, size)
    ctx.stroke()
  }
  for (let y = 0; y < size; y += 3) {
    ctx.globalAlpha = 0.035
    ctx.fillStyle = '#9a9aa5'
    ctx.fillRect(0, y, size, 0.7)
  }
  ctx.globalAlpha = 1
  return toTexture(c, { repeat: [2, 3] })
}

export function makeBarkTexture() {
  const size = 256
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const rng = mulberry32(512)
  ctx.fillStyle = '#231b16'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 480; i++) {
    ctx.globalAlpha = 0.18 + rng() * 0.35
    ctx.strokeStyle = ['#3c2c21', '#120e0b', '#4c3a2b', '#2a211a'][(rng() * 4) | 0]
    ctx.lineWidth = 0.5 + rng() * 2.5
    const x = rng() * size
    let y = rng() * size
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let j = 0; j < 4; j++) {
      y += 8 + rng() * 22
      ctx.lineTo(x + (rng() - 0.5) * 8, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  return toTexture(c, { repeat: [2, 3] })
}

export function makeGlowTexture(stops = [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]) {
  const size = 256
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [pos, color] of stops) g.addColorStop(pos, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return toTexture(c, { repeat: [1, 1] })
}

export function makeFogTexture() {
  const size = 512
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const rng = mulberry32(88)
  ctx.clearRect(0, 0, size, size)
  for (let i = 0; i < 70; i++) {
    const x = size * 0.15 + rng() * size * 0.7
    const y = size * 0.15 + rng() * size * 0.7
    const r = 20 + rng() * 95
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,255,255,${0.035 + rng() * 0.09})`)
    g.addColorStop(0.55, `rgba(255,255,255,${0.025 + rng() * 0.05})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  return toTexture(c, { repeat: [1, 1] })
}

export function makeSmokeTexture() {
  const size = 128
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const rng = mulberry32(33)
  for (let i = 0; i < 20; i++) {
    const x = size / 2 + (rng() - 0.5) * 38
    const y = size / 2 + (rng() - 0.5) * 38
    const r = 14 + rng() * 27
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.42)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  return toTexture(c, { repeat: [1, 1] })
}

export function makeMoonTexture() {
  const size = 512
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const rng = mulberry32(600)
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5)
  g.addColorStop(0, '#fcfff9')
  g.addColorStop(0.72, '#e8edf0')
  g.addColorStop(1, 'rgba(220,230,240,0.9)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.48, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2
    const d = rng() * size * 0.42
    const r = 5 + rng() * 30
    ctx.globalAlpha = 0.06 + rng() * 0.12
    ctx.fillStyle = '#939daa'
    ctx.beginPath()
    ctx.arc(size / 2 + Math.cos(a) * d, size / 2 + Math.sin(a) * d, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  return toTexture(c, { repeat: [1, 1] })
}

export function makeCloudTexture() {
  const size = 512
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const rng = mulberry32(150)
  for (let i = 0; i < 42; i++) {
    const x = size * 0.18 + rng() * size * 0.64
    const y = size * 0.3 + rng() * size * 0.36
    const r = 24 + rng() * 80
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.20)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  return toTexture(c, { repeat: [1, 1] })
}

export function makeGroundLightTexture() {
  const size = 256
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.5)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.22)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return toTexture(c, { repeat: [1, 1] })
}

export function makeSignTexture(title, subtitle) {
  const w = 512
  const h = 256
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#1a1410'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#4b3a27'
  ctx.lineWidth = 12
  ctx.strokeRect(10, 10, w - 20, h - 20)
  ctx.strokeStyle = '#2b2118'
  ctx.lineWidth = 4
  ctx.strokeRect(26, 26, w - 52, h - 52)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#d9c9ad'
  ctx.font = '600 64px "Barlow Condensed", sans-serif'
  ctx.fillText(title, w / 2, 116)
  ctx.fillStyle = '#9e876a'
  ctx.font = '400 30px "Barlow Condensed", sans-serif'
  ctx.fillText(subtitle, w / 2, 168)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
