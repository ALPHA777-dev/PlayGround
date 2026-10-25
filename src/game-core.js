export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1, name: 'up' }),
  right: Object.freeze({ x: 1, y: 0, name: 'right' }),
  down: Object.freeze({ x: 0, y: 1, name: 'down' }),
  left: Object.freeze({ x: -1, y: 0, name: 'left' })
})

export const OPPOSITE = Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' })

export const LEVELS = Object.freeze([
  {
    name: 'Primeiro Bote',
    note: 'Aprenda o ritmo da selva',
    cols: 13,
    rows: 16,
    tick: 185,
    goal: 5,
    layout: 'none',
    hazards: 0,
    hazardPeriod: 3,
    wrap: false,
    accent: '#46f5a4',
    accent2: '#12d9ff'
  },
  {
    name: 'Jardim Neon',
    note: 'Blocos nos quatro cantos',
    cols: 14,
    rows: 18,
    tick: 168,
    goal: 6,
    layout: 'corners',
    hazards: 0,
    hazardPeriod: 3,
    wrap: false,
    accent: '#42e8ff',
    accent2: '#59ffc8'
  },
  {
    name: 'Circuito',
    note: 'Passe pelos portões centrais',
    cols: 15,
    rows: 19,
    tick: 152,
    goal: 7,
    layout: 'gates',
    hazards: 0,
    hazardPeriod: 3,
    wrap: false,
    accent: '#9d8bff',
    accent2: '#52e5ff'
  },
  {
    name: 'Labirinto',
    note: 'Encontre o caminho entre as paredes',
    cols: 16,
    rows: 20,
    tick: 140,
    goal: 8,
    layout: 'maze',
    hazards: 0,
    hazardPeriod: 3,
    wrap: false,
    accent: '#ffd166',
    accent2: '#ff8a5c'
  },
  {
    name: 'Pulso',
    note: 'Pilares, curvas e velocidade',
    cols: 16,
    rows: 20,
    tick: 128,
    goal: 8,
    layout: 'pillars',
    hazards: 0,
    hazardPeriod: 3,
    wrap: false,
    accent: '#ff6eb4',
    accent2: '#9d8bff'
  },
  {
    name: 'Horizonte',
    note: 'As bordas viraram portais',
    cols: 17,
    rows: 21,
    tick: 118,
    goal: 9,
    layout: 'orbits',
    hazards: 0,
    hazardPeriod: 3,
    wrap: true,
    accent: '#62d4ff',
    accent2: '#46f5a4'
  },
  {
    name: 'Sentinela',
    note: 'Um drone patrulha a borda',
    cols: 17,
    rows: 21,
    tick: 110,
    goal: 9,
    layout: 'sentinels',
    hazards: 1,
    hazardPeriod: 3,
    wrap: false,
    accent: '#ff826b',
    accent2: '#ffd166'
  },
  {
    name: 'Corredor',
    note: 'Dois drones. Nenhuma folga.',
    cols: 18,
    rows: 22,
    tick: 102,
    goal: 10,
    layout: 'corridors',
    hazards: 2,
    hazardPeriod: 3,
    wrap: false,
    accent: '#c9ff5e',
    accent2: '#46f5a4'
  },
  {
    name: 'Vórtice',
    note: 'Portais e drones ao mesmo tempo',
    cols: 18,
    rows: 22,
    tick: 96,
    goal: 10,
    layout: 'vortex',
    hazards: 2,
    hazardPeriod: 3,
    wrap: true,
    accent: '#ff61d8',
    accent2: '#9d8bff'
  },
  {
    name: 'Singularidade',
    note: 'A prova final da cobra neon',
    cols: 19,
    rows: 23,
    tick: 88,
    goal: 12,
    layout: 'final',
    hazards: 3,
    hazardPeriod: 2,
    wrap: false,
    accent: '#ffd36b',
    accent2: '#ff5e8a'
  }
])

export const COMBO_WINDOW_MS = 3500

const keyOf = (x, y) => `${x},${y}`

function buildLayout(name, cols, rows) {
  const rects = []
  const add = (x, y, w = 1, h = 1) => {
    if (w <= 0 || h <= 0) return
    rects.push({ x: Math.max(0, x), y: Math.max(0, y), w, h })
  }
  const mid = Math.floor(rows / 2)
  const center = Math.floor(cols / 2)

  switch (name) {
    case 'corners':
      add(2, 3, 2, 2)
      add(cols - 4, 3, 2, 2)
      add(2, rows - 5, 2, 2)
      add(cols - 4, rows - 5, 2, 2)
      break
    case 'gates': {
      const x1 = Math.floor(cols * 0.3)
      const x2 = Math.floor(cols * 0.7)
      add(x1, 3, 1, mid - 4)
      add(x1, mid + 2, 1, rows - mid - 5)
      add(x2, 3, 1, mid - 4)
      add(x2, mid + 2, 1, rows - mid - 5)
      break
    }
    case 'maze': {
      const y1 = Math.floor(rows * 0.25)
      const y2 = Math.floor(rows * 0.72)
      add(3, y1, cols - 7, 1)
      add(3, y2, cols - 7, 1)
      add(center - 6, Math.floor(rows * 0.38), 1, Math.floor(rows * 0.16))
      add(center + 5, Math.floor(rows * 0.5), 1, Math.floor(rows * 0.16))
      break
    }
    case 'pillars': {
      const spots = [
        [3, 3],
        [cols - 5, 3],
        [3, rows - 5],
        [cols - 5, rows - 5],
        [center - 5, 4],
        [center + 3, rows - 6]
      ]
      for (const [x, y] of spots) add(x, y, 2, 2)
      add(center - 2, 3, 1, 1)
      add(center + 1, rows - 4, 1, 1)
      break
    }
    case 'orbits':
      add(3, 3, 2, 2)
      add(cols - 5, 3, 2, 2)
      add(3, rows - 5, 2, 2)
      add(cols - 5, rows - 5, 2, 2)
      add(center - 1, 3, 2, 1)
      add(center - 1, rows - 4, 2, 1)
      add(3, mid - 1, 1, 2)
      add(cols - 4, mid - 1, 1, 2)
      break
    case 'sentinels': {
      const x1 = Math.floor(cols * 0.28)
      const x2 = Math.floor(cols * 0.72)
      const gap1 = Math.floor(rows * 0.34)
      const gap2 = Math.floor(rows * 0.66)
      add(x1, 3, 1, gap1 - 4)
      add(x1, gap1 + 2, 1, rows - gap1 - 5)
      add(x2, 3, 1, gap2 - 4)
      add(x2, gap2 + 2, 1, rows - gap2 - 5)
      add(center - 3, 3, 1, 2)
      add(center + 2, rows - 5, 1, 2)
      break
    }
    case 'corridors': {
      add(2, Math.floor(rows * 0.22), cols - 5, 1)
      add(3, Math.floor(rows * 0.5), cols - 7, 1)
      add(2, Math.floor(rows * 0.78), cols - 5, 1)
      add(4, Math.floor(rows * 0.3), 1, Math.floor(rows * 0.12))
      add(cols - 5, Math.floor(rows * 0.6), 1, Math.floor(rows * 0.12))
      break
    }
    case 'vortex': {
      add(3, 3, 2, 2)
      add(cols - 5, 3, 2, 2)
      add(3, rows - 5, 2, 2)
      add(cols - 5, rows - 5, 2, 2)
      add(center - 6, Math.floor(rows * 0.28), 2, 2)
      add(center + 4, Math.floor(rows * 0.28), 2, 2)
      add(center - 6, Math.floor(rows * 0.7), 2, 2)
      add(center + 4, Math.floor(rows * 0.7), 2, 2)
      break
    }
    case 'final': {
      const x1 = Math.floor(cols * 0.3)
      const x2 = Math.floor(cols * 0.7)
      const gap1 = Math.floor(rows * 0.36)
      const gap2 = Math.floor(rows * 0.64)
      add(x1, 3, 1, gap1 - 5)
      add(x1, gap1 + 2, 1, rows - gap1 - 6)
      add(x2, 3, 1, gap2 - 5)
      add(x2, gap2 + 2, 1, rows - gap2 - 6)
      add(2, Math.floor(rows * 0.24), Math.floor(cols * 0.28), 1)
      add(Math.floor(cols * 0.52), Math.floor(rows * 0.24), Math.floor(cols * 0.46) - 2, 1)
      add(2, Math.floor(rows * 0.76), Math.floor(cols * 0.28), 1)
      add(Math.floor(cols * 0.52), Math.floor(rows * 0.76), Math.floor(cols * 0.46) - 2, 1)
      break
    }
    default:
      break
  }

  return rects
}

export function buildHazardPath(cols, rows) {
  const path = []
  const seen = new Set()
  const push = (x, y) => {
    if (x < 1 || y < 1 || x > cols - 2 || y > rows - 2) return
    const key = keyOf(x, y)
    if (seen.has(key)) return
    seen.add(key)
    path.push({ x, y })
  }
  for (let x = 1; x <= cols - 2; x += 1) push(x, 1)
  for (let y = 2; y <= rows - 2; y += 1) push(cols - 2, y)
  for (let x = cols - 3; x >= 1; x -= 1) push(x, rows - 2)
  for (let y = rows - 3; y >= 2; y -= 1) push(1, y)
  return path
}

export function startCells(cols, rows) {
  const head = { x: Math.floor(cols / 2), y: Math.floor(rows / 2) }
  const cells = [head]
  for (let i = 1; i < 4; i += 1) cells.push({ x: head.x - i, y: head.y })
  return cells
}

export function buildLevel(index, options = {}) {
  const definition = LEVELS[index]
  if (!definition) throw new RangeError(`Unknown level index: ${index}`)
  const { cols, rows } = definition
  const body = options.body ?? startCells(cols, rows)
  const head = body[0]
  const obstacleSet = new Set()

  for (const rect of buildLayout(definition.layout, cols, rows)) {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue
        const nearHead = Math.abs(x - head.x) <= 3 && Math.abs(y - head.y) <= 1
        const onBody = body.some(cell => cell.x === x && cell.y === y)
        if (nearHead || onBody) continue
        obstacleSet.add(keyOf(x, y))
      }
    }
  }

  const obstacles = [...obstacleSet].map(key => {
    const [x, y] = key.split(',').map(Number)
    return { x, y }
  })
  obstacles.sort((a, b) => a.y - b.y || a.x - b.x)

  const hazardPath = definition.hazards > 0 ? buildHazardPath(cols, rows) : []
  const fractions = [0.125, 0.375, 0.625, 0.875]
  const hazardStartIndexes = Array.from({ length: definition.hazards }, (_, i) => {
    const fraction = fractions[i % fractions.length]
    return Math.floor(hazardPath.length * fraction) % hazardPath.length
  })

  return Object.freeze({
    ...definition,
    index,
    obstacles: Object.freeze(obstacles),
    obstacleSet,
    hazardPath: Object.freeze(hazardPath.map(cell => Object.freeze({ ...cell }))),
    hazardStartIndexes: Object.freeze(hazardStartIndexes)
  })
}

function cloneCells(cells) {
  return cells.map(cell => ({ x: cell.x, y: cell.y }))
}

function randomSeed(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class SnakeGame {
  constructor(levelIndex, options = {}) {
    this.levelIndex = levelIndex
    this.level = buildLevel(levelIndex, options)
    this.rng = options.rng ?? randomSeed((Date.now() ^ (levelIndex * 7919)) >>> 0)
    this.reset()
  }

  reset() {
    const { cols, rows } = this.level
    const body = startCells(cols, rows)
    this.snake = body
    this.prevSnake = cloneCells(body)
    this.direction = 'right'
    this.directionQueue = []
    this.score = 0
    this.progress = 0
    this.combo = 0
    this.comboTicks = 0
    this.totalTicks = 0
    this.status = 'playing'
    this.deathReason = null
    this.deathCell = null
    this.bonus = 0
    this.hazards = this.level.hazardStartIndexes.map(index => ({
      index,
      prevIndex: index
    }))
    this.food = this.spawnFood()
    return this
  }

  get head() {
    return this.snake[0]
  }

  get tick() {
    return this.level.tick
  }

  get goal() {
    return this.level.goal
  }

  get isWrapping() {
    return this.level.wrap
  }

  get hazardCells() {
    return this.hazards.map(hazard => this.level.hazardPath[hazard.index])
  }

  occupancy(options = {}) {
    const { includeBody = true, includeHazards = true, includeFood = true } = options
    const occupied = new Set()
    if (includeBody) {
      for (const cell of this.snake) occupied.add(keyOf(cell.x, cell.y))
    }
    if (includeHazards) {
      for (const cell of this.hazardCells) occupied.add(keyOf(cell.x, cell.y))
    }
    if (includeFood && this.food) occupied.add(keyOf(this.food.x, this.food.y))
    return occupied
  }

  reachableCells(ignoreSnake = true) {
    const { cols, rows, obstacleSet, wrap } = this.level
    const head = this.snake[0]
    const seen = new Set([keyOf(head.x, head.y)])
    const queue = [{ ...head }]
    const occupied = this.occupancy({ includeBody: !ignoreSnake, includeHazards: false, includeFood: false })
    const directions = Object.values(DIRECTIONS)
    while (queue.length) {
      const cell = queue.shift()
      for (const direction of directions) {
        let x = cell.x + direction.x
        let y = cell.y + direction.y
        if (wrap) {
          x = (x + cols) % cols
          y = (y + rows) % rows
        } else if (x < 0 || y < 0 || x >= cols || y >= rows) {
          continue
        }
        const key = keyOf(x, y)
        if (seen.has(key) || obstacleSet.has(key)) continue
        if (ignoreSnake === false && occupied.has(key)) continue
        seen.add(key)
        queue.push({ x, y })
      }
    }
    return seen
  }

  spawnFood() {
    const { cols, rows } = this.level
    const reachable = this.reachableCells(true)
    const occupied = this.occupancy({ includeBody: true, includeHazards: true, includeFood: false })
    const candidates = []
    const fallback = []
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const key = keyOf(x, y)
        if (occupied.has(key)) continue
        if (reachable.has(key)) candidates.push({ x, y })
        else fallback.push({ x, y })
      }
    }
    const pool = candidates.length ? candidates : fallback
    if (!pool.length) return null
    return pool[Math.floor(this.rng() * pool.length)]
  }

  queueDirection(name) {
    if (this.status !== 'playing') return false
    if (!DIRECTIONS[name]) return false
    if (this.directionQueue.length >= 2) return false
    const reference = this.directionQueue.length
      ? this.directionQueue[this.directionQueue.length - 1]
      : this.direction
    if (name === reference || OPPOSITE[reference] === name) return false
    this.directionQueue.push(name)
    return true
  }

  fail(reason, cell = this.snake[0]) {
    this.status = 'dead'
    this.deathReason = reason
    this.deathCell = { x: cell.x, y: cell.y }
    this.prevSnake = cloneCells(this.snake)
    this.combo = 0
    this.comboTicks = 0
    return { type: 'die', reason, deathCell: this.deathCell, points: 0, ate: false, cleared: false }
  }

  moveHazards() {
    const length = this.level.hazardPath.length
    if (!length) return false
    for (const hazard of this.hazards) {
      hazard.prevIndex = hazard.index
      hazard.index = (hazard.index + 1) % length
    }
    return true
  }

  step() {
    if (this.status !== 'playing') return { type: 'idle', ate: false, died: false, cleared: false }
    this.totalTicks += 1

    if (this.comboTicks > 0) {
      this.comboTicks -= 1
      if (this.comboTicks === 0) this.combo = 0
    }

    if (this.directionQueue.length) this.direction = this.directionQueue.shift()

    const delta = DIRECTIONS[this.direction]
    const currentHead = this.snake[0]
    let nx = currentHead.x + delta.x
    let ny = currentHead.y + delta.y
    const { cols, rows } = this.level

    if (this.level.wrap) {
      nx = (nx + cols) % cols
      ny = (ny + rows) % rows
    } else if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
      return this.fail('wall', currentHead)
    }

    const nextHead = { x: nx, y: ny }
    const willEat = Boolean(this.food && this.food.x === nx && this.food.y === ny)
    const bodyToCheck = willEat ? this.snake : this.snake.slice(0, -1)

    if (bodyToCheck.some(cell => cell.x === nx && cell.y === ny)) {
      return this.fail('self', nextHead)
    }
    if (this.level.obstacleSet.has(keyOf(nx, ny))) {
      return this.fail('obstacle', nextHead)
    }
    if (this.hazards.some(hazard => {
      const cell = this.level.hazardPath[hazard.index]
      return cell.x === nx && cell.y === ny
    })) {
      return this.fail('drone', nextHead)
    }

    this.prevSnake = cloneCells(this.snake)
    this.snake.unshift(nextHead)
    if (!willEat) this.snake.pop()

    const events = {
      type: 'move',
      ate: false,
      died: false,
      cleared: false,
      points: 0,
      combo: this.combo,
      bonus: 0,
      head: { x: nx, y: ny }
    }

    if (willEat) {
      const base = 10 + this.levelIndex * 2
      this.combo = this.comboTicks > 0 ? this.combo + 1 : 1
      const gain = base * this.combo
      this.score += gain
      this.progress += 1
      this.comboTicks = Math.max(8, Math.round(COMBO_WINDOW_MS / this.level.tick))
      this.food = null
      events.ate = true
      events.points = gain
      events.combo = this.combo
      events.fruit = { x: nx, y: ny }

      if (this.progress >= this.level.goal) {
        this.status = 'cleared'
        this.bonus = 100 * (this.levelIndex + 1)
        this.score += this.bonus
        events.cleared = true
        events.bonus = this.bonus
        return events
      }
    }

    if (this.level.hazards > 0 && this.totalTicks % this.level.hazardPeriod === 0) {
      this.moveHazards()
      const hit = this.hazards.some(hazard => {
        const cell = this.level.hazardPath[hazard.index]
        return cell.x === this.snake[0].x && cell.y === this.snake[0].y
      })
      if (hit) {
        const death = this.fail('drone', this.snake[0])
        return { ...death, ate: events.ate, points: events.points }
      }
    }

    if (events.ate) this.food = this.spawnFood()
    return events
  }
}
