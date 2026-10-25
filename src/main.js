import { DIRECTIONS, LEVELS, SnakeGame } from './game-core.js'

const $ = id => document.getElementById(id)

const dom = {
  stage: $('stage'),
  boardShell: $('board-shell'),
  canvas: $('board'),
  score: $('score'),
  best: $('best'),
  levelBadge: $('level-badge'),
  levelName: $('level-name'),
  mechanicTag: $('mechanic-tag'),
  progressTrack: $('progress-track'),
  fruitPips: $('fruit-pips'),
  progressCount: $('progress-count'),
  comboBadge: $('combo-badge'),
  hintGoal: $('hint-goal'),
  levelToast: $('level-toast'),
  toastKicker: $('toast-kicker'),
  toastTitle: $('toast-title'),
  soundBtn: $('sound-btn'),
  pauseBtn: $('pause-btn'),
  startBtn: $('start-btn'),
  levelsBtn: $('levels-btn'),
  startPhase: $('start-phase'),
  titleBest: $('title-best'),
  titleComplete: $('title-complete'),
  titleModal: $('screen-title'),
  levelsModal: $('screen-levels'),
  levelsClose: $('levels-close'),
  levelGrid: $('level-grid'),
  pauseModal: $('overlay-pause'),
  pauseCopy: $('pause-copy'),
  resumeBtn: $('resume-btn'),
  restartBtn: $('restart-btn'),
  quitBtn: $('quit-btn'),
  resultModal: $('overlay-result'),
  resultSymbol: $('result-symbol'),
  resultKicker: $('result-kicker'),
  resultTitle: $('result-heading'),
  resultCopy: $('result-copy'),
  resultScore: $('result-score'),
  resultFruits: $('result-fruits'),
  resultBest: $('result-best'),
  resultPrimary: $('result-primary'),
  resultSecondary: $('result-secondary'),
  resultMenu: $('result-menu'),
  live: $('live-status'),
  dpad: $('dpad')
}

const STORE_KEY = 'cobra-neon-v1'
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const ctx = dom.canvas.getContext('2d')

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatScore(value) {
  const safe = Math.max(0, Math.floor(Number(value) || 0))
  return String(safe).padStart(6, '0')
}

function loadProfile() {
  const fallback = { unlocked: 1, completed: [], best: 0, muted: false }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    const completed = Array.isArray(parsed.completed)
      ? [...new Set(parsed.completed.filter(value => Number.isInteger(value) && value >= 0 && value < LEVELS.length))]
      : []
    return {
      unlocked: clamp(Math.floor(Number(parsed.unlocked) || 1), 1, LEVELS.length),
      completed,
      best: Math.max(0, Math.floor(Number(parsed.best) || 0)),
      muted: Boolean(parsed.muted)
    }
  } catch {
    return fallback
  }
}

let profile = loadProfile()
let game = null
let phase = 'title'
let levelIndex = 0
let acc = 0
let lastFrame = performance.now()
let lastScore = -1
let pipElements = []
let particles = []
let shake = 0
let currentResultKind = null
let overlayTimer = 0
let toastTimer = 0
let fitFrame = 0
let metrics = null
let bgCache = null
let bgKey = ''
let swipe = null
let audioCtx = null
let masterGain = null
let awaitingStart = false
let startDeadline = 0
let renderDirty = true

function persistProfile() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(profile))
  } catch {
    return
  }
}

function applyTheme(level) {
  document.documentElement.style.setProperty('--accent', level.accent)
  document.documentElement.style.setProperty('--accent-2', level.accent2)
}

function syncSoundButton() {
  dom.soundBtn.setAttribute('aria-pressed', String(!profile.muted))
  dom.soundBtn.setAttribute('aria-label', profile.muted ? 'Ativar som' : 'Desativar som')
}

function say(message) {
  dom.live.textContent = message
}

function hideAllModals() {
  dom.titleModal.hidden = true
  dom.levelsModal.hidden = true
  dom.pauseModal.hidden = true
  dom.resultModal.hidden = true
}

function revealModal(modal, selector = 'button:not(:disabled)') {
  modal.hidden = false
  requestAnimationFrame(() => {
    const target = modal.querySelector(selector)
    if (target) target.focus({ preventScroll: true })
  })
}

function buildPips(goal) {
  const fragment = document.createDocumentFragment()
  for (let index = 0; index < goal; index += 1) {
    const pip = document.createElement('span')
    pip.className = 'pip'
    fragment.appendChild(pip)
  }
  dom.fruitPips.replaceChildren(fragment)
  pipElements = [...dom.fruitPips.children]
  dom.progressTrack.setAttribute('aria-valuemax', String(goal))
}

function updateHud() {
  if (!game) return
  const { level } = game
  const displayScore = game.score
  dom.levelBadge.textContent = `FASE ${pad2(game.levelIndex + 1)}`
  dom.levelName.textContent = level.name
  dom.score.textContent = formatScore(displayScore)
  dom.best.textContent = formatScore(Math.max(profile.best, displayScore))
  dom.progressCount.textContent = `${game.progress}/${game.goal}`
  dom.progressTrack.setAttribute('aria-valuenow', String(game.progress))
  dom.progressTrack.setAttribute('aria-valuetext', `${game.progress} de ${game.goal} núcleos`)

  const flags = []
  if (level.wrap) flags.push('PORTAL')
  if (level.hazards) flags.push(`DRONE x${level.hazards}`)
  if (flags.length) {
    dom.mechanicTag.textContent = flags.join(' · ')
    dom.mechanicTag.hidden = false
  } else {
    dom.mechanicTag.hidden = true
  }

  if (level.wrap && level.hazards) {
    dom.hintGoal.textContent = 'Bordas teletransportam. Sentinelas não perdoam.'
  } else if (level.wrap) {
    dom.hintGoal.textContent = 'As bordas do tabuleiro são portais.'
  } else if (level.hazards) {
    dom.hintGoal.textContent = 'Desvie das sentinelas vermelhas na borda.'
  } else {
    dom.hintGoal.textContent = 'Coma os núcleos e não encoste em nada.'
  }

  pipElements.forEach((pip, index) => {
    pip.classList.toggle('is-filled', index < game.progress)
  })

  const showCombo = game.combo > 1 && (phase === 'playing' || phase === 'paused')
  dom.comboBadge.hidden = !showCombo
  if (showCombo) dom.comboBadge.textContent = `x${game.combo}`

  if (displayScore !== lastScore) {
    if (lastScore >= 0) {
      dom.score.classList.remove('is-bump')
      void dom.score.offsetWidth
      dom.score.classList.add('is-bump')
    }
    lastScore = displayScore
  }

  dom.pauseBtn.disabled = !(phase === 'playing' || phase === 'paused')
}

function updateTitle() {
  const startIndex = clamp(profile.unlocked - 1, 0, LEVELS.length - 1)
  const level = LEVELS[startIndex]
  dom.titleBest.textContent = formatScore(profile.best)
  dom.titleComplete.textContent = String(profile.completed.length)
  dom.startPhase.textContent = `FASE ${pad2(startIndex + 1)} · ${level.name.toUpperCase()}`
}

function showToast(level) {
  dom.toastKicker.textContent = `FASE ${pad2(level.index + 1)}`
  let title = 'COMECE A CAÇAR'
  if (level.wrap && level.hazards) title = 'PORTAIS + SENTINELAS'
  else if (level.wrap) title = 'ATRAVESSE AS BORDAS'
  else if (level.hazards) title = 'FUJA DAS SENTINELAS'
  dom.toastTitle.textContent = title
  dom.levelToast.classList.add('is-visible')
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    dom.levelToast.classList.remove('is-visible')
  }, 2600)
}

function prepareBoard() {
  dom.boardShell.classList.remove('is-hit', 'is-clear')
  particles = []
  shake = 0
  acc = 0
  lastScore = -1
  lastFrame = performance.now()
}

function startLevel(index) {
  const safeIndex = clamp(Math.floor(Number(index) || 0), 0, LEVELS.length - 1)
  clearTimeout(overlayTimer)
  clearTimeout(toastTimer)
  hideAllModals()
  levelIndex = safeIndex
  game = new SnakeGame(safeIndex)
  applyTheme(game.level)
  buildPips(game.level.goal)
  prepareBoard()
  phase = 'playing'
  awaitingStart = true
  startDeadline = performance.now() + 2000
  renderDirty = true
  updateHud()
  scheduleFit()
  showToast(game.level)
  say(`Fase ${safeIndex + 1}, ${game.level.name}. Colete ${game.level.goal} núcleos.`)
  sfx('start')
}

function showTitle() {
  clearTimeout(overlayTimer)
  clearTimeout(toastTimer)
  awaitingStart = false
  dom.levelToast.classList.remove('is-visible')
  hideAllModals()
  const previewIndex = clamp(profile.unlocked - 1, 0, LEVELS.length - 1)
  levelIndex = previewIndex
  game = new SnakeGame(previewIndex)
  applyTheme(game.level)
  buildPips(game.level.goal)
  prepareBoard()
  phase = 'title'
  renderDirty = true
  updateHud()
  updateTitle()
  scheduleFit()
  revealModal(dom.titleModal, '#start-btn')
}

function renderLevelGrid() {
  const fragment = document.createDocumentFragment()
  const lockIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  const checkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

  LEVELS.forEach((level, index) => {
    const unlocked = index < profile.unlocked
    const completed = profile.completed.includes(index)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'level-card'
    button.dataset.level = String(index)
    button.disabled = !unlocked
    if (!unlocked) button.classList.add('is-locked')
    if (completed) button.classList.add('is-complete')
    button.setAttribute(
      'aria-label',
      unlocked
        ? `Jogar fase ${index + 1}: ${level.name}${completed ? ', concluída' : ''}`
        : `Fase ${index + 1} bloqueada`
    )

    const flags = [`${level.goal} NÚCLEOS`]
    if (level.wrap) flags.push('PORTAL')
    if (level.hazards) flags.push(`DRONE ${level.hazards}`)

    button.innerHTML = `
      <span class="level-number">FASE ${pad2(index + 1)}</span>
      <span class="level-title">${level.name}</span>
      <span class="level-sub">${level.note}</span>
      <span class="level-flags">${flags.map(flag => `<span class="level-flag">${flag}</span>`).join('')}</span>
      <span class="level-state ${unlocked ? '' : 'is-lock'}">${completed ? checkIcon : unlocked ? '' : lockIcon}</span>
    `
    fragment.appendChild(button)
  })

  dom.levelGrid.replaceChildren(fragment)
}

function openLevels() {
  clearTimeout(overlayTimer)
  hideAllModals()
  phase = 'select'
  renderLevelGrid()
  revealModal(dom.levelsModal, '#levels-close')
  dom.pauseBtn.disabled = true
}

function pauseGame() {
  if (phase !== 'playing') return
  phase = 'paused'
  dom.pauseCopy.textContent = `Fase ${pad2(game.levelIndex + 1)} · ${game.progress}/${game.goal} núcleos · ${formatScore(game.score)} pontos`
  revealModal(dom.pauseModal, '#resume-btn')
  updateHud()
  sfx('click')
}

function resumeGame() {
  if (phase !== 'paused') return
  dom.pauseModal.hidden = true
  phase = 'playing'
  lastFrame = performance.now()
  updateHud()
  sfx('click')
}

function recordLevelClear() {
  profile.unlocked = Math.max(profile.unlocked, Math.min(LEVELS.length, game.levelIndex + 2))
  if (!profile.completed.includes(game.levelIndex)) {
    profile.completed.push(game.levelIndex)
    profile.completed.sort((a, b) => a - b)
  }
  profile.best = Math.max(profile.best, game.score)
  persistProfile()
}

function recordScore() {
  if (game.score > profile.best) {
    profile.best = game.score
    persistProfile()
  }
}

function showResult(kind) {
  overlayTimer = 0
  hideAllModals()
  phase = 'result'
  currentResultKind = kind
  dom.resultModal.dataset.state = kind === 'dead' ? 'dead' : 'win'

  const deathText = {
    wall: {
      title: 'Parede dura',
      copy: 'A cobra bateu na borda do setor. Ajuste a curva e tente outra rota.'
    },
    self: {
      title: 'Nó na cobra',
      copy: 'Você mordeu o próprio corpo. Planeje a curva com um pouco mais de espaço.'
    },
    obstacle: {
      title: 'Bloco no caminho',
      copy: 'A cabeça bateu em um obstáculo. Use as aberturas do labirinto.'
    },
    drone: {
      title: 'Sentinela em ação',
      copy: 'Um drone cruzou o seu caminho. Observe a patrulha antes de avançar.'
    }
  }

  if (kind === 'dead') {
    const text = deathText[game.deathReason] || {
      title: 'Fim da linha',
      copy: 'A selva venceu esta rodada. Tente novamente.'
    }
    dom.resultSymbol.textContent = 'X'
    dom.resultKicker.textContent = 'FIM DE JOGO'
    dom.resultTitle.textContent = text.title
    dom.resultCopy.textContent = `${text.copy} Fase ${pad2(game.levelIndex + 1)}.`
    dom.resultPrimary.textContent = 'Tentar de novo'
    dom.resultSecondary.textContent = 'Selecionar fase'
    recordScore()
    say(`Fim de jogo. ${text.title}. Pontuação ${game.score}.`)
  } else if (kind === 'victory') {
    dom.resultSymbol.textContent = '10'
    dom.resultKicker.textContent = 'VITÓRIA TOTAL'
    dom.resultTitle.textContent = 'Lenda da selva'
    dom.resultCopy.textContent = 'Você concluiu as 10 fases da Cobra Neon. A selva inteira agora conhece o seu nome.'
    dom.resultPrimary.textContent = 'Jogar novamente'
    dom.resultSecondary.textContent = 'Selecionar fase'
    say(`Vitória total. Todas as 10 fases concluídas. Pontuação ${game.score}.`)
  } else {
    dom.resultSymbol.textContent = pad2(game.levelIndex + 1)
    dom.resultKicker.textContent = `FASE ${pad2(game.levelIndex + 1)} CONCLUÍDA`
    dom.resultTitle.textContent = 'Setor dominado'
    dom.resultCopy.textContent = `Bônus de conclusão: +${game.bonus} pontos. A próxima fase já está liberada.`
    dom.resultPrimary.textContent = 'Próxima fase'
    dom.resultSecondary.textContent = 'Repetir fase'
    say(`Fase ${game.levelIndex + 1} concluída. ${game.score} pontos.`)
  }

  dom.resultScore.textContent = formatScore(game.score)
  dom.resultFruits.textContent = `${game.progress}/${game.goal}`
  dom.resultBest.textContent = formatScore(Math.max(profile.best, game.score))
  revealModal(dom.resultModal, '#result-primary')
  updateTitle()
}

function onEat(event) {
  const cell = event.fruit || game.head
  addBurst(cell, ['#ffd36b', '#ffefad', '#ff8b63'], 9, 70, 150)
  addFloatingText(cell, `+${event.points}`, event.combo > 1 ? game.level.accent2 : '#ffd36b')
  if (!event.cleared) {
    sfx('eat', event.combo)
    buzz(10)
  }
}

function onDie(event) {
  phase = 'dying'
  shake = REDUCED_MOTION ? 0 : 1
  addBurst(event.deathCell || game.head, ['#ff667e', '#ff9c77', '#ffe4a8'], REDUCED_MOTION ? 6 : 30, 100, 260)
  dom.boardShell.classList.add('is-hit')
  window.setTimeout(() => dom.boardShell.classList.remove('is-hit'), 520)
  pauseBtnState()
  sfx('die')
  buzz([30, 45, 65])
  say('Fim de jogo.')
  clearTimeout(overlayTimer)
  overlayTimer = window.setTimeout(() => showResult('dead'), 720)
}

function onClear() {
  phase = 'clearing'
  shake = REDUCED_MOTION ? 0 : 0.45
  addBurst(game.head, [game.level.accent, game.level.accent2, '#ffd36b', '#ffffff'], REDUCED_MOTION ? 8 : 42, 70, 280)
  dom.boardShell.classList.add('is-clear')
  window.setTimeout(() => dom.boardShell.classList.remove('is-clear'), 820)
  recordLevelClear()
  pauseBtnState()
  const kind = game.levelIndex === LEVELS.length - 1 ? 'victory' : 'clear'
  sfx(kind === 'victory' ? 'victory' : 'clear')
  buzz(kind === 'victory' ? [20, 40, 20, 40, 80] : [15, 30, 15])
  clearTimeout(overlayTimer)
  overlayTimer = window.setTimeout(() => showResult(kind), 880)
}

function pauseBtnState() {
  dom.pauseBtn.disabled = true
}

function handleEvents(event) {
  if (!event || event.type === 'idle') return
  if (event.ate) onEat(event)
  if (event.type === 'die') onDie(event)
  else if (event.cleared) onClear(event)
  updateHud()
}

function handleResultPrimary() {
  sfx('click')
  if (currentResultKind === 'dead') startLevel(game.levelIndex)
  else if (currentResultKind === 'victory') startLevel(0)
  else startLevel(game.levelIndex + 1)
}

function handleResultSecondary() {
  sfx('click')
  if (currentResultKind === 'dead' || currentResultKind === 'victory') openLevels()
  else startLevel(game.levelIndex)
}

function toggleSound() {
  profile.muted = !profile.muted
  persistProfile()
  syncSoundButton()
  if (!profile.muted) sfx('click')
}

function ensureAudio() {
  if (profile.muted) return null
  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return null
      audioCtx = new AudioContext()
      masterGain = audioCtx.createGain()
      masterGain.gain.value = 0.55
      masterGain.connect(audioCtx.destination)
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
    return audioCtx
  } catch {
    return null
  }
}

function tone(frequency, options = {}) {
  const {
    duration = 0.08,
    type = 'sine',
    volume = 0.05,
    delay = 0,
    slideTo = null
  } = options
  const context = ensureAudio()
  if (!context) return
  const start = context.currentTime + delay
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(Math.max(30, frequency), start)
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), start + duration)
  }
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(masterGain)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.03)
}

function sfx(name, detail = 1) {
  if (profile.muted) return
  switch (name) {
    case 'click':
      tone(560, { duration: 0.045, volume: 0.025, type: 'triangle', slideTo: 680 })
      break
    case 'start':
      tone(392, { duration: 0.08, volume: 0.035, type: 'triangle' })
      tone(523, { duration: 0.1, volume: 0.035, type: 'triangle', delay: 0.08 })
      tone(784, { duration: 0.14, volume: 0.03, type: 'sine', delay: 0.17 })
      break
    case 'eat': {
      const base = 520 + Math.min(detail, 6) * 58
      tone(base, { duration: 0.065, volume: 0.045, type: 'triangle', slideTo: base * 1.45 })
      tone(base * 2, { duration: 0.11, volume: 0.015, type: 'sine', delay: 0.025 })
      break
    }
    case 'die':
      tone(220, { duration: 0.32, volume: 0.05, type: 'sawtooth', slideTo: 54 })
      tone(150, { duration: 0.4, volume: 0.04, type: 'triangle', delay: 0.04, slideTo: 42 })
      break
    case 'clear':
      ;[523, 659, 784, 1046].forEach((frequency, index) => {
        tone(frequency, { duration: 0.16, volume: 0.035, type: 'triangle', delay: index * 0.085 })
      })
      break
    case 'victory':
      ;[523, 659, 784, 1046, 1318].forEach((frequency, index) => {
        tone(frequency, { duration: 0.22, volume: 0.038, type: 'triangle', delay: index * 0.1 })
      })
      tone(261, { duration: 0.55, volume: 0.03, type: 'sine', delay: 0.08 })
      break
    default:
      break
  }
}

function buzz(pattern) {
  if (profile.muted || REDUCED_MOTION) return
  if (typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      return
    }
  }
}

function scheduleFit() {
  if (fitFrame) return
  fitFrame = requestAnimationFrame(() => {
    fitFrame = 0
    fitBoard()
  })
}

function fitBoard() {
  if (!dom.stage || !game) return
  const rect = dom.stage.getBoundingClientRect()
  const availableWidth = Math.max(120, rect.width - 2)
  const availableHeight = Math.max(120, rect.height - 2)
  const ratio = game.level.cols / game.level.rows
  let width = Math.min(availableWidth, availableHeight * ratio)
  let height = width / ratio
  if (height > availableHeight) {
    height = availableHeight
    width = height * ratio
  }
  dom.boardShell.style.width = `${Math.max(120, Math.floor(width))}px`
  dom.boardShell.style.height = `${Math.max(120, Math.floor(height))}px`
  resizeCanvas()
}

function resizeCanvas() {
  if (!dom.canvas) return
  const rect = dom.boardShell.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  dom.canvas.width = Math.round(width * ratio)
  dom.canvas.height = Math.round(height * ratio)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  metrics = computeMetrics(width, height, game.level)
  bgCache = null
  bgKey = ''
  renderDirty = true
}

function computeMetrics(width, height, level) {
  const padding = Math.max(3, Math.min(width, height) * 0.012)
  const cell = Math.min(
    (width - padding * 2) / level.cols,
    (height - padding * 2) / level.rows
  )
  const boardWidth = cell * level.cols
  const boardHeight = cell * level.rows
  return {
    width,
    height,
    cell,
    boardWidth,
    boardHeight,
    ox: (width - boardWidth) / 2,
    oy: (height - boardHeight) / 2,
    cols: level.cols,
    rows: level.rows
  }
}

function rgba(hex, alpha) {
  const value = hex.replace('#', '')
  const expanded = value.length === 3
    ? value.split('').map(char => char + char).join('')
    : value
  const integer = Number.parseInt(expanded, 16)
  const red = (integer >> 16) & 255
  const green = (integer >> 8) & 255
  const blue = integer & 255
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function cellCenter(cell) {
  if (!metrics) return { x: 0, y: 0 }
  return {
    x: metrics.ox + (cell.x + 0.5) * metrics.cell,
    y: metrics.oy + (cell.y + 0.5) * metrics.cell
  }
}

function roundRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.quadraticCurveTo(x + width, y, x + width, y + r)
  context.lineTo(x + width, y + height - r)
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  context.lineTo(x + r, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

function addBurst(cell, colors, count, minSpeed, maxSpeed) {
  if (!metrics) return
  const center = cellCenter(cell)
  const amount = REDUCED_MOTION ? Math.min(6, count) : count
  for (let index = 0; index < amount; index += 1) {
    const angle = Math.random() * Math.PI * 2
    const speed = minSpeed + Math.random() * (maxSpeed - minSpeed)
    const life = 0.38 + Math.random() * 0.5
    particles.push({
      x: center.x,
      y: center.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 70,
      life,
      maxLife: life,
      size: Math.max(1.4, metrics.cell * (0.05 + Math.random() * 0.075)),
      color: colors[Math.floor(Math.random() * colors.length)]
    })
  }
  trimParticles()
}

function addFloatingText(cell, text, color) {
  if (!metrics) return
  const center = cellCenter(cell)
  particles.push({
    x: center.x,
    y: center.y - metrics.cell * 0.15,
    vx: (Math.random() - 0.5) * 22,
    vy: -52,
    gravity: -8,
    life: 0.9,
    maxLife: 0.9,
    size: Math.max(10, metrics.cell * 0.36),
    color,
    text
  })
  trimParticles()
}

function trimParticles() {
  if (particles.length > 160) particles.splice(0, particles.length - 160)
}

function updateParticles(delta) {
  const seconds = delta / 1000
  for (const particle of particles) {
    particle.life -= seconds
    particle.x += particle.vx * seconds
    particle.y += particle.vy * seconds
    particle.vy += particle.gravity * seconds
  }
  particles = particles.filter(particle => particle.life > 0)
}

function updateShake(delta) {
  if (shake <= 0) return
  shake = Math.max(0, shake - delta / 420)
}

function drawBackground(level) {
  const key = `${metrics.width}:${metrics.height}:${level.index}`
  if (bgKey !== key || !bgCache) {
    const base = ctx.createLinearGradient(0, 0, 0, metrics.height)
    base.addColorStop(0, '#071b24')
    base.addColorStop(0.55, '#05141c')
    base.addColorStop(1, '#030c11')

    const glowA = ctx.createRadialGradient(
      metrics.width * 0.12, metrics.height * 0.02, 0,
      metrics.width * 0.12, metrics.height * 0.02, Math.max(metrics.width, metrics.height) * 0.65
    )
    glowA.addColorStop(0, rgba(level.accent, 0.16))
    glowA.addColorStop(0.55, rgba(level.accent, 0.035))
    glowA.addColorStop(1, rgba(level.accent, 0))

    const glowB = ctx.createRadialGradient(
      metrics.width * 0.95, metrics.height * 0.98, 0,
      metrics.width * 0.95, metrics.height * 0.98, Math.max(metrics.width, metrics.height) * 0.7
    )
    glowB.addColorStop(0, rgba(level.accent2, 0.11))
    glowB.addColorStop(1, rgba(level.accent2, 0))

    bgCache = { base, glowA, glowB }
    bgKey = key
  }

  ctx.fillStyle = bgCache.base
  ctx.fillRect(0, 0, metrics.width, metrics.height)
  ctx.fillStyle = bgCache.glowA
  ctx.fillRect(0, 0, metrics.width, metrics.height)
  ctx.fillStyle = bgCache.glowB
  ctx.fillRect(0, 0, metrics.width, metrics.height)
}

function drawGrid(level) {
  const { ox, oy, cell, cols, rows } = metrics
  ctx.fillStyle = rgba(level.accent, 0.09)
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      ctx.fillRect(ox + (x + 0.5) * cell - 0.6, oy + (y + 0.5) * cell - 0.6, 1.2, 1.2)
    }
  }
}

function drawBorder(level, now) {
  const { ox, oy, boardWidth, boardHeight, cell } = metrics
  const inset = Math.max(1.5, cell * 0.055)
  ctx.save()
  if (level.wrap) {
    ctx.strokeStyle = rgba(level.accent2, 0.52)
    ctx.lineWidth = Math.max(1.5, cell * 0.055)
    ctx.setLineDash([cell * 0.42, cell * 0.27])
    ctx.lineDashOffset = -(now * 0.028) % (cell * 0.69)
    ctx.shadowColor = rgba(level.accent2, 0.75)
    ctx.shadowBlur = cell * 0.6
    roundRectPath(ctx, ox + inset, oy + inset, boardWidth - inset * 2, boardHeight - inset * 2, cell * 0.24)
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.setLineDash([])
    ctx.strokeStyle = rgba(level.accent2, 0.16)
    ctx.lineWidth = 1
    roundRectPath(ctx, ox + inset * 2.2, oy + inset * 2.2, boardWidth - inset * 4.4, boardHeight - inset * 4.4, cell * 0.18)
    ctx.stroke()
  } else {
    ctx.strokeStyle = 'rgba(218, 255, 242, 0.075)'
    ctx.lineWidth = 1
    roundRectPath(ctx, ox + inset, oy + inset, boardWidth - inset * 2, boardHeight - inset * 2, cell * 0.22)
    ctx.stroke()
  }
  ctx.restore()
}

function drawObstacles(level) {
  const { ox, oy, cell } = metrics
  if (!level.obstacles.length) return
  const inset = cell * 0.09
  const inner = cell * 0.27
  const radius = Math.max(2, cell * 0.16)
  ctx.save()
  for (const obstacle of level.obstacles) {
    const x = ox + obstacle.x * cell + inset
    const y = oy + obstacle.y * cell + inset
    const size = cell - inset * 2

    roundRectPath(ctx, x, y, size, size, radius)
    ctx.fillStyle = 'rgba(13, 42, 52, 0.98)'
    ctx.fill()
    ctx.strokeStyle = rgba(level.accent, 0.56)
    ctx.lineWidth = Math.max(1, cell * 0.05)
    ctx.stroke()

    roundRectPath(ctx, x + inner, y + inner, size - inner * 2, size - inner * 2, Math.max(1, radius * 0.45))
    ctx.fillStyle = rgba(level.accent, 0.13)
    ctx.fill()

    ctx.fillStyle = rgba(level.accent, 0.65)
    ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.22, Math.max(1, cell * 0.035))
    ctx.fillRect(x + size * 0.2, y + size * 0.2, Math.max(1, cell * 0.035), size * 0.22)
  }
  ctx.restore()
}

function drawFood(level, now) {
  if (!game.food) return
  const { cell } = metrics
  const center = cellCenter(game.food)
  const pulse = 0.5 + 0.5 * Math.sin(now / 250)
  const halo = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, cell * 0.95)
  halo.addColorStop(0, 'rgba(255, 214, 102, 0.32)')
  halo.addColorStop(0.5, 'rgba(255, 145, 96, 0.13)')
  halo.addColorStop(1, 'rgba(255, 120, 80, 0)')

  ctx.save()
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(center.x, center.y, cell * 0.95, 0, Math.PI * 2)
  ctx.fill()

  ctx.translate(center.x, center.y)
  ctx.rotate(Math.sin(now / 900) * 0.15)
  ctx.strokeStyle = 'rgba(255, 220, 128, 0.45)'
  ctx.lineWidth = Math.max(1, cell * 0.035)
  ctx.beginPath()
  ctx.arc(0, 0, cell * (0.37 + pulse * 0.045), 0, Math.PI * 2)
  ctx.stroke()

  const core = ctx.createRadialGradient(-cell * 0.08, -cell * 0.1, cell * 0.02, 0, 0, cell * 0.33)
  core.addColorStop(0, '#fffbe2')
  core.addColorStop(0.32, '#ffd56e')
  core.addColorStop(0.72, '#ff9a5e')
  core.addColorStop(1, '#ff5e76')
  ctx.shadowColor = 'rgba(255, 193, 92, 0.9)'
  ctx.shadowBlur = cell * (0.55 + pulse * 0.2)
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(0, 0, cell * (0.255 + pulse * 0.012), 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  ctx.arc(-cell * 0.075, -cell * 0.09, cell * 0.045, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = rgba(level.accent, 0.9)
  ctx.beginPath()
  ctx.ellipse(cell * 0.14, -cell * 0.25, cell * 0.12, cell * 0.055, -0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawHazards(level, now) {
  if (!game.hazards.length) return
  const path = level.hazardPath
  const { cell } = metrics
  game.hazards.forEach((hazard, hazardIndex) => {
    for (let offset = 3; offset >= 1; offset -= 1) {
      const trailCell = path[(hazard.index - offset + path.length) % path.length]
      const point = cellCenter(trailCell)
      ctx.fillStyle = `rgba(255, 102, 126, ${0.11 * (4 - offset)})`
      ctx.beginPath()
      ctx.arc(point.x, point.y, cell * (0.15 + (3 - offset) * 0.02), 0, Math.PI * 2)
      ctx.fill()
    }

    const point = cellCenter(path[hazard.index])
    const rotation = now / 420 + hazardIndex * 1.7
    ctx.save()
    ctx.translate(point.x, point.y)

    ctx.strokeStyle = 'rgba(255, 118, 130, 0.75)'
    ctx.lineWidth = Math.max(1.4, cell * 0.06)
    ctx.setLineDash([cell * 0.18, cell * 0.13])
    ctx.lineDashOffset = -rotation * 8
    ctx.shadowColor = 'rgba(255, 86, 110, 0.9)'
    ctx.shadowBlur = cell * 0.65
    ctx.beginPath()
    ctx.arc(0, 0, cell * 0.33, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0

    const core = ctx.createRadialGradient(-cell * 0.05, -cell * 0.05, 0, 0, 0, cell * 0.22)
    core.addColorStop(0, '#fff0cf')
    core.addColorStop(0.25, '#ffb36b')
    core.addColorStop(0.68, '#ff5f72')
    core.addColorStop(1, '#ad1d43')
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(0, 0, cell * 0.22, 0, Math.PI * 2)
    ctx.fill()

    ctx.rotate(-rotation)
    ctx.strokeStyle = 'rgba(255, 238, 220, 0.72)'
    ctx.lineWidth = Math.max(1, cell * 0.032)
    ctx.beginPath()
    ctx.moveTo(-cell * 0.07, 0)
    ctx.lineTo(cell * 0.07, 0)
    ctx.stroke()
    ctx.restore()
  })
}

function snakePositions(alpha) {
  const current = game.snake
  const previous = game.prevSnake
  return current.map((cell, index) => {
    let before = previous[index] || previous[previous.length - 1] || cell
    if (Math.abs(before.x - cell.x) > 1 || Math.abs(before.y - cell.y) > 1) {
      before = cell
    }
    const gridX = before.x + (cell.x - before.x) * alpha
    const gridY = before.y + (cell.y - before.y) * alpha
    return {
      x: metrics.ox + (gridX + 0.5) * metrics.cell,
      y: metrics.oy + (gridY + 0.5) * metrics.cell,
      cell,
      before
    }
  })
}

function drawSnake(level, now, alpha) {
  const { cell } = metrics
  const points = snakePositions(alpha)
  const chunks = []
  let chunk = [points[0]]
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const point = points[index]
    const jump = Math.abs(game.snake[index].x - game.snake[index - 1].x) > 1 ||
      Math.abs(game.snake[index].y - game.snake[index - 1].y) > 1
    if (jump || Math.hypot(point.x - previous.x, point.y - previous.y) > cell * 1.65) {
      chunks.push(chunk)
      chunk = [point]
    } else {
      chunk.push(point)
    }
  }
  chunks.push(chunk)

  const strokeChunk = (width, color, blur) => {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = width
    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = blur
    for (const part of chunks) {
      if (part.length === 1) {
        ctx.beginPath()
        ctx.arc(part[0].x, part[0].y, width / 2, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        continue
      }
      ctx.beginPath()
      ctx.moveTo(part[0].x, part[0].y)
      for (let index = 1; index < part.length; index += 1) {
        ctx.lineTo(part[index].x, part[index].y)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  strokeChunk(cell * 0.9, rgba(level.accent, 0.16), cell * 0.8)
  strokeChunk(cell * 0.6, rgba(level.accent, 0.32), cell * 0.35)

  ctx.save()
  const tail = points[points.length - 1]
  const head = points[0]
  const bodyGradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y)
  bodyGradient.addColorStop(0, rgba(level.accent, 0.44))
  bodyGradient.addColorStop(0.45, level.accent)
  bodyGradient.addColorStop(0.78, level.accent2)
  bodyGradient.addColorStop(1, '#dffff3')
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = cell * 0.58
  ctx.strokeStyle = bodyGradient
  ctx.shadowColor = rgba(level.accent, 0.9)
  ctx.shadowBlur = cell * 0.42
  for (const part of chunks) {
    if (part.length === 1) {
      ctx.beginPath()
      ctx.arc(part[0].x, part[0].y, cell * 0.29, 0, Math.PI * 2)
      ctx.fillStyle = bodyGradient
      ctx.fill()
      continue
    }
    ctx.beginPath()
    ctx.moveTo(part[0].x, part[0].y)
    for (let index = 1; index < part.length; index += 1) {
      ctx.lineTo(part[index].x, part[index].y)
    }
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
  for (let index = 1; index < points.length; index += 1) {
    if (index % 2 !== 0) continue
    ctx.beginPath()
    ctx.arc(points[index].x, points[index].y, Math.max(0.8, cell * 0.045), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  drawHead(level, now, head, cell)
}

function drawHead(level, now, head, cell) {
  const radius = cell * 0.405
  const gradient = ctx.createRadialGradient(
    head.x - cell * 0.12,
    head.y - cell * 0.13,
    cell * 0.02,
    head.x,
    head.y,
    radius
  )
  gradient.addColorStop(0, '#f4fff9')
  gradient.addColorStop(0.28, level.accent)
  gradient.addColorStop(0.82, level.accent2)
  gradient.addColorStop(1, 'rgba(8, 58, 64, 0.98)')

  ctx.save()
  ctx.shadowColor = rgba(level.accent, 0.95)
  ctx.shadowBlur = cell * 0.62
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(head.x, head.y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  const direction = DIRECTIONS[game.direction]
  const forward = { x: direction.x, y: direction.y }
  const side = { x: -direction.y, y: direction.x }
  const eyeOffsetForward = cell * 0.12
  const eyeOffsetSide = cell * 0.165
  const eyeRadius = cell * 0.105

  for (const sign of [-1, 1]) {
    const eyeX = head.x + forward.x * eyeOffsetForward + side.x * eyeOffsetSide * sign
    const eyeY = head.y + forward.y * eyeOffsetForward + side.y * eyeOffsetSide * sign
    ctx.fillStyle = '#f3fff9'
    ctx.beginPath()
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2)
    ctx.fill()

    if (game.status === 'dead') {
      ctx.strokeStyle = '#b7243e'
      ctx.lineWidth = Math.max(1, cell * 0.04)
      const arm = eyeRadius * 0.62
      ctx.beginPath()
      ctx.moveTo(eyeX - arm, eyeY - arm)
      ctx.lineTo(eyeX + arm, eyeY + arm)
      ctx.moveTo(eyeX + arm, eyeY - arm)
      ctx.lineTo(eyeX - arm, eyeY + arm)
      ctx.stroke()
    } else {
      ctx.fillStyle = '#08222a'
      ctx.beginPath()
      ctx.arc(
        eyeX + forward.x * cell * 0.028,
        eyeY + forward.y * cell * 0.028,
        cell * 0.052,
        0,
        Math.PI * 2
      )
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.beginPath()
      ctx.arc(eyeX + cell * 0.018, eyeY - cell * 0.018, cell * 0.016, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const tongueCycle = (now % 1900) / 1900
  if (game.status === 'playing' && tongueCycle < 0.14) {
    const progress = tongueCycle / 0.14
    const tongueLength = cell * (0.34 + progress * 0.14)
    const startX = head.x + forward.x * radius * 0.85
    const startY = head.y + forward.y * radius * 0.85
    const tipX = startX + forward.x * tongueLength
    const tipY = startY + forward.y * tongueLength
    ctx.strokeStyle = '#ff6c96'
    ctx.lineWidth = Math.max(1, cell * 0.038)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(tipX, tipY)
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX + forward.x * cell * 0.07 + side.x * cell * 0.07, tipY + forward.y * cell * 0.07 + side.y * cell * 0.07)
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX + forward.x * cell * 0.07 - side.x * cell * 0.07, tipY + forward.y * cell * 0.07 - side.y * cell * 0.07)
    ctx.stroke()
  }

  ctx.restore()
}

function drawParticles() {
  ctx.save()
  for (const particle of particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife)
    ctx.globalAlpha = alpha
    if (particle.text) {
      ctx.fillStyle = particle.color
      ctx.font = `800 ${particle.size}px ${getCanvasFont()}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(particle.text, particle.x, particle.y)
    } else {
      ctx.fillStyle = particle.color
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function getCanvasFont() {
  return '"SF Mono", "Cascadia Code", "Roboto Mono", ui-monospace, monospace'
}

function draw(now, alpha) {
  if (!game) return
  if (!metrics) metrics = computeMetrics(dom.canvas.clientWidth, dom.canvas.clientHeight, game.level)
  drawBackground(game.level)

  ctx.save()
  if (shake > 0 && !REDUCED_MOTION) {
    const magnitude = metrics.cell * 0.55 * shake * shake
    ctx.translate((Math.random() - 0.5) * magnitude * 2, (Math.random() - 0.5) * magnitude * 2)
  }
  drawGrid(game.level)
  drawBorder(game.level, now)
  drawObstacles(game.level)
  drawFood(game.level, now)
  drawHazards(game.level, now)
  drawSnake(game.level, now, alpha)
  drawParticles()
  ctx.restore()
}

function currentAlpha() {
  if (!game || awaitingStart) return 1
  if (phase === 'playing' || phase === 'paused') {
    return clamp(acc / game.tick, 0, 1)
  }
  return 1
}

function beginMovement() {
  if (!awaitingStart) return
  awaitingStart = false
  acc = game.tick
  dom.levelToast.classList.remove('is-visible')
  clearTimeout(toastTimer)
}

function loop(now) {
  const delta = Math.min(64, Math.max(0, now - lastFrame))
  lastFrame = now

  if (phase === 'playing' && game) {
    if (awaitingStart) {
      acc = 0
      if (now >= startDeadline) beginMovement()
    }
    if (!awaitingStart) {
      acc += delta
      let steps = 0
      while (acc >= game.tick && phase === 'playing' && steps < 6) {
        acc -= game.tick
        const events = game.step()
        handleEvents(events)
        steps += 1
        if (phase !== 'playing') {
          acc = 0
          break
        }
      }
    }
  } else if (phase === 'title' || phase === 'select' || phase === 'result') {
    acc = 0
  }

  updateParticles(delta)
  updateShake(delta)
  const animated = phase === 'playing' || phase === 'dying' || phase === 'clearing'
  if (animated || renderDirty) {
    draw(now, currentAlpha())
    renderDirty = false
  }
  requestAnimationFrame(loop)
}

function queueDirection(direction) {
  if (phase !== 'playing' || !game) return false
  if (awaitingStart && direction === 'left') {
    const head = game.snake[0]
    game.snake = [
      { x: head.x, y: head.y },
      { x: head.x + 1, y: head.y },
      { x: head.x + 2, y: head.y },
      { x: head.x + 3, y: head.y }
    ]
    game.prevSnake = game.snake.map(cell => ({ ...cell }))
    if (game.food && game.snake.some(cell => cell.x === game.food.x && cell.y === game.food.y)) {
      game.food = game.spawnFood()
    }
    game.direction = 'left'
    beginMovement()
    return true
  }
  const queued = game.queueDirection(direction)
  if (queued && awaitingStart) beginMovement()
  return queued
}

const keyDirections = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right'
}

function handleKeyDown(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const direction = keyDirections[key]
  if (direction) {
    if (phase === 'playing') {
      event.preventDefault()
      queueDirection(direction)
    }
    return
  }

  if (key === ' ' || key === 'p') {
    if (phase === 'playing' || phase === 'paused') {
      event.preventDefault()
      if (phase === 'playing') pauseGame()
      else resumeGame()
    }
    return
  }

  if (key === 'r') {
    if (phase === 'playing' || phase === 'paused') {
      event.preventDefault()
      startLevel(levelIndex)
    }
    return
  }

  if (key === 'm') {
    event.preventDefault()
    toggleSound()
    return
  }

  if (key === 'Escape') {
    event.preventDefault()
    if (phase === 'paused') resumeGame()
    else if (phase === 'select' || phase === 'result') showTitle()
    else if (phase === 'playing') pauseGame()
  }
}

function onPointerDown(event) {
  ensureAudio()
  if (phase !== 'playing') return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  swipe = { x: event.clientX, y: event.clientY, id: event.pointerId }
  try {
    dom.boardShell.setPointerCapture(event.pointerId)
  } catch {
    return
  }
}

function onPointerMove(event) {
  if (!swipe || swipe.id !== event.pointerId || phase !== 'playing') return
  const deltaX = event.clientX - swipe.x
  const deltaY = event.clientY - swipe.y
  const threshold = 18
  if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) return
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    queueDirection(deltaX > 0 ? 'right' : 'left')
  } else {
    queueDirection(deltaY > 0 ? 'down' : 'up')
  }
  swipe = { x: event.clientX, y: event.clientY, id: event.pointerId }
}

function onPointerUp(event) {
  if (!swipe || swipe.id !== event.pointerId) return
  swipe = null
}

function setupInputs() {
  window.addEventListener('keydown', handleKeyDown)
  dom.boardShell.addEventListener('pointerdown', event => {
    event.preventDefault()
    onPointerDown(event)
  })
  dom.boardShell.addEventListener('pointermove', event => {
    if (swipe) event.preventDefault()
    onPointerMove(event)
  })
  dom.boardShell.addEventListener('pointerup', onPointerUp)
  dom.boardShell.addEventListener('pointercancel', onPointerUp)
  dom.boardShell.addEventListener('contextmenu', event => event.preventDefault())

  dom.dpad.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-dir]')
    if (!button) return
    event.preventDefault()
    ensureAudio()
    if (queueDirection(button.dataset.dir)) {
      button.classList.add('is-pressed')
      window.setTimeout(() => button.classList.remove('is-pressed'), 110)
    }
  })

  dom.startBtn.addEventListener('click', () => {
    sfx('click')
    startLevel(profile.unlocked - 1)
  })
  dom.levelsBtn.addEventListener('click', () => {
    sfx('click')
    openLevels()
  })
  dom.levelsClose.addEventListener('click', () => {
    sfx('click')
    showTitle()
  })
  dom.levelGrid.addEventListener('click', event => {
    const button = event.target.closest('button[data-level]')
    if (!button || button.disabled) return
    sfx('click')
    startLevel(Number(button.dataset.level))
  })
  dom.pauseBtn.addEventListener('click', () => {
    if (phase === 'playing') pauseGame()
    else if (phase === 'paused') resumeGame()
  })
  dom.soundBtn.addEventListener('click', toggleSound)
  dom.resumeBtn.addEventListener('click', resumeGame)
  dom.restartBtn.addEventListener('click', () => {
    sfx('click')
    startLevel(levelIndex)
  })
  dom.quitBtn.addEventListener('click', () => {
    sfx('click')
    showTitle()
  })
  dom.resultPrimary.addEventListener('click', handleResultPrimary)
  dom.resultSecondary.addEventListener('click', handleResultSecondary)
  dom.resultMenu.addEventListener('click', () => {
    sfx('click')
    showTitle()
  })

  window.addEventListener('pointerdown', () => ensureAudio(), { once: true, capture: true })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && phase === 'playing') pauseGame()
  })
  window.addEventListener('resize', scheduleFit)
  window.addEventListener('orientationchange', () => window.setTimeout(scheduleFit, 120))
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleFit)
    observer.observe(dom.stage)
  }
}

function setupDebug() {
  if (!new URLSearchParams(window.location.search).has('debug')) return
  window.__cobra = {
    get game() { return game },
    get phase() { return phase },
    startLevel,
    openLevels,
    showTitle,
    forceClear() {
      if (!game) return
      game.progress = game.goal
      game.status = 'cleared'
      game.bonus = 100 * (game.levelIndex + 1)
      game.score += game.bonus
      onClear()
    },
    forceDeath() {
      if (!game) return
      game.fail('wall')
      onDie({ deathCell: game.head, reason: 'wall' })
    }
  }
}

function boot() {
  syncSoundButton()
  setupInputs()
  setupDebug()
  showTitle()
  document.fonts?.ready.then(scheduleFit).catch(() => {})
  requestAnimationFrame(loop)
}

boot()
