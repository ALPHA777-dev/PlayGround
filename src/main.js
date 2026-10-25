import './style.css'
import * as THREE from 'three'
import { createWorld } from './world.js'
import { createCrier } from './crier.js'
import { Visitor } from './visitor.js'
import { Effects } from './effects.js'
import { AudioEngine } from './audio.js'
import { Input } from './input.js'
import { createPostProcessing } from './postprocessing.js'

const $ = (id) => document.getElementById(id)
const clamp = THREE.MathUtils.clamp
const DURATION = 90
const SCREAM_RADIUS = 7.2
const SCREAM_COOLDOWN = 1.55
const MAX_HEARTS = 3
const BEST_KEY = 'crier3d.best'
const MUTE_KEY = 'crier3d.muted'

const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
const lowPower = isTouch || window.innerWidth < 820
const mobile = lowPower && window.innerWidth < 1000

const canvas = $('scene')
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false
})
const maxDpr = mobile ? 1.55 : 2
let pixelRatio = Math.min(window.devicePixelRatio || 1, maxDpr)
renderer.setPixelRatio(pixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.06
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.shadowMap.autoUpdate = true

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.08, 420)
camera.position.set(0, 3.1, 37)

const audio = new AudioEngine()
const input = new Input(canvas)
let world
let crier
let effects
let post
let elapsed = 0
let mode = 'loading'
let slowMo = 0
let damageFlash = 0
let shake = 0
let flashTimer = 0
let toastCount = 0

const player = {
  pos: new THREE.Vector3(0, 0, 32),
  vel: new THREE.Vector3(),
  heading: 0.24,
  idleTime: 0,
  moving: false
}

let cameraYaw = 0.24
let cameraPitch = 0.38
let cameraDistance = 7.2
let cameraInitialized = false
let cameraTargetSmooth = new THREE.Vector3(0, 1.5, 32)
let dragCooldown = 0

let score = 0
let combo = 1
let comboTimer = 0
let maxCombo = 1
let hearts = MAX_HEARTS
let exposure = 0
let invuln = 0
let timeLeft = DURATION
let screamCooldown = 0
let nightmareMeter = 0
let nightmareReady = false
let banishedCount = 0
let spawnCooldown = 0
let visitorSerial = 0
let dawnWarned = false
let bannerTimer = 0
let tipTimer = 0
let best = readNumber(BEST_KEY, 0)
let muted = readBool(MUTE_KEY, false)
let overCause = 'dawn'
let gameNumber = 0
let lastHud = {}

const visitors = []
let wisps = []

const ui = {
  loading: $('loading'),
  menu: $('menu'),
  hud: $('hud'),
  playBtn: $('playBtn'),
  howBtn: $('howBtn'),
  howModal: $('howModal'),
  pauseScreen: $('pauseScreen'),
  overScreen: $('overScreen'),
  pauseBtn: $('pauseBtn'),
  resumeBtn: $('resumeBtn'),
  pauseRestartBtn: $('pauseRestartBtn'),
  pauseMenuBtn: $('pauseMenuBtn'),
  againBtn: $('againBtn'),
  overMenuBtn: $('overMenuBtn'),
  scoreValue: $('scoreValue'),
  timerValue: $('timerValue'),
  dawnFill: $('dawnFill'),
  hearts: $('hearts'),
  combo: $('combo'),
  comboValue: $('comboValue'),
  nightmareBtn: $('nightmareBtn'),
  nightmareFill: $('nightmareFill'),
  screamBtn: $('screamBtn'),
  exposureWrap: $('exposureWrap'),
  exposureFill: $('exposureFill'),
  danger: $('dangerVignette'),
  flash: $('flash'),
  toasts: $('toasts'),
  floaters: $('floaters'),
  banner: $('banner'),
  bannerTitle: document.querySelector('#banner .banner-title'),
  bannerSub: document.querySelector('#banner .banner-sub'),
  tip: $('tip'),
  tipText: $('tipText'),
  bestScore: $('bestScore'),
  overBest: $('overBest'),
  overKicker: $('overKicker'),
  overTitle: $('overTitle'),
  overStars: $('overStars'),
  overRank: $('overRank'),
  overText: $('overText'),
  statScore: $('statScore'),
  statBanished: $('statBanished'),
  statCombo: $('statCombo')
}

function readNumber(key, fallback) {
  try {
    const v = Number(localStorage.getItem(key))
    return Number.isFinite(v) ? v : fallback
  } catch {
    return fallback
  }
}

function readBool(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch {}
}

function formatScore(value) {
  return Math.max(0, Math.floor(value)).toLocaleString('en-US')
}

function dampAngle(current, target, lambda, dt) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  return current + diff * (1 - Math.exp(-lambda * dt))
}

function makeWisp(position) {
  const group = new THREE.Group()
  group.position.copy(position)
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.17, 1),
    new THREE.MeshStandardMaterial({
      color: 0xdff4ff,
      emissive: 0x7fc7ff,
      emissiveIntensity: 3.4,
      roughness: 0.25,
      metalness: 0.1
    })
  )
  group.add(core)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeWispGlow(),
    color: 0x8fd4ff,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }))
  glow.scale.set(1.7, 1.7, 1)
  group.add(glow)
  scene.add(group)
  return { group, core, glow, baseY: position.y, active: true, timer: 0, phase: Math.random() * 10 }
}

let wispGlowTexture = null
function makeWispGlow() {
  if (!wispGlowTexture) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.2, 'rgba(210,240,255,0.9)')
    g.addColorStop(0.55, 'rgba(110,185,255,0.25)')
    g.addColorStop(1, 'rgba(60,140,220,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    wispGlowTexture = new THREE.CanvasTexture(c)
  }
  return wispGlowTexture
}

function clearWisps() {
  for (const wisp of wisps) {
    scene.remove(wisp.group)
    wisp.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose?.()
      if (child.material) child.material.dispose?.()
    })
  }
  wisps = []
}

function createWisps() {
  clearWisps()
  for (const position of world.wispPoints) {
    wisps.push(makeWisp(position.clone()))
  }
}

function clearVisitors() {
  for (const visitor of visitors) visitor.dispose?.()
  visitors.length = 0
}

function chooseSpawn(initial = false) {
  if (initial) return null
  const points = world.spawnPoints
  let bestPoint = null
  let bestScore = -Infinity
  for (let i = 0; i < 12; i++) {
    const point = points[(Math.random() * points.length) | 0]
    const distPlayer = point.distanceTo(player.pos)
    if (distPlayer < 11) continue
    const distVisitors = visitors.reduce((m, v) => Math.min(m, point.distanceTo(v.position)), Infinity)
    const score = Math.min(distPlayer, 30) + Math.min(distVisitors, 18) * 1.3 + Math.random() * 8
    if (score > bestScore) {
      bestScore = score
      bestPoint = point
    }
  }
  return bestPoint ?? points[(Math.random() * points.length) | 0]
}

function spawnVisitor(initial = false, forcedPosition = null) {
  const point = forcedPosition ?? chooseSpawn(initial)
  if (!point) return null
  const visitor = new Visitor(scene, world, { mobile, index: visitorSerial++ })
  visitor.setPosition(point.x, point.z)
  if (!initial) {
    visitor.spawnT = 0
    visitor.state = 'spawning'
    visitor.group.scale.setScalar(0.001)
  }
  visitors.push(visitor)
  return visitor
}

const initialPoints = [
  [-5.5, 24],
  [7.5, 19.5],
  [-10.5, 7],
  [10.5, 1.5],
  [0, -9]
]

function resetGame() {
  clearVisitors()
  effects.clear()
  for (const wisp of wisps) {
    wisp.active = true
    wisp.group.visible = true
    wisp.group.position.set(wisp.group.position.x, wisp.baseY, wisp.group.position.z)
  }
  score = 0
  combo = 1
  comboTimer = 0
  maxCombo = 1
  hearts = MAX_HEARTS
  exposure = 0
  invuln = 0
  timeLeft = DURATION
  screamCooldown = 0
  nightmareMeter = 0
  nightmareReady = false
  banishedCount = 0
  spawnCooldown = 0
  dawnWarned = false
  slowMo = 0
  damageFlash = 0
  shake = 0
  overCause = 'dawn'
  gameNumber++
  player.pos.set(0, 0, 32)
  player.vel.set(0, 0, 0)
  player.heading = 0.24
  player.idleTime = 0
  player.moving = false
  cameraYaw = 0.24
  cameraPitch = 0.38
  cameraDistance = 7.2
  cameraInitialized = false
  cameraTargetSmooth.set(0, 1.5, 32)
  crier.root.position.set(0, 0, 32)
  crier.root.rotation.y = 0.24
  crier.setExposure(0)
  world.setDawn(0)
  crier.root.visible = true
  ui.hearts.querySelectorAll('.heart').forEach((h) => {
    h.classList.remove('lost', 'pop')
  })
  ui.combo.classList.add('hidden')
  ui.exposureWrap.classList.remove('visible')
  ui.danger.style.opacity = '0'
  ui.nightmareBtn.classList.remove('ready')
  ui.nightmareFill.style.width = '0%'
  lastHud = {}
  createWisps()
  const count = mobile ? 4 : 5
  for (let i = 0; i < count; i++) {
    const point = initialPoints[i % initialPoints.length]
    spawnVisitor(true, new THREE.Vector3(point[0], 0, point[1]))
  }
  updateHUD()
  showBanner('THE NIGHT BEGINS', 'SCARE THEM BEFORE DAWN', 2.6)
  ui.tipText.textContent = isTouch
    ? 'Use the stick to float. Tap SCREAM when you are close.'
    : 'Get close. SPACE to scream. Drag to look around.'
  ui.tip.classList.remove('hide')
  tipTimer = 7
}

function beginGame() {
  audio.init()
  audio.setMuted(muted)
  audio.ui()
  ui.menu.classList.add('hidden')
  ui.howModal.classList.add('hidden')
  ui.pauseScreen.classList.add('hidden')
  ui.overScreen.classList.add('hidden')
  ui.hud.classList.remove('hidden')
  mode = 'playing'
  input.enabled = true
  input.clear()
  resetGame()
  if (best > 0) toast(`BEST FEAR ${formatScore(best)}`, 'gold')
  document.body.classList.add('playing')
}

function goMenu() {
  mode = 'menu'
  input.enabled = false
  input.clear()
  clearVisitors()
  clearWisps()
  effects.clear()
  ui.hud.classList.add('hidden')
  ui.pauseScreen.classList.add('hidden')
  ui.overScreen.classList.add('hidden')
  ui.howModal.classList.add('hidden')
  ui.menu.classList.remove('hidden')
  ui.bestScore.textContent = formatScore(best)
  ui.danger.style.opacity = '0'
  crier.root.visible = true
  crier.root.position.set(0, 0, 31)
  crier.root.rotation.y = 0.28
  crier.setExposure(0)
  world.setDawn(0)
  cameraInitialized = false
  audio.updateTension(0, 0, false)
  resetFloaters()
  ui.combo.classList.add('hidden')
  document.body.classList.remove('playing', 'nightmare')
}

function pauseGame() {
  if (mode !== 'playing') return
  mode = 'paused'
  input.enabled = false
  input.clear()
  ui.pauseScreen.classList.remove('hidden')
}

function resumeGame() {
  if (mode !== 'paused') return
  mode = 'playing'
  input.enabled = true
  ui.pauseScreen.classList.add('hidden')
  input.clear()
}

function togglePause() {
  if (mode === 'playing') pauseGame()
  else if (mode === 'paused') resumeGame()
}

function toggleSound() {
  muted = !muted
  audio.init()
  audio.setMuted(muted)
  if (!muted) audio.ui()
  save(MUTE_KEY, muted ? '1' : '0')
  document.querySelectorAll('[data-sound]').forEach((button) => {
    button.classList.toggle('muted', muted)
    button.setAttribute('aria-label', muted ? 'Enable sound' : 'Toggle sound')
  })
}

function toast(text, tone = '') {
  if (!ui.toasts) return
  const el = document.createElement('div')
  el.className = `toast ${tone}`
  el.textContent = text
  ui.toasts.appendChild(el)
  toastCount++
  if (toastCount > 3) {
    ui.toasts.firstElementChild?.remove()
    toastCount--
  }
  setTimeout(() => {
    el.remove()
    toastCount = Math.max(0, toastCount - 1)
  }, 2700)
}

function showBanner(title, sub, duration = 2.2) {
  ui.bannerTitle.textContent = title
  ui.bannerSub.textContent = sub
  ui.banner.classList.add('show')
  bannerTimer = duration
}

function flashScreen(strength = 0.4) {
  clearTimeout(flashTimer)
  ui.flash.style.background = `radial-gradient(circle at center, rgba(255,255,255,${strength}), rgba(255,45,65,${strength * 0.45}) 45%, transparent 76%)`
  ui.flash.classList.add('fire')
  flashTimer = setTimeout(() => ui.flash.classList.remove('fire'), 100)
}

function resetFloaters() {
  if (ui.floaters) ui.floaters.replaceChildren()
}

function floater(text, worldPos, className = '') {
  if (!ui.floaters || window.innerWidth < 760) return
  const v = worldPos.clone()
  v.project(camera)
  if (v.z > 1) return
  const x = (v.x * 0.5 + 0.5) * window.innerWidth
  const y = (-v.y * 0.5 + 0.5) * window.innerHeight
  const el = document.createElement('div')
  el.className = `floater ${className}`
  el.textContent = text
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  ui.floaters.appendChild(el)
  setTimeout(() => el.remove(), 1050)
}

function computePan(worldPos) {
  const dir = worldPos.clone().sub(camera.position)
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
  return clamp(dir.dot(right) / 18, -1, 1)
}

function awardFear(visitor, banished, nightmare = false) {
  const multiplier = Math.max(1, combo)
  const base = banished ? 650 : 120
  const gain = Math.round(base * multiplier * (nightmare ? 2 : 1))
  score += gain
  floater(`+${formatScore(gain)}`, new THREE.Vector3(visitor.position.x, 2.1, visitor.position.z), banished ? 'is-red' : '')
  combo = Math.min(9, combo + 1)
  maxCombo = Math.max(maxCombo, combo)
  comboTimer = 4
  if (banished) {
    banishedCount++
    if (nightmareMeter < 1) {
      nightmareMeter = Math.min(1, nightmareMeter + 0.17)
      if (nightmareMeter >= 1 && !nightmareReady) {
        nightmareReady = true
        toast('NIGHTMARE READY', 'gold')
        audio.tick(true)
      }
    }
    ui.combo.classList.add('bump')
    setTimeout(() => ui.combo.classList.remove('bump'), 320)
  }
}

function onBanished(visitor, nightmare = false) {
  effects.banish(visitor.position)
  audio.banish(computePan(visitor.position))
  floater('BANISHED', new THREE.Vector3(visitor.position.x, 2.55, visitor.position.z), 'is-gold')
  const pan = computePan(visitor.position)
  if (nightmare) audio.hit(pan)
}

function affectVisitor(visitor, { nightmare = false, instant = false } = {}) {
  if (!visitor || visitor.dead || visitor.state === 'banished' || visitor.state === 'spawning') return
  const first = visitor.applyFear()
  if (!first.hit) return
  awardFear(visitor, first.banished, nightmare)
  effects.hit(new THREE.Vector3(visitor.position.x, 1.2, visitor.position.z), first.banished)
  if (!first.banished && instant) {
    const second = visitor.applyFear()
    if (second.hit) {
      awardFear(visitor, second.banished, nightmare)
      effects.hit(new THREE.Vector3(visitor.position.x, 1.2, visitor.position.z), second.banished)
      if (second.banished) onBanished(visitor, nightmare)
    }
  } else if (first.banished) {
    onBanished(visitor, nightmare)
  }
}

function doScream() {
  if (screamCooldown > 0) return
  screamCooldown = SCREAM_COOLDOWN
  audio.scream(1, 0)
  effects.scream(player.pos, 1)
  crier.scream()
  shake = Math.max(shake, 0.42)
  flashScreen(0.28)
  ui.screamBtn.classList.add('pressed')
  setTimeout(() => ui.screamBtn.classList.remove('pressed'), 130)
  if (navigator.vibrate) navigator.vibrate(24)

  const hits = visitors.filter((visitor) => {
    if (visitor.dead || visitor.state === 'banished' || visitor.state === 'spawning') return false
    return visitor.position.distanceTo(player.pos) <= SCREAM_RADIUS
  })
  for (const visitor of hits) {
    const dist = visitor.position.distanceTo(player.pos)
    affectVisitor(visitor, {})
    if (dist < 4.2) {
      floater('CLOSE CALL', new THREE.Vector3(visitor.position.x, 2.4, visitor.position.z), 'is-gold')
    }
  }
  if (hits.length === 0) {
    floater('MISS', new THREE.Vector3(player.pos.x, 2.2, player.pos.z))
  }
}

function activateNightmare() {
  if (!nightmareReady || mode !== 'playing') {
    if (mode === 'playing') toast('NIGHTMARE NOT READY')
    return
  }
  nightmareReady = false
  nightmareMeter = 0
  slowMo = 1.15
  shake = Math.max(shake, 1.2)
  flashScreen(0.7)
  audio.nightmare()
  crier.scream()
  effects.scream(player.pos, 2.4)
  showBanner('NIGHTMARE UNLEASHED', 'THE HILL ANSWERS YOUR CALL', 2.2)
  document.body.classList.add('nightmare')
  setTimeout(() => document.body.classList.remove('nightmare'), 1300)
  if (navigator.vibrate) navigator.vibrate([40, 40, 80, 40, 120])

  const targets = visitors.filter((v) => !v.dead && v.state !== 'banished')
  for (const visitor of targets) affectVisitor(visitor, { nightmare: true, instant: true })
  exposure = 0
  invuln = Math.max(invuln, 1.2)
}

function damagePlayer(hazardPos) {
  if (invuln > 0 || mode !== 'playing') return
  hearts--
  invuln = 1.8
  exposure = 0
  combo = 1
  comboTimer = 0
  shake = 1
  damageFlash = 1
  audio.damage()
  flashScreen(0.55)
  showBanner('BURNED BY LIGHT', 'THE LANTERNS SEE YOU', 1.7)
  ui.hearts.querySelectorAll('.heart')[hearts]?.classList.add('pop')
  const away = new THREE.Vector3(player.pos.x - hazardPos.x, 0, player.pos.z - hazardPos.z)
  if (away.lengthSq() < 0.01) away.set(1, 0, 0)
  away.normalize()
  player.pos.addScaledVector(away, 2.2)
  resolvePlayerCollisions()
  if (navigator.vibrate) navigator.vibrate([30, 30, 60])
  if (hearts <= 0) endGame('banished')
}

function endGame(cause) {
  if (mode === 'over') return
  mode = 'over'
  input.enabled = false
  input.clear()
  overCause = cause
  slowMo = 0
  const starCount = score >= 18000 ? 3 : score >= 9000 ? 2 : score >= 3000 ? 1 : 0
  const rank = score >= 25000 ? 'S' : score >= 18000 ? 'A' : score >= 9000 ? 'B' : score >= 3000 ? 'C' : 'D'
  const isBest = score > best
  if (isBest) {
    best = score
    save(BEST_KEY, best)
  }
  ui.bestScore.textContent = formatScore(best)
  ui.overBest.textContent = formatScore(best)
  ui.overStars.textContent = `${'★'.repeat(starCount)}${'☆'.repeat(3 - starCount)}`
  ui.overRank.textContent = rank
  ui.statScore.textContent = formatScore(score)
  ui.statBanished.textContent = String(banishedCount)
  ui.statCombo.textContent = `x${maxCombo}`
  if (cause === 'banished') {
    ui.overKicker.textContent = 'THE LIGHT BANISHED YOU'
    ui.overTitle.textContent = 'EXORCISED'
    ui.overText.textContent = 'Your ectoplasm scattered on the wind. The hill will remember your scream.'
    audio.lose()
  } else {
    ui.overKicker.textContent = 'THE SUN BREAKS THE SPELL'
    ui.overTitle.textContent = 'NIGHT OVER'
    ui.overText.textContent = isBest
      ? 'A new legend haunts Hollow Hill. The wanderers will speak of you for years.'
      : starCount >= 2
        ? 'The wanderers fled before dawn. The hill is yours a little longer.'
        : 'Dawn has come. The wanderers escaped with their fears — for now.'
    if (starCount > 0) audio.win()
    else audio.dawn()
  }
  audio.updateTension(0, 0, false)
  setTimeout(() => {
    if (mode === 'over') ui.overScreen.classList.remove('hidden')
  }, cause === 'banished' ? 500 : 900)
}

function resolvePlayerCollisions() {
  const radius = 0.55
  for (const collider of world.colliders) {
    const dx = player.pos.x - collider.x
    const dz = player.pos.z - collider.z
    const dist = Math.hypot(dx, dz)
    const safe = collider.r + radius
    if (dist < safe && dist > 0.0001) {
      player.pos.x = collider.x + (dx / dist) * safe
      player.pos.z = collider.z + (dz / dist) * safe
    }
  }
  const b = world.bounds - 1.2
  player.pos.x = clamp(player.pos.x, -b, b)
  player.pos.z = clamp(player.pos.z, -35.5, b)
}

function updatePlayer(dt) {
  const move = input.getMove()
  const moving = move.lengthSq() > 0.0025
  player.moving = moving
  if (moving) {
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw))
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw))
    const dir = new THREE.Vector3().addScaledVector(forward, move.y).addScaledVector(right, move.x)
    if (dir.lengthSq() > 0) dir.normalize()
    const speed = 9.4
    player.vel.x = THREE.MathUtils.damp(player.vel.x, dir.x * speed, 9, dt)
    player.vel.z = THREE.MathUtils.damp(player.vel.z, dir.z * speed, 9, dt)
    const target = Math.atan2(dir.x, dir.z)
    player.heading = dampAngle(player.heading, target, 14, dt)
    player.idleTime = 0
  } else {
    player.vel.x = THREE.MathUtils.damp(player.vel.x, 0, 7, dt)
    player.vel.z = THREE.MathUtils.damp(player.vel.z, 0, 7, dt)
    player.idleTime += dt
    if (player.idleTime > 0.85) player.heading = dampAngle(player.heading, cameraYaw, 4.5, dt)
  }
  player.pos.x += player.vel.x * dt
  player.pos.z += player.vel.z * dt
  resolvePlayerCollisions()
  crier.root.position.x = player.pos.x
  crier.root.position.z = player.pos.z
  crier.root.rotation.y = player.heading
  crier.setMoving(moving ? 1 : 0)
}

function updateCamera(dt) {
  const delta = input.consumeCamera()
  if (delta.lengthSq() > 0.0000001) {
    cameraYaw -= delta.x
    cameraPitch = clamp(cameraPitch + delta.y * 0.85, 0.13, 0.86)
    dragCooldown = 0
  } else {
    dragCooldown += dt
  }
  const zoom = input.consumeZoom()
  if (zoom) cameraDistance = clamp(cameraDistance + zoom, 4.8, 11.5)
  if (player.moving && dragCooldown > 2.6) {
    cameraYaw = dampAngle(cameraYaw, player.heading + Math.PI, 0.9, dt)
  }
  const target = new THREE.Vector3(crier.root.position.x, 1.55 + crier.root.position.y, crier.root.position.z)
  const horizontal = Math.cos(cameraPitch) * cameraDistance
  const desired = new THREE.Vector3(
    target.x + Math.sin(cameraYaw) * horizontal,
    target.y + Math.sin(cameraPitch) * cameraDistance + 0.35,
    target.z + Math.cos(cameraYaw) * horizontal
  )
  if (!cameraInitialized) {
    camera.position.copy(desired)
    cameraTargetSmooth.copy(target)
    cameraInitialized = true
  } else {
    const follow = 1 - Math.exp(-dt * 8)
    camera.position.lerp(desired, follow)
    cameraTargetSmooth.lerp(target, 1 - Math.exp(-dt * 10))
  }
  const look = cameraTargetSmooth.clone()
  if (shake > 0.001) {
    const amp = shake * 0.3
    camera.position.x += (Math.random() - 0.5) * amp
    camera.position.y += (Math.random() - 0.5) * amp * 0.65
    camera.position.z += (Math.random() - 0.5) * amp
    look.x += (Math.random() - 0.5) * amp * 0.25
    look.y += (Math.random() - 0.5) * amp * 0.2
  }
  camera.lookAt(look)
  camera.fov = THREE.MathUtils.damp(camera.fov, 52, 4, dt)
  camera.updateProjectionMatrix()
}

let menuLook = new THREE.Vector3(0, 2, 31)
function updateMenuCamera(dt, instant = false) {
  const t = elapsed
  const angle = 0.26 + Math.sin(t * 0.115) * 0.26
  const radius = mobile ? 5.6 : 5.9
  const target = new THREE.Vector3(crier.root.position.x - (mobile ? 0 : 0.12), 2.02, crier.root.position.z)
  const desired = new THREE.Vector3(
    target.x + Math.sin(angle) * radius,
    target.y + 1.05 + Math.sin(t * 0.31) * 0.07,
    target.z + Math.cos(angle) * radius
  )
  if (instant || !cameraInitialized) {
    camera.position.copy(desired)
    menuLook.copy(target)
    cameraInitialized = true
  } else {
    camera.position.lerp(desired, 1 - Math.exp(-dt * 2.8))
    menuLook.lerp(target, 1 - Math.exp(-dt * 3.5))
  }
  camera.lookAt(menuLook)
  if (camera.fov !== 50) {
    camera.fov = THREE.MathUtils.damp(camera.fov, 50, 3, dt)
    camera.updateProjectionMatrix()
  }
  crier.root.rotation.y = dampAngle(crier.root.rotation.y, angle, 2.3, dt)
}

function updateVisitors(dt) {
  for (let i = visitors.length - 1; i >= 0; i--) {
    const visitor = visitors[i]
    visitor.update(dt, elapsed, player.pos, visitors)
    if (visitor.dead) {
      visitors.splice(i, 1)
    }
  }
  spawnCooldown -= dt
  const active = visitors.filter((v) => v.state !== 'banished').length
  const maxVisitors = mobile ? 4 : 5
  if (active < maxVisitors && spawnCooldown <= 0) {
    spawnVisitor(false)
    spawnCooldown = 0.85
  }
}

function updateWisps(dt) {
  for (const wisp of wisps) {
    if (!wisp.active) {
      wisp.timer -= dt
      if (wisp.timer <= 0) {
        wisp.active = true
        wisp.group.visible = true
      }
      continue
    }
    const t = elapsed + wisp.phase
    wisp.group.position.y = wisp.baseY + Math.sin(t * 1.7) * 0.18
    wisp.group.rotation.y += dt * 1.2
    wisp.group.rotation.x = Math.sin(t * 1.2) * 0.25
    wisp.glow.material.opacity = 0.6 + Math.sin(t * 2.2) * 0.14
    const d = Math.hypot(wisp.group.position.x - player.pos.x, wisp.group.position.z - player.pos.z)
    if (d < 1.55 && Math.abs(wisp.group.position.y - 1.2) < 2.2) {
      wisp.active = false
      wisp.group.visible = false
      wisp.timer = 14
      score += 200
      nightmareMeter = Math.min(1, nightmareMeter + 0.12)
      if (nightmareMeter >= 1 && !nightmareReady) {
        nightmareReady = true
        toast('NIGHTMARE READY', 'gold')
        audio.tick(true)
      }
      effects.collect(wisp.group.position)
      audio.collect()
      toast('FEAR ECHO +200', 'gold')
    }
  }
}

function updateExposure(dt) {
  let rate = 0
  let hazardPos = null
  if (invuln <= 0) {
    for (const visitor of visitors) {
      if (visitor.dead || visitor.state === 'banished') continue
      if (!visitor.isHazard()) continue
      const d = Math.hypot(visitor.position.x - player.pos.x, visitor.position.z - player.pos.z)
      if (d < visitor.hazardRadius) {
        rate = Math.max(rate, 0.56)
        hazardPos = visitor.position.clone()
      }
    }
    for (const lantern of world.lanterns) {
      const d = Math.hypot(lantern.position.x - player.pos.x, lantern.position.z - player.pos.z)
      if (d < 3.05) {
        rate = Math.max(rate, 0.4)
        hazardPos = lantern.position.clone()
      }
    }
  }
  if (rate > 0) {
    exposure = Math.min(1, exposure + rate * dt)
    if (exposure >= 1 && hazardPos) damagePlayer(hazardPos)
  } else {
    exposure = Math.max(0, exposure - dt * 0.62)
  }
  invuln = Math.max(0, invuln - dt)
  crier.setExposure(exposure)
  ui.danger.style.opacity = String(exposure * 0.85)
  ui.exposureWrap.classList.toggle('visible', exposure > 0.015)
  ui.exposureFill.style.width = `${exposure * 100}%`
  audio.updateTension(exposure, dt, true)
}

function updateHUD() {
  const scoreText = formatScore(score)
  if (lastHud.score !== scoreText) {
    ui.scoreValue.textContent = scoreText
    lastHud.score = scoreText
  }
  const seconds = Math.max(0, Math.ceil(timeLeft))
  const timeText = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  if (lastHud.time !== timeText) {
    ui.timerValue.textContent = timeText
    lastHud.time = timeText
  }
  ui.timerValue.classList.toggle('urgent', timeLeft <= 15)
  ui.dawnFill.style.width = `${clamp(1 - timeLeft / DURATION, 0, 1) * 100}%`
  const showCombo = combo > 1 && comboTimer > 0
  ui.combo.classList.toggle('hidden', !showCombo)
  if (lastHud.combo !== combo) {
    ui.comboValue.textContent = String(combo)
    lastHud.combo = combo
  }
  const heartEls = ui.hearts.querySelectorAll('.heart')
  heartEls.forEach((heart, index) => {
    heart.classList.toggle('lost', index >= hearts)
  })
  ui.nightmareFill.style.width = `${nightmareMeter * 100}%`
  ui.nightmareBtn.classList.toggle('ready', nightmareReady)
  const cool = screamCooldown > 0 ? 1 - screamCooldown / SCREAM_COOLDOWN : 1
  ui.screamBtn.style.setProperty('--p', String(cool))
  ui.screamBtn.classList.toggle('cooling', screamCooldown > 0)
}

function simulate(dt) {
  const dtGame = slowMo > 0 ? dt * 0.38 : dt
  slowMo = Math.max(0, slowMo - dt)
  timeLeft -= dtGame
  world.setDawn(clamp(1 - timeLeft / DURATION, 0, 1))
  if (timeLeft <= 20 && !dawnWarned) {
    dawnWarned = true
    showBanner('DAWN IS COMING', 'THE SKY REMEMBERS THE SUN', 2.2)
    audio.tick(true)
  }
  if (timeLeft <= 0) {
    timeLeft = 0
    updateHUD()
    endGame('dawn')
    return
  }

  updatePlayer(dtGame)
  updateVisitors(dtGame)
  updateWisps(dtGame)
  updateExposure(dtGame)

  if (input.consumeScream()) doScream()
  if (input.consumeNightmare()) activateNightmare()
  screamCooldown = Math.max(0, screamCooldown - dt)
  comboTimer = Math.max(0, comboTimer - dtGame)
  if (comboTimer <= 0 && combo > 1) combo = 1

  shake = Math.max(0, shake - dt * 2.4)
  damageFlash = Math.max(0, damageFlash - dt * 3)
  bannerTimer -= dt
  if (bannerTimer <= 0) ui.banner.classList.remove('show')
  if (tipTimer > 0) {
    tipTimer -= dt
    if (tipTimer <= 0) ui.tip.classList.add('hide')
  }
  updateHUD()
  post.update(elapsed, clamp(exposure + damageFlash * 0.5, 0, 1))
}

function updateMenu(dt) {
  bannerTimer -= dt
  if (bannerTimer <= 0) ui.banner.classList.remove('show')
  if (tipTimer > 0) {
    tipTimer -= dt
    if (tipTimer <= 0) ui.tip.classList.add('hide')
  }
  audio.updateTension(0, dt, false)
  const eye = new THREE.Vector3(crier.root.position.x, 1.9, crier.root.position.z)
  eye.project(camera)
  crier.setExposure(clamp((eye.y + 0.2) * 0.1, 0, 0.1))
}

function updateOver(dt) {
  shake = Math.max(0, shake - dt * 3)
  damageFlash = Math.max(0, damageFlash - dt * 2)
  bannerTimer -= dt
  if (bannerTimer <= 0) ui.banner.classList.remove('show')
  post.update(elapsed, 0)
}

function bindUI() {
  ui.bestScore.textContent = formatScore(best)
  ui.playBtn.addEventListener('click', beginGame)
  ui.howBtn.addEventListener('click', () => {
    audio.init()
    audio.ui()
    ui.howModal.classList.remove('hidden')
  })
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = $(button.dataset.close)
      target?.classList.add('hidden')
      audio.ui()
    })
  })
  ui.howModal.addEventListener('pointerdown', (event) => {
    if (event.target === ui.howModal) ui.howModal.classList.add('hidden')
  })
  ui.pauseBtn.addEventListener('click', () => {
    audio.ui()
    pauseGame()
  })
  ui.resumeBtn.addEventListener('click', () => {
    audio.ui()
    resumeGame()
  })
  ui.pauseRestartBtn.addEventListener('click', () => {
    audio.ui()
    beginGame()
  })
  ui.pauseMenuBtn.addEventListener('click', () => {
    audio.ui()
    goMenu()
  })
  ui.againBtn.addEventListener('click', () => {
    audio.ui()
    beginGame()
  })
  ui.overMenuBtn.addEventListener('click', () => {
    audio.ui()
    goMenu()
  })
  ui.nightmareBtn.addEventListener('click', () => {
    if (mode === 'playing') {
      if (nightmareReady) activateNightmare()
      else toast('NIGHTMARE NOT READY')
    }
  })
  document.querySelectorAll('[data-sound]').forEach((button) => {
    button.addEventListener('click', () => {
      audio.init()
      audio.ui()
      toggleSound()
    })
    button.classList.toggle('muted', muted)
  })
  input.onPause = togglePause
  input.onMute = toggleSound
  input.onAnyAction = () => {
    if (tipTimer > 3) tipTimer = Math.min(tipTimer, 3)
  }
}

function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  post?.setSize(w, h)
  if (post) {
    post.bloom.strength = w < 760 ? 0.42 : 0.68
    post.grade.uniforms.uVignette.value = w < 760 ? 0.95 : 0.88
  }
}

function tick(now) {
  requestAnimationFrame(tick)
  const raw = (now - lastFrameTime) / 1000
  lastFrameTime = now
  const dt = Math.min(0.05, Math.max(0.0001, raw))
  elapsed += dt

  if (mode === 'playing') simulate(dt)
  else if (mode === 'menu') updateMenu(dt)
  else if (mode === 'over') updateOver(dt)
  else if (mode === 'paused') {
    bannerTimer -= dt
    if (bannerTimer <= 0) ui.banner.classList.remove('show')
  }

  crier.update(mode === 'playing' ? dt : dt * 0.7, elapsed)
  if (mode === 'menu') {
    updateMenuCamera(dt)
  } else if (mode === 'playing' || mode === 'over') {
    updateCamera(dt)
  }
  world.update(dt, elapsed)
  effects.update(mode === 'paused' ? 0 : dt)
  if (mode === 'menu') {
    post.update(elapsed, 0.02)
  } else if (mode !== 'playing') {
    post.update(elapsed, clamp(damageFlash, 0, 1))
  }
  post.composer.render()
}

let lastFrameTime = performance.now()

async function boot() {
  await document.fonts.ready.catch(() => {})
  world = await createWorld(scene, renderer, { mobile })
  crier = createCrier()
  crier.root.position.set(0, 0, 31)
  crier.root.rotation.y = 0.28
  scene.add(crier.root)
  effects = new Effects(scene)
  post = createPostProcessing(renderer, scene, camera, { mobile })
  post.setSize(window.innerWidth, window.innerHeight)
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') pauseGame()
  })
  bindUI()
  updateMenuCamera(0, true)
  camera.lookAt(menuLook)
  post.composer.render()
  requestAnimationFrame(tick)
  setTimeout(() => {
    ui.loading.classList.add('done')
    mode = 'menu'
    input.enabled = false
    document.body.dataset.gameReady = '1'
    window.__CRIER_READY__ = true
  }, 200)
}

window.__crier = {
  start: beginGame,
  scream: doScream,
  nightmare: activateNightmare,
  menu: goMenu,
  pause: pauseGame,
  resume: resumeGame,
  state: () => mode,
  stats: () => ({ score, combo, maxCombo, hearts, timeLeft, nightmareMeter, nightmareReady, banished: banishedCount, visitors: visitors.length }),
  setTime: (value) => { timeLeft = clamp(value, 0, DURATION) },
  addFear: (value) => {
    nightmareMeter = clamp(nightmareMeter + value, 0, 1)
    if (nightmareMeter >= 1) nightmareReady = true
  }
}

boot().catch((error) => {
  console.error(error)
  ui.loading.innerHTML = `<div class="loading-sub">THE HILL IS SILENT<br>${String(error.message || error)}</div>`
})
