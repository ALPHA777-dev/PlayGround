import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DIRECTIONS,
  LEVELS,
  SnakeGame,
  buildHazardPath,
  buildLevel,
  startCells
} from '../src/game-core.js'

const key = (x, y) => `${x},${y}`

function place(game, body, direction, food = null) {
  game.snake = body.map(cell => ({ ...cell }))
  game.prevSnake = body.map(cell => ({ ...cell }))
  game.direction = direction
  game.directionQueue = []
  game.food = food
  game.combo = 0
  game.comboTicks = 0
  return game
}

test('there are ten levels with a smooth difficulty curve', () => {
  assert.equal(LEVELS.length, 10)
  for (let index = 0; index < LEVELS.length; index += 1) {
    const level = LEVELS[index]
    assert.ok(level.cols >= 13)
    assert.ok(level.rows >= 16)
    assert.ok(level.goal >= 5)
    assert.ok(level.tick >= 80)
    if (index > 0) {
      assert.ok(level.tick <= LEVELS[index - 1].tick, 'speed must not decrease')
      assert.ok(level.goal >= LEVELS[index - 1].goal, 'fruit goal must not decrease')
    }
  }
})

test('level layouts keep the spawn corridor clear and stay in bounds', () => {
  for (let index = 0; index < LEVELS.length; index += 1) {
    const level = buildLevel(index)
    const body = startCells(level.cols, level.rows)
    for (const cell of level.obstacles) {
      assert.ok(cell.x >= 0 && cell.x < level.cols)
      assert.ok(cell.y >= 0 && cell.y < level.rows)
      assert.ok(!body.some(start => start.x === cell.x && start.y === cell.y))
    }
  }
})

test('hazard patrol paths are unique and run inside the playfield', () => {
  for (const level of LEVELS.filter(item => item.hazards > 0)) {
    const path = buildHazardPath(level.cols, level.rows)
    const seen = new Set(path.map(cell => key(cell.x, cell.y)))
    assert.equal(seen.size, path.length)
    assert.ok(path.length > 20)
    for (const cell of path) {
      assert.ok(cell.x >= 1 && cell.x <= level.cols - 2)
      assert.ok(cell.y >= 1 && cell.y <= level.rows - 2)
    }
  }
})

test('new games spawn a free, reachable fruit without touching obstacles', () => {
  for (let index = 0; index < LEVELS.length; index += 1) {
    for (let seed = 1; seed <= 12; seed += 1) {
      let state = seed
      const rng = () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 4294967296
      }
      const game = new SnakeGame(index, { rng })
      assert.ok(game.food, `level ${index + 1} must spawn fruit`)
      assert.ok(!game.snake.some(cell => cell.x === game.food.x && cell.y === game.food.y))
      assert.ok(!game.level.obstacleSet.has(key(game.food.x, game.food.y)))
      assert.ok(game.reachableCells(true).has(key(game.food.x, game.food.y)))
      assert.equal(game.snake.length, 4)
      assert.equal(game.status, 'playing')
      assert.equal(game.progress, 0)
    }
  }
})

test('reversing directly into the snake is rejected', () => {
  const game = new SnakeGame(0)
  assert.equal(game.queueDirection('left'), false)
  assert.equal(game.queueDirection('right'), false)
  assert.equal(game.queueDirection('up'), true)
  assert.equal(game.queueDirection('down'), false)
  assert.equal(game.queueDirection('left'), true)
  assert.equal(game.queueDirection('right'), false)
  assert.deepEqual(game.directionQueue, ['up', 'left'])
})

test('snake movement follows the queued direction', () => {
  const game = place(new SnakeGame(0), [
    { x: 6, y: 8 },
    { x: 5, y: 8 },
    { x: 4, y: 8 },
    { x: 3, y: 8 }
  ], 'right', { x: 10, y: 10 })
  game.queueDirection('up')
  const result = game.step()
  assert.equal(result.type, 'move')
  assert.deepEqual(game.snake[0], { x: 6, y: 7 })
  assert.equal(game.snake.length, 4)
  assert.equal(game.score, 0)
})

test('eating grows the snake, scores points, and advances progress', () => {
  const game = place(new SnakeGame(0), [
    { x: 6, y: 8 },
    { x: 5, y: 8 },
    { x: 4, y: 8 },
    { x: 3, y: 8 }
  ], 'right', { x: 7, y: 8 })
  const result = game.step()
  assert.equal(result.ate, true)
  assert.equal(result.points, 10)
  assert.equal(game.snake.length, 5)
  assert.equal(game.score, 10)
  assert.equal(game.progress, 1)
  assert.equal(game.combo, 1)
  assert.ok(game.food)
})

test('consecutive fruit raises the combo multiplier', () => {
  const game = place(new SnakeGame(0), [
    { x: 6, y: 8 },
    { x: 5, y: 8 },
    { x: 4, y: 8 },
    { x: 3, y: 8 }
  ], 'right', { x: 7, y: 8 })
  game.step()
  game.snake = [
    { x: 7, y: 8 },
    { x: 6, y: 8 },
    { x: 5, y: 8 },
    { x: 4, y: 8 },
    { x: 3, y: 8 }
  ]
  game.food = { x: 8, y: 8 }
  const second = game.step()
  assert.equal(second.combo, 2)
  assert.equal(second.points, 20)
  assert.equal(game.score, 30)
})

test('walls end the run when the level does not wrap', () => {
  const game = place(new SnakeGame(0), [
    { x: 12, y: 8 },
    { x: 11, y: 8 },
    { x: 10, y: 8 },
    { x: 9, y: 8 }
  ], 'right', { x: 2, y: 2 })
  const result = game.step()
  assert.equal(result.type, 'die')
  assert.equal(result.reason, 'wall')
  assert.equal(game.status, 'dead')
  assert.equal(game.deathReason, 'wall')
})

test('portal levels wrap the snake across the border', () => {
  const level = buildLevel(5)
  const game = place(new SnakeGame(5), [
    { x: level.cols - 1, y: 10 },
    { x: level.cols - 2, y: 10 },
    { x: level.cols - 3, y: 10 },
    { x: level.cols - 4, y: 10 }
  ], 'right', { x: 4, y: 4 })
  const result = game.step()
  assert.equal(result.type, 'move')
  assert.equal(game.snake[0].x, 0)
  assert.equal(game.snake[0].y, 10)
})

test('snake cannot bite its own body', () => {
  const game = place(new SnakeGame(0), [
    { x: 6, y: 8 },
    { x: 5, y: 8 },
    { x: 5, y: 7 },
    { x: 6, y: 7 },
    { x: 6, y: 6 }
  ], 'up', { x: 2, y: 2 })
  const result = game.step()
  assert.equal(result.type, 'die')
  assert.equal(result.reason, 'self')
})

test('obstacles are lethal', () => {
  const game = new SnakeGame(1)
  const target = game.level.obstacles.find(cell => {
    const left = { x: cell.x - 1, y: cell.y }
    const behind = [
      left,
      { x: left.x - 1, y: left.y },
      { x: left.x - 2, y: left.y },
      { x: left.x - 3, y: left.y }
    ]
    return behind.every(cell => !game.level.obstacleSet.has(key(cell.x, cell.y)))
  })
  assert.ok(target)
  place(game, [
    { x: target.x - 1, y: target.y },
    { x: target.x - 2, y: target.y },
    { x: target.x - 3, y: target.y },
    { x: target.x - 4, y: target.y }
  ], 'right', { x: 2, y: 2 })
  const result = game.step()
  assert.equal(result.type, 'die')
  assert.equal(result.reason, 'obstacle')
})

test('drones are lethal and advance on their patrol schedule', () => {
  const game = new SnakeGame(6)
  assert.equal(game.hazards.length, 1)
  const hazardIndex = game.level.hazardPath.findIndex((cell, index) => {
    const left = { x: cell.x - 1, y: cell.y }
    const behind = [
      left,
      { x: left.x - 1, y: left.y },
      { x: left.x - 2, y: left.y },
      { x: left.x - 3, y: left.y }
    ]
    return cell.x >= 4 &&
      index > 2 &&
      behind.every(item => !game.level.obstacleSet.has(key(item.x, item.y)))
  })
  assert.ok(hazardIndex >= 0)
  game.hazards[0].index = hazardIndex
  game.hazards[0].prevIndex = hazardIndex
  const target = game.level.hazardPath[hazardIndex]
  place(game, [
    { x: target.x - 1, y: target.y },
    { x: target.x - 2, y: target.y },
    { x: target.x - 3, y: target.y },
    { x: target.x - 4, y: target.y }
  ], 'right', { x: 2, y: 2 })
  const result = game.step()
  assert.equal(result.type, 'die')
  assert.equal(result.reason, 'drone')

  const moving = new SnakeGame(7)
  const before = moving.hazards.map(hazard => hazard.index)
  place(moving, [
    { x: 8, y: 11 },
    { x: 8, y: 12 },
    { x: 8, y: 13 },
    { x: 8, y: 14 }
  ], 'up', { x: 15, y: 18 })
  moving.totalTicks = moving.level.hazardPeriod - 1
  moving.step()
  assert.notDeepEqual(moving.hazards.map(hazard => hazard.index), before)
})

test('collecting the final fruit clears the level and awards the bonus', () => {
  const game = place(new SnakeGame(0), [
    { x: 6, y: 8 },
    { x: 5, y: 8 },
    { x: 4, y: 8 },
    { x: 3, y: 8 }
  ], 'right', { x: 7, y: 8 })
  game.progress = game.level.goal - 1
  const result = game.step()
  assert.equal(result.cleared, true)
  assert.equal(game.status, 'cleared')
  assert.equal(game.progress, game.level.goal)
  assert.equal(result.bonus, 100)
  assert.equal(game.score, 110)
})

test('reset restores a fresh playable level', () => {
  const game = new SnakeGame(2)
  game.score = 999
  game.progress = 4
  game.directionQueue.push('up')
  game.status = 'dead'
  game.reset()
  assert.equal(game.score, 0)
  assert.equal(game.progress, 0)
  assert.equal(game.status, 'playing')
  assert.deepEqual(game.directionQueue, [])
  assert.equal(game.direction, 'right')
  assert.equal(game.snake.length, 4)
  assert.ok(game.food)
})

test('each direction has an opposite and levels expose their mechanics', () => {
  assert.equal(DIRECTIONS.up.x, 0)
  assert.equal(DIRECTIONS.left.y, 0)
  assert.ok(LEVELS[5].wrap)
  assert.ok(LEVELS[8].wrap)
  assert.equal(LEVELS[6].hazards, 1)
  assert.equal(LEVELS[9].hazards, 3)
})
