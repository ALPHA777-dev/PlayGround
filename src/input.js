import * as THREE from 'three'

export class Input {
  constructor(canvas) {
    this.canvas = canvas
    this.keys = new Set()
    this.move = new THREE.Vector2()
    this.cameraDelta = new THREE.Vector2()
    this.zoomDelta = 0
    this.screamQueued = 0
    this.nightmareQueued = 0
    this.dragging = false
    this.dragPointer = null
    this.lastPointer = new THREE.Vector2()
    this.joystickPointer = null
    this.joystickActive = false
    this.isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
    this.enabled = true
    this.onPause = null
    this.onMute = null
    this.onAnyAction = null

    this.joystick = document.getElementById('joystick')
    this.knob = this.joystick?.querySelector('.joystick-knob')
    this.screamButton = document.getElementById('screamBtn')
    this.nightmareButton = document.getElementById('nightmareBtn')

    this.bindKeyboard()
    this.bindPointer()
    this.bindJoystick()
    this.bindButtons()
    if (this.isTouch) document.body.classList.add('touch')
    else document.body.classList.add('desktop')
  }

  bindKeyboard() {
    const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'])
    window.addEventListener('keydown', (event) => {
      if (event.repeat) {
        if (movement.has(event.code)) event.preventDefault()
        return
      }
      if (movement.has(event.code)) {
        this.keys.add(event.code)
        event.preventDefault()
      }
      if (event.code === 'Space') {
        event.preventDefault()
        if (this.enabled) this.pressScream()
      }
      if (event.code === 'KeyE' || event.code === 'KeyQ') {
        if (this.enabled) this.pressNightmare()
      }
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault()
        this.onPause?.()
      }
      if (event.code === 'KeyM') this.onMute?.()
    })
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code)
    })
    window.addEventListener('blur', () => this.clear())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear()
    })
  }

  bindPointer() {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.enabled) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      this.dragging = true
      this.dragPointer = event.pointerId
      this.lastPointer.set(event.clientX, event.clientY)
      this.canvas.setPointerCapture?.(event.pointerId)
      this.canvas.classList.add('grabbing')
      this.onAnyAction?.()
    })
    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging || event.pointerId !== this.dragPointer) return
      const dx = event.clientX - this.lastPointer.x
      const dy = event.clientY - this.lastPointer.y
      this.lastPointer.set(event.clientX, event.clientY)
      const speed = event.pointerType === 'touch' ? 1.4 : 1
      this.cameraDelta.x += dx * 0.0042 * speed
      this.cameraDelta.y += dy * 0.0032 * speed
    })
    const end = (event) => {
      if (event.pointerId !== this.dragPointer) return
      this.dragging = false
      this.dragPointer = null
      this.canvas.classList.remove('grabbing')
    }
    this.canvas.addEventListener('pointerup', end)
    this.canvas.addEventListener('pointercancel', end)
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault())
    this.canvas.addEventListener('wheel', (event) => {
      this.zoomDelta += Math.sign(event.deltaY) * 0.6
      event.preventDefault()
    }, { passive: false })
  }

  bindJoystick() {
    if (!this.joystick) return
    const setKnob = (dx, dy) => {
      if (this.knob) this.knob.style.transform = `translate(${dx}px, ${dy}px)`
    }
    const update = (event) => {
      if (event.pointerId !== this.joystickPointer) return
      const rect = this.joystick.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      let dx = event.clientX - cx
      let dy = event.clientY - cy
      const max = rect.width * 0.32
      const len = Math.hypot(dx, dy)
      if (len > max) {
        dx = (dx / len) * max
        dy = (dy / len) * max
      }
      this.move.set(dx / max, -dy / max)
      setKnob(dx, dy)
    }
    this.joystick.addEventListener('pointerdown', (event) => {
      if (!this.enabled) return
      event.preventDefault()
      this.joystickPointer = event.pointerId
      this.joystickActive = true
      this.joystick.classList.add('active')
      this.joystick.setPointerCapture?.(event.pointerId)
      update(event)
      this.onAnyAction?.()
    })
    this.joystick.addEventListener('pointermove', update)
    const end = (event) => {
      if (event.pointerId !== this.joystickPointer) return
      this.joystickPointer = null
      this.joystickActive = false
      this.joystick.classList.remove('active')
      this.move.set(0, 0)
      setKnob(0, 0)
    }
    this.joystick.addEventListener('pointerup', end)
    this.joystick.addEventListener('pointercancel', end)
  }

  bindButtons() {
    const sound = document.getElementById('soundBtn')
    sound?.addEventListener('click', () => this.onMute?.())
    if (this.screamButton) {
      this.screamButton.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (this.enabled) this.pressScream()
      })
    }
    if (this.nightmareButton) {
      this.nightmareButton.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (this.enabled) this.pressNightmare()
      })
    }
  }

  pressScream() {
    this.screamQueued++
    this.onAnyAction?.()
  }

  pressNightmare() {
    this.nightmareQueued++
    this.onAnyAction?.()
  }

  consumeScream() {
    if (this.screamQueued > 0) {
      this.screamQueued--
      return true
    }
    return false
  }

  consumeNightmare() {
    if (this.nightmareQueued > 0) {
      this.nightmareQueued--
      return true
    }
    return false
  }

  consumeCamera() {
    const delta = this.cameraDelta.clone()
    this.cameraDelta.set(0, 0)
    return delta
  }

  consumeZoom() {
    const value = this.zoomDelta
    this.zoomDelta = 0
    return value
  }

  getMove() {
    if (!this.enabled) return new THREE.Vector2()
    let x = this.move.x
    let y = this.move.y
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1
    const vec = new THREE.Vector2(x, y)
    if (vec.lengthSq() > 1) vec.normalize()
    return vec
  }

  clear() {
    this.keys.clear()
    this.move.set(0, 0)
    this.joystickActive = false
    this.joystickPointer = null
    this.dragging = false
    this.dragPointer = null
    if (this.knob) this.knob.style.transform = 'translate(0px, 0px)'
    this.joystick?.classList.remove('active')
  }
}
