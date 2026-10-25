import * as THREE from 'three'
import { makeGlowTexture, makeSmokeTexture } from './textures.js'

export class Effects {
  constructor(scene) {
    this.scene = scene
    this.group = new THREE.Group()
    scene.add(this.group)
    this.items = []
    this.glowTex = makeGlowTexture()
    this.smokeTex = makeSmokeTexture()
    this.sparkGeo = new THREE.BufferGeometry()
    this.sparkMat = new THREE.PointsMaterial({
      size: 0.2,
      map: this.glowTex,
      color: 0xff5a54,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false
    })
  }

  scream(pos, power = 1) {
    const group = new THREE.Group()
    group.position.set(pos.x, 0.08, pos.z)
    this.group.add(group)

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff3348,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.94, 64), ringMat)
    ring.rotation.x = -Math.PI / 2
    group.add(ring)

    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 0.84, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    )
    ring2.rotation.x = -Math.PI / 2
    group.add(ring2)

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 28, 18),
      new THREE.MeshBasicMaterial({
        color: 0xff2c42,
        transparent: true,
        opacity: 0.13,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    )
    dome.position.y = 0.25
    dome.scale.setScalar(0.4)
    group.add(dome)

    const light = new THREE.PointLight(0xff2438, 18 * power, 18, 2)
    light.position.y = 1.2
    group.add(light)

    const count = 48
    const positions = new Float32Array(count * 3)
    const velocities = []
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const speed = 3 + Math.random() * 8
      const up = 0.4 + Math.random() * 3.4
      velocities.push({ x: Math.cos(a) * speed, y: up, z: Math.sin(a) * speed })
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0.3 + Math.random() * 1.2
      positions[i * 3 + 2] = 0
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const sparks = new THREE.Points(geo, this.sparkMat.clone())
    sparks.material.opacity = 0.9
    group.add(sparks)

    this.items.push({
      type: 'scream',
      group,
      age: 0,
      life: 0.9,
      ring,
      ring2,
      dome,
      light,
      sparks,
      velocities,
      update(dt) {
        this.age += dt
        const t = this.age / this.life
        const radius = 0.8 + t * 8.6 * power
        ring.scale.setScalar(radius)
        ring2.scale.setScalar(radius * 1.06)
        ringMat.opacity = Math.max(0, (1 - t) * 0.82)
        ring2.material.opacity = Math.max(0, (1 - t) * 0.7)
        dome.scale.setScalar(0.4 + t * 7.4 * power)
        dome.material.opacity = Math.max(0, (1 - t) * 0.14)
        light.intensity = Math.max(0, (1 - t) * 18 * power)
        const attr = geo.attributes.position
        for (let i = 0; i < count; i++) {
          const v = velocities[i]
          attr.setXYZ(
            i,
            attr.getX(i) + v.x * dt,
            Math.max(0.04, attr.getY(i) + v.y * dt - 4.5 * this.age * dt),
            attr.getZ(i) + v.z * dt
          )
          v.x *= 0.985
          v.z *= 0.985
        }
        attr.needsUpdate = true
        sparks.material.opacity = Math.max(0, 1 - t) * 0.9
        sparks.material.color.setRGB(1, 0.2 + (1 - t) * 0.5, 0.26)
      }
    })
  }

  hit(pos, strong = false) {
    const group = new THREE.Group()
    group.position.copy(pos)
    group.position.y += 1.2
    this.group.add(group)
    const count = strong ? 22 : 10
    const positions = new Float32Array(count * 3)
    const velocities = []
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const speed = 0.8 + Math.random() * 3.4
      velocities.push({ x: Math.cos(a) * speed, y: 1 + Math.random() * 3, z: Math.sin(a) * speed })
      positions[i * 3] = (Math.random() - 0.5) * 0.4
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.3
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = this.sparkMat.clone()
    mat.size = strong ? 0.3 : 0.18
    mat.color = new THREE.Color(0xffd0c4)
    const points = new THREE.Points(geo, mat)
    group.add(points)
    this.items.push({
      type: 'hit',
      group,
      age: 0,
      life: 0.5,
      update(dt) {
        this.age += dt
        const t = this.age / this.life
        const attr = geo.attributes.position
        for (let i = 0; i < count; i++) {
          const v = velocities[i]
          attr.setXYZ(i, attr.getX(i) + v.x * dt, attr.getY(i) + v.y * dt - 5 * this.age * dt, attr.getZ(i) + v.z * dt)
        }
        attr.needsUpdate = true
        mat.opacity = Math.max(0, 1 - t)
      }
    })
  }

  banish(pos) {
    const group = new THREE.Group()
    group.position.copy(pos)
    this.group.add(group)
    const smoke = []
    for (let i = 0; i < 9; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.smokeTex,
        color: i % 3 === 0 ? 0x4c2232 : 0x25222c,
        transparent: true,
        opacity: 0.7,
        depthWrite: false
      }))
      sprite.position.set((Math.random() - 0.5) * 0.9, 0.4 + Math.random() * 1.6, (Math.random() - 0.5) * 0.9)
      sprite.scale.set(1.1 + Math.random() * 0.8, 1.1 + Math.random() * 0.8, 1)
      group.add(sprite)
      smoke.push({ sprite, vx: (Math.random() - 0.5) * 0.3, vy: 0.35 + Math.random() * 0.6, phase: Math.random() * 10 })
    }

    const orbs = []
    for (let i = 0; i < 5; i++) {
      const orb = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0xff3347,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }))
      orb.position.set((Math.random() - 0.5) * 0.8, 0.7 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8)
      orb.scale.set(0.4, 0.4, 1)
      group.add(orb)
      orbs.push({ sprite: orb, phase: Math.random() * 10, delay: Math.random() * 0.2 })
    }
    const light = new THREE.PointLight(0xff2340, 6, 8, 2)
    light.position.y = 1
    group.add(light)

    this.items.push({
      type: 'banish',
      group,
      age: 0,
      life: 1.2,
      update(dt) {
        this.age += dt
        const t = this.age / this.life
        for (const s of smoke) {
          s.sprite.position.x += s.vx * dt
          s.sprite.position.y += s.vy * dt
          s.sprite.material.opacity = Math.max(0, (1 - t) * 0.72)
          s.sprite.rotation += dt * 0.2
        }
        for (const o of orbs) {
          const local = Math.max(0, this.age - o.delay)
          o.sprite.position.y += dt * 2.4
          o.sprite.position.x += Math.sin(local * 5 + o.phase) * dt * 0.5
          o.sprite.scale.setScalar(0.4 + Math.sin(local * 4 + o.phase) * 0.06)
          o.sprite.material.opacity = Math.max(0, 1 - t) * 0.95
        }
        light.intensity = Math.max(0, (1 - t) * 6)
      }
    })
  }

  collect(pos) {
    const group = new THREE.Group()
    group.position.copy(pos)
    this.group.add(group)
    const count = 18
    const positions = new Float32Array(count * 3)
    const velocities = []
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const speed = 0.5 + Math.random() * 2.2
      velocities.push({ x: Math.cos(a) * speed, y: 0.6 + Math.random() * 2, z: Math.sin(a) * speed })
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = this.sparkMat.clone()
    mat.color = new THREE.Color(0x9fd8ff)
    mat.size = 0.25
    const points = new THREE.Points(geo, mat)
    group.add(points)
    this.items.push({
      type: 'collect',
      group,
      age: 0,
      life: 0.9,
      update(dt) {
        this.age += dt
        const t = this.age / this.life
        const attr = geo.attributes.position
        for (let i = 0; i < count; i++) {
          const v = velocities[i]
          attr.setXYZ(i, attr.getX(i) + v.x * dt, attr.getY(i) + v.y * dt, attr.getZ(i) + v.z * dt)
        }
        attr.needsUpdate = true
        mat.opacity = Math.max(0, 1 - t)
      }
    })
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]
      item.update(dt)
      if (item.age >= item.life) {
        this.group.remove(item.group)
        item.group.traverse((child) => {
          child.geometry?.dispose?.()
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.())
            else child.material.dispose?.()
          }
        })
        this.items.splice(i, 1)
      }
    }
  }

  clear() {
    for (const item of this.items) {
      this.group.remove(item.group)
      item.group.traverse((child) => {
        child.geometry?.dispose?.()
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.())
          else child.material.dispose?.()
        }
      })
    }
    this.items.length = 0
  }
}
