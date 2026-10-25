import * as THREE from 'three'
import { makeGlowTexture, makeGroundLightTexture } from './textures.js'

const UP = new THREE.Vector3(0, 1, 0)
const COATS = [0x574b3d, 0x3d4b47, 0x4b3d48, 0x554236, 0x37414f, 0x4f4834]
const SCARVES = [0x8e2f30, 0x30485c, 0x6b4a2a, 0x4f3153, 0x2e553f]
const SKIN = [0xc59a7a, 0xa97a5b, 0xd1a887, 0x8c624b]

const geoCache = new Map()
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make())
  return geoCache.get(key)
}

function makeLamp(mobile) {
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.4, metalness: 0.85 })
  const glass = new THREE.MeshStandardMaterial({
    color: 0xffd28f,
    emissive: 0xff8f2f,
    emissiveIntensity: 3.2,
    roughness: 0.35
  })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.28, 0.19), glass)
  group.add(body)
  for (const [x, z] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.33, 0.025), metal)
    bar.position.set(x, 0, z)
    group.add(bar)
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 4), metal)
  cap.position.y = 0.2
  cap.rotation.y = Math.PI / 4
  group.add(cap)
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.22), metal)
  base.position.y = -0.16
  group.add(base)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 5, 12), metal)
  ring.position.y = 0.28
  ring.rotation.x = Math.PI / 2
  group.add(ring)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: 0xffa952,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }))
  glow.scale.set(1.25, 1.25, 1)
  group.add(glow)
  let light = null
  if (!mobile) {
    light = new THREE.PointLight(0xffa45c, 3.4, 7.5, 2)
    light.castShadow = false
    group.add(light)
  }
  group.userData = { light, glow, glass }
  return group
}

export class Visitor {
  constructor(scene, world, { mobile = false, index = 0 } = {}) {
    this.scene = scene
    this.world = world
    this.mobile = mobile
    this.fear = 0
    this.maxFear = 2
    this.state = 'spawning'
    this.spawnT = 0
    this.walkPhase = Math.random() * 10
    this.speed = 0
    this.panicTimer = 0
    this.banishT = 0
    this.dead = false
    this.target = new THREE.Vector3()
    this.stuck = 0
    this.hazardRadius = 3.25
    this.radius = 0.42
    this.position = new THREE.Vector3()
    this.lastDistanceCheck = 0
    this.panicPulse = 0
    this.lampSwing = 0

    const coatColor = COATS[(Math.random() * COATS.length) | 0]
    const scarfColor = SCARVES[(Math.random() * SCARVES.length) | 0]
    const skinColor = SKIN[(Math.random() * SKIN.length) | 0]
    const coatMat = new THREE.MeshStandardMaterial({ color: coatColor, roughness: 0.92 })
    const scarfMat = new THREE.MeshStandardMaterial({ color: scarfColor, roughness: 0.85 })
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.75 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x17120f, roughness: 0.9 })
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.88 })
    const hairMat = new THREE.MeshStandardMaterial({ color: index % 2 ? 0x33251b : 0x514033, roughness: 0.95 })
    const hatMat = new THREE.MeshStandardMaterial({ color: index % 2 ? 0x211c19 : 0x35302a, roughness: 0.95 })

    const group = new THREE.Group()
    const body = new THREE.Group()
    group.add(body)
    this.group = group
    this.body = body

    const legGeo = geo('leg', () => new THREE.CapsuleGeometry(0.075, 0.44, 4, 7))
    const bootGeo = geo('boot', () => new THREE.BoxGeometry(0.17, 0.14, 0.32))
    this.legs = []
    for (const side of [-1, 1]) {
      const leg = new THREE.Group()
      leg.position.set(side * 0.13, 0.88, 0)
      const mesh = new THREE.Mesh(legGeo, darkMat)
      mesh.position.y = -0.3
      mesh.castShadow = true
      leg.add(mesh)
      const boot = new THREE.Mesh(bootGeo, bootMat)
      boot.position.set(0, -0.58, 0.07)
      boot.castShadow = true
      leg.add(boot)
      body.add(leg)
      this.legs.push(leg)
    }

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.48, 0.55, 10), coatMat)
    skirt.position.y = 0.73
    skirt.castShadow = true
    body.add(skirt)

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.33, 0.84, 10), coatMat)
    torso.position.y = 1.24
    torso.castShadow = true
    torso.receiveShadow = true
    body.add(torso)

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 10), darkMat)
    belt.position.y = 1.02
    body.add(belt)
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.05), new THREE.MeshStandardMaterial({ color: 0x8a7550, metalness: 0.8, roughness: 0.4 }))
    buckle.position.set(0.09, 1.02, 0.3)
    body.add(buckle)

    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 5, 14), scarfMat)
    scarf.position.y = 1.66
    scarf.rotation.x = Math.PI / 2
    body.add(scarf)
    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.045), scarfMat)
    scarfTail.position.set(0.08, 1.45, 0.28)
    scarfTail.rotation.z = -0.08
    body.add(scarfTail)

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 13), skinMat)
    head.position.y = 1.88
    head.castShadow = true
    body.add(head)
    this.head = head
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), skinMat)
    nose.position.set(0, 1.86, 0.23)
    body.add(nose)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 6, 5), darkMat)
      eye.position.set(side * 0.075, 1.92, 0.215)
      body.add(eye)
    }
    const earGeo = geo('ear', () => new THREE.SphereGeometry(0.045, 6, 5))
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, skinMat)
      ear.position.set(side * 0.227, 1.86, 0)
      body.add(ear)
    }

    if (index % 3 === 0) {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat)
      hair.position.y = 1.94
      hair.scale.z = 1.03
      body.add(hair)
    } else if (index % 3 === 1) {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.37, 0.045, 14), hatMat)
      brim.position.y = 2.04
      body.add(brim)
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.28, 10), hatMat)
      crown.position.y = 2.2
      body.add(crown)
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 10), scarfMat)
      band.position.y = 2.1
      body.add(band)
    } else {
      const bonnet = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat)
      bonnet.position.set(0, 1.97, -0.03)
      body.add(bonnet)
      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.025, 4, 12), scarfMat)
      ribbon.position.set(0, 1.9, 0.02)
      ribbon.rotation.x = Math.PI / 2
      body.add(ribbon)
    }

    this.arms = []
    const armGeo = geo('arm', () => new THREE.CapsuleGeometry(0.065, 0.42, 4, 7))
    const handGeo = geo('hand', () => new THREE.SphereGeometry(0.085, 8, 7))
    for (const side of [-1, 1]) {
      const arm = new THREE.Group()
      arm.position.set(side * 0.32, 1.58, 0)
      arm.rotation.z = side * 0.22
      const mesh = new THREE.Mesh(armGeo, coatMat)
      mesh.position.y = -0.24
      mesh.castShadow = true
      arm.add(mesh)
      const hand = new THREE.Mesh(handGeo, skinMat)
      hand.position.set(0, -0.51, 0.01)
      arm.add(hand)
      body.add(arm)
      this.arms.push({ group: arm, hand })
    }

    const lamp = makeLamp(mobile)
    lamp.position.set(0.02, -0.72, 0.03)
    this.arms[1].group.add(lamp)
    this.lamp = lamp

    this.lampPool = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 7.2),
      new THREE.MeshBasicMaterial({
        map: makeGroundLightTexture(),
        color: 0xff9c4a,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
    this.lampPool.rotation.x = -Math.PI / 2
    this.lampPool.position.y = 0.02
    group.add(this.lampPool)

    this.pips = []
    const pipGeo = new THREE.OctahedronGeometry(0.075, 0)
    const pipMat = new THREE.MeshStandardMaterial({ color: 0xff2438, emissive: 0xff0718, emissiveIntensity: 4.5, roughness: 0.3 })
    for (let i = 0; i < 2; i++) {
      const pip = new THREE.Mesh(pipGeo, pipMat)
      pip.position.set((i - 0.5) * 0.2, 2.48, 0)
      pip.scale.setScalar(0.001)
      group.add(pip)
      this.pips.push(pip)
    }

    const alert = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: 0xff2638,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }))
    alert.scale.set(1.4, 1.4, 1)
    alert.position.y = 2.48
    group.add(alert)
    this.alert = alert

    group.scale.setScalar(0.001)
    scene.add(group)
    this.scaleBase = 0.92 + Math.random() * 0.16
    this.speed = 1.5 + Math.random() * 0.45
    this.phase = Math.random() * 10
    this.pickTarget(true)
  }

  setPosition(x, z) {
    this.position.set(x, 0, z)
    this.group.position.set(x, 0, z)
    this.pickTarget(true)
  }

  pickTarget(force = false) {
    const p = this.position
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      const d = 6 + Math.random() * 20
      const x = THREE.MathUtils.clamp(p.x + Math.cos(a) * d, -36, 36)
      const z = THREE.MathUtils.clamp(p.z + Math.sin(a) * d, -33, 37)
      if (Math.hypot(x - p.x, z - p.z) < 4) continue
      if (this.world.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1.3)) continue
      this.target.set(x, 0, z)
      return
    }
    if (force) this.target.set((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 50)
  }

  applyFear() {
    if (this.state === 'banished' || this.state === 'spawning') return { hit: false }
    this.fear++
    this.state = 'panic'
    this.panicTimer = 2.4 + Math.random() * 0.7
    this.panicPulse = 1
    this.updatePips()
    if (this.fear >= this.maxFear) {
      this.state = 'banished'
      this.banishT = 0
      this.lampPool.visible = false
      if (this.lamp.userData.light) this.lamp.userData.light.intensity = 0
      this.lamp.visible = false
      this.alert.material.opacity = 0
      for (const pip of this.pips) pip.visible = false
      this.dropLantern()
      return { hit: true, banished: true }
    }
    return { hit: true, banished: false }
  }

  updatePips() {
    for (let i = 0; i < this.pips.length; i++) {
      this.pips[i].visible = i < this.fear && this.state !== 'banished'
    }
  }

  dropLantern() {
    const ghost = new THREE.Group()
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: 0xffa34d,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }))
    glow.scale.set(2.4, 2.4, 1)
    ghost.add(glow)
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.3, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xffc77b, emissive: 0xff8226, emissiveIntensity: 3.2 })
    )
    ghost.add(core)
    ghost.position.copy(this.position)
    ghost.position.y = 0.35
    this.scene.add(ghost)
    this.droppedLamp = ghost
  }

  getLanternWorld(target = new THREE.Vector3()) {
    this.arms[1].hand.getWorldPosition(target)
    target.y -= 0.25
    return target
  }

  isHazard() {
    return this.state === 'spawning' ? this.spawnT > 0.4 : this.state !== 'banished'
  }

  update(dt, time, playerPos, others) {
    this.panicPulse = Math.max(0, this.panicPulse - dt * 2.4)

    if (this.state === 'spawning') {
      this.spawnT += dt
      const t = Math.min(1, this.spawnT / 0.65)
      const ease = 1 - Math.pow(1 - t, 3)
      this.group.scale.setScalar(this.scaleBase * ease)
      this.group.position.y = (1 - ease) * -1.2
      if (t >= 1) {
        this.state = 'wander'
        this.group.scale.setScalar(this.scaleBase)
        this.group.position.y = 0
      }
    }

    if (this.state === 'banished') {
      this.banishT += dt
      const t = Math.min(1, this.banishT / 0.6)
      this.group.scale.setScalar(this.scaleBase * (1 - t))
      this.group.rotation.y += dt * 8
      this.group.position.y = t * 0.7
      if (this.droppedLamp) {
        this.droppedLamp.material?.dispose?.()
        this.droppedLamp.children[0].material.opacity = Math.max(0, 0.85 - t * 0.7)
      }
      if (t >= 1) {
        this.dead = true
        this.dispose()
      }
      return
    }

    let moving = false
    let speed = 0
    if (this.state === 'panick' || this.state === 'panic') {
      this.panicTimer -= dt
      const away = new THREE.Vector3(this.position.x - playerPos.x, 0, this.position.z - playerPos.z)
      if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0, Math.random() - 0.5)
      away.normalize()
      this.target.set(
        THREE.MathUtils.clamp(this.position.x + away.x * 10, -38, 38),
        0,
        THREE.MathUtils.clamp(this.position.z + away.z * 10, -37, 38)
      )
      speed = 4.2
      moving = true
      if (this.panicTimer <= 0) {
        this.state = 'wander'
        this.pickTarget(true)
      }
    } else if (this.state === 'wander') {
      speed = this.speed
      const dist = Math.hypot(this.target.x - this.position.x, this.target.z - this.position.z)
      if (dist < 0.8) this.pickTarget()
      moving = dist >= 0.8
    }

    if (moving) {
      const desired = new THREE.Vector3(this.target.x - this.position.x, 0, this.target.z - this.position.z)
      const len = desired.length()
      if (len > 0.001) desired.divideScalar(len)
      for (const collider of this.world.colliders) {
        const dx = this.position.x - collider.x
        const dz = this.position.z - collider.z
        const d = Math.hypot(dx, dz)
        const safe = collider.r + this.radius + 0.35
        if (d < safe && d > 0.0001) {
          desired.x += (dx / d) * (safe - d) * 1.4
          desired.z += (dz / d) * (safe - d) * 1.4
        }
      }
      if (others) {
        for (const other of others) {
          if (other === this || other.state === 'banished' || other.state === 'spawning') continue
          const dx = this.position.x - other.position.x
          const dz = this.position.z - other.position.z
          const d = Math.hypot(dx, dz)
          if (d < 1.0 && d > 0.001) {
            desired.x += (dx / d) * (1.0 - d) * 0.8
            desired.z += (dz / d) * (1.0 - d) * 0.8
          }
        }
      }
      desired.normalize()
      const prevX = this.position.x
      const prevZ = this.position.z
      this.position.x += desired.x * speed * dt
      this.position.z += desired.z * speed * dt
      this.position.x = THREE.MathUtils.clamp(this.position.x, -40, 40)
      this.position.z = THREE.MathUtils.clamp(this.position.z, -36, 40)
      for (const collider of this.world.colliders) {
        const dx = this.position.x - collider.x
        const dz = this.position.z - collider.z
        const d = Math.hypot(dx, dz)
        const safe = collider.r + this.radius
        if (d < safe && d > 0.0001) {
          this.position.x = collider.x + (dx / d) * safe
          this.position.z = collider.z + (dz / d) * safe
        }
      }
      const moved = Math.hypot(this.position.x - prevX, this.position.z - prevZ)
      if (moved < speed * dt * 0.1) this.stuck += dt
      else this.stuck = 0
      if (this.stuck > 2.5) {
        this.pickTarget(true)
        this.stuck = 0
      }
      this.walkPhase += dt * (this.state === 'panic' ? 16 : 7.5) * (speed / Math.max(1, this.speed))
      const targetRot = Math.atan2(desired.x, desired.z)
      let diff = targetRot - this.group.rotation.y
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      this.group.rotation.y += diff * Math.min(1, dt * 9)
    } else {
      this.walkPhase += dt * 1.4
    }

    this.group.position.set(this.position.x, 0, this.position.z)
    const stride = Math.sin(this.walkPhase)
    const moveAmt = moving ? 1 : 0.16
    this.legs[0].rotation.x = stride * 0.55 * moveAmt
    this.legs[1].rotation.x = -stride * 0.55 * moveAmt
    this.arms[0].group.rotation.x = -stride * 0.35 * moveAmt
    this.arms[0].group.rotation.z = -0.22
    if (this.state === 'panic') {
      this.arms[0].group.rotation.z = -1.3 - Math.sin(time * 20) * 0.25
      this.arms[0].group.rotation.x = -1.1 + Math.cos(time * 17) * 0.2
      this.arms[1].group.rotation.z = 1.3 + Math.sin(time * 19 + 2) * 0.25
      this.arms[1].group.rotation.x = -1.1 + Math.cos(time * 18 + 1) * 0.2
      this.body.rotation.z = Math.sin(time * 12) * 0.05
      this.head.rotation.z = Math.sin(time * 16) * 0.12
    } else {
      this.arms[1].group.rotation.x = stride * 0.18 * moveAmt - 0.05
      this.arms[1].group.rotation.z = 0.22
      this.body.rotation.z = Math.sin(time * 2 + this.phase) * 0.012
      this.head.rotation.z = Math.sin(time * 1.4 + this.phase) * 0.03
    }
    this.body.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.035 * moveAmt
    this.head.rotation.y = Math.sin(time * 0.9 + this.phase) * 0.13

    this.lampSwing = THREE.MathUtils.lerp(this.lampSwing, -this.arms[1].group.rotation.x * 0.5, 0.08)
    this.lamp.rotation.z = this.lampSwing + Math.sin(this.walkPhase) * 0.03
    this.lamp.rotation.x = -this.body.rotation.z * 0.5

    const flicker = 0.86 + Math.sin(time * 9.2 + this.phase) * 0.06 + Math.sin(time * 17 + this.phase) * 0.04
    this.lamp.userData.glass.material.emissiveIntensity = 2.8 + flicker * 0.7
    this.lamp.userData.glow.material.opacity = 0.68 + flicker * 0.18
    if (this.lamp.userData.light) this.lamp.userData.light.intensity = 3.1 * flicker
    this.lampPool.material.opacity = (this.state === 'panic' ? 0.13 : 0.2) * flicker
    this.alert.material.opacity = this.state === 'panic' ? 0.38 + Math.sin(time * 18) * 0.16 : 0
    const alertScale = this.state === 'panic' ? 1.3 + Math.sin(time * 18) * 0.15 : 1
    this.alert.scale.set(alertScale, alertScale, 1)
    this.alert.position.y = 2.55 + Math.sin(time * 5) * 0.04

    for (let i = 0; i < this.pips.length; i++) {
      const pip = this.pips[i]
      if (!pip.visible) continue
      pip.rotation.y += dt * 2.5
      pip.position.y = 2.46 + Math.sin(time * 4 + i) * 0.03
      const targetScale = i < this.fear ? 1 + this.panicPulse * 0.4 : 0.001
      pip.scale.setScalar(THREE.MathUtils.lerp(pip.scale.x, targetScale, 0.2))
    }

    if (this.droppedLamp) {
      this.droppedLamp.children[0].material.opacity = Math.max(0, this.droppedLamp.children[0].material.opacity - dt * 0.08)
      this.droppedLamp.position.y = Math.max(0.1, this.droppedLamp.position.y - dt * 0.1)
    }
  }

  dispose() {
    this.scene.remove(this.group)
    this.group.traverse((child) => {
      if (child.geometry && !child.geometry.userData.shared) {
        if (!geoCache.has(child.geometry)) child.geometry.dispose?.()
      }
    })
    if (this.droppedLamp) {
      this.scene.remove(this.droppedLamp)
      this.droppedLamp.traverse((child) => {
        child.geometry?.dispose?.()
        if (child.material && !Array.isArray(child.material)) child.material.dispose?.()
      })
    }
    this.disposed = true
  }
}
