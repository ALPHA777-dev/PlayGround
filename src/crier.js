import * as THREE from 'three'
import { makeClothTexture, makeGlowTexture, makeStoneTexture } from './textures.js'

const UP = new THREE.Vector3(0, 1, 0)

function capsuleBetween(a, b, radius, material) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.001, len - radius * 2), 5, 10), material)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize())
  mesh.castShadow = true
  return mesh
}

function makeCapeGeometry() {
  const segments = 72
  const rows = [
    { y: 1.78, r: 0.52 },
    { y: 1.52, r: 0.67 },
    { y: 1.16, r: 0.82 },
    { y: 0.72, r: 1.02 },
    { y: 0.28, r: 1.14 }
  ]
  const positions = []
  const uvs = []
  const indices = []
  const opening = 0.72
  for (let row = 0; row < rows.length; row++) {
    const { y, r } = rows[row]
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const angle = opening + t * (Math.PI * 2 - opening * 2)
      const wob = Math.sin(t * Math.PI * 9 + row) * 0.04 * row
      const tatter = row === rows.length - 1 ? (Math.sin(t * 57.3) * 0.5 + 0.5) * 0.48 + Math.sin(t * 23) * 0.13 : 0
      positions.push(Math.cos(angle) * (r + wob), y - tatter, Math.sin(angle) * (r + wob))
      uvs.push(t, 1 - row / (rows.length - 1))
    }
  }
  for (let row = 0; row < rows.length - 1; row++) {
    for (let i = 0; i < segments; i++) {
      const a = row * (segments + 1) + i
      const b = a + 1
      const c = a + segments + 1
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function makeTail(points, baseRadius, material, phase) {
  const group = new THREE.Group()
  const spheres = []
  const curve = new THREE.CatmullRomCurve3(points)
  for (let i = 0; i < 18; i++) {
    const t = i / 17
    const p = curve.getPoint(t)
    const r = THREE.MathUtils.lerp(baseRadius, 0.035, Math.pow(t, 0.72))
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), material)
    mesh.position.copy(p)
    mesh.castShadow = true
    group.add(mesh)
    spheres.push({ mesh, t })
  }
  group.userData = { phase, spheres, base: points.map((p) => p.clone()) }
  return group
}

function makeArm(side, white, bone) {
  const arm = new THREE.Group()
  arm.position.set(side * 0.56, 1.72, 0.02)
  arm.rotation.z = side * -0.38
  arm.rotation.x = -0.28

  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.34, 5, 10), white)
  upper.position.set(side * 0.19, -0.2, 0.02)
  upper.rotation.z = side * 0.38
  upper.castShadow = true
  arm.add(upper)

  const hand = new THREE.Group()
  hand.position.set(side * 0.39, -0.45, 0.12)
  hand.rotation.z = side * -0.15
  arm.add(hand)

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), white)
  palm.scale.set(1, 0.92, 0.72)
  palm.castShadow = true
  hand.add(palm)

  const fingerGeo = new THREE.CapsuleGeometry(0.044, 0.15, 4, 8)
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(fingerGeo, white)
    const a = (i - 1.5) * 0.34
    f.position.set(Math.sin(a) * 0.16, 0.02 + Math.cos(a) * 0.08, 0.075)
    f.rotation.z = -a * 0.72
    f.rotation.x = 0.18
    f.castShadow = true
    hand.add(f)
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.13, 4, 8), white)
  thumb.position.set(side * -0.13, -0.02, 0.08)
  thumb.rotation.z = side * 1.05
  hand.add(thumb)

  arm.userData = { side, hand, upper }
  return arm
}

export function createCrier() {
  const root = new THREE.Group()
  root.name = 'crier'

  const white = new THREE.MeshStandardMaterial({
    color: 0xf2f1ea,
    roughness: 0.48,
    metalness: 0,
    emissive: 0x101b25,
    emissiveIntensity: 0.55
  })
  const clothTex = makeClothTexture()
  const cloth = new THREE.MeshStandardMaterial({
    color: 0x0c0c10,
    roughness: 0.91,
    metalness: 0.02,
    map: clothTex,
    bumpMap: clothTex,
    bumpScale: 0.025,
    side: THREE.DoubleSide
  })
  const clothInner = cloth.clone()
  clothInner.color.setHex(0x141419)
  const iron = new THREE.MeshStandardMaterial({ color: 0x2b2c31, roughness: 0.36, metalness: 0.9 })
  const black = new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 0.72 })
  const redEye = new THREE.MeshStandardMaterial({
    color: 0xff2438,
    emissive: 0xff0718,
    emissiveIntensity: 4.6,
    roughness: 0.22,
    metalness: 0.15
  })
  const redInner = new THREE.MeshStandardMaterial({
    color: 0x6d0710,
    emissive: 0xff1020,
    emissiveIntensity: 1.35,
    roughness: 0.5
  })
  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xd9d2c3,
    roughness: 0.58,
    metalness: 0.05,
    bumpMap: makeStoneTexture(),
    bumpScale: 0.008
  })
  const fangMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e4, roughness: 0.32 })

  const bodyGroup = new THREE.Group()
  root.add(bodyGroup)

  const lathePoints = []
  const profile = [
    [0.0, 0.96],
    [0.27, 0.9],
    [0.43, 0.78],
    [0.54, 0.6],
    [0.58, 0.35],
    [0.575, 0.08],
    [0.54, -0.18],
    [0.47, -0.42],
    [0.36, -0.63],
    [0.25, -0.8],
    [0.17, -0.92]
  ]
  for (const [r, y] of profile) lathePoints.push(new THREE.Vector2(r, y))
  const body = new THREE.Mesh(new THREE.LatheGeometry(lathePoints, 40), white)
  body.position.y = 1.18
  body.castShadow = true
  body.receiveShadow = true
  bodyGroup.add(body)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.635, 40, 30), white)
  head.position.set(0, 1.93, 0.02)
  head.scale.set(1, 1.05, 0.96)
  head.castShadow = true
  head.receiveShadow = true
  bodyGroup.add(head)

  const tailL = makeTail([
    new THREE.Vector3(-0.12, 0.42, -0.02),
    new THREE.Vector3(-0.24, 0.18, 0.08),
    new THREE.Vector3(-0.34, -0.12, 0.18),
    new THREE.Vector3(-0.55, -0.34, 0.3),
    new THREE.Vector3(-0.52, -0.52, 0.54)
  ], 0.17, white, 0.2)
  const tailR = makeTail([
    new THREE.Vector3(0.12, 0.42, -0.02),
    new THREE.Vector3(0.3, 0.2, 0.02),
    new THREE.Vector3(0.42, -0.1, 0.1),
    new THREE.Vector3(0.66, -0.3, 0.16),
    new THREE.Vector3(0.86, -0.42, 0.34)
  ], 0.16, white, Math.PI)
  bodyGroup.add(tailL, tailR)

  const cape = new THREE.Mesh(makeCapeGeometry(), cloth)
  cape.position.y = 0.04
  cape.castShadow = true
  bodyGroup.add(cape)

  const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), cloth)
  shoulderL.position.set(-0.62, 1.76, -0.02)
  shoulderL.scale.set(1, 0.78, 1.1)
  const shoulderR = shoulderL.clone()
  shoulderR.position.x = 0.62
  bodyGroup.add(shoulderL, shoulderR)

  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.83, 40, 24, Math.PI * 0.5 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.79),
    cloth
  )
  hood.position.set(0, 1.95, -0.01)
  hood.scale.set(1.02, 1.14, 1.06)
  hood.castShadow = true
  bodyGroup.add(hood)

  const hoodTop = new THREE.Mesh(new THREE.SphereGeometry(0.43, 22, 16), cloth)
  hoodTop.position.set(0, 2.52, -0.16)
  hoodTop.scale.set(1.04, 1.05, 0.92)
  hoodTop.castShadow = true
  bodyGroup.add(hoodTop)

  const hoodInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 36, 22, Math.PI * 0.5 + 1.0, Math.PI * 2 - 2.0, 0, Math.PI * 0.78),
    clothInner
  )
  hoodInner.position.set(0, 1.95, -0.005)
  hoodInner.scale.set(0.98, 1.11, 1.02)
  bodyGroup.add(hoodInner)

  const rimMat = new THREE.MeshStandardMaterial({ color: 0x16161c, roughness: 0.85 })
  for (const side of [-1, 1]) {
    const a = new THREE.Vector3(side * 0.57, 2.44, 0.39)
    const b = new THREE.Vector3(side * 0.78, 1.86, 0.28)
    const c = new THREE.Vector3(side * 0.64, 1.48, 0.34)
    bodyGroup.add(capsuleBetween(a, b, 0.045, rimMat), capsuleBetween(b, c, 0.04, rimMat))
  }

  const face = new THREE.Group()
  face.position.set(0, 1.93, 0)
  bodyGroup.add(face)

  const eyeGroups = []
  for (const side of [-1, 1]) {
    const eye = new THREE.Group()
    eye.position.set(side * 0.235, 0.075, 0.53)
    eye.rotation.z = side * 0.18
    face.add(eye)

    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.215, 24, 18), black)
    socket.scale.set(1, 1.18, 0.28)
    eye.add(socket)

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.145, 22, 18), redEye)
    iris.position.z = 0.075
    iris.scale.set(1, 1.14, 0.62)
    eye.add(iris)

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), black)
    pupil.position.set(0, 0.005, 0.143)
    pupil.scale.set(0.8, 1.2, 0.4)
    eye.add(pupil)

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }))
    glint.position.set(side * 0.046, 0.07, 0.155)
    eye.add(glint)

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: 0xff1b2f,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.6
    }))
    glow.scale.set(0.95, 0.95, 1)
    glow.position.z = 0.18
    eye.add(glow)

    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.28, 4, 8), black)
    brow.rotation.z = Math.PI / 2 + side * 0.46
    brow.position.set(side * 0.245, 0.285, 0.5)
    brow.scale.set(1, 1, 0.7)
    face.add(brow)

    eyeGroups.push({ eye, iris, glint, glow, brow })
  }

  const mouth = new THREE.Group()
  mouth.position.set(0, -0.32, 0.535)
  face.add(mouth)

  const mouthDark = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), black)
  mouthDark.scale.set(1, 0.72, 0.15)
  mouth.add(mouthDark)
  const mouthRed = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), redInner)
  mouthRed.position.z = 0.035
  mouthRed.scale.set(1, 0.6, 0.1)
  mouth.add(mouthRed)
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), redInner)
  tongue.position.set(0, -0.1, 0.06)
  tongue.scale.set(1.1, 0.55, 0.35)
  mouth.add(tongue)

  for (const side of [-1, 1]) {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.11, 8), fangMat)
    fang.position.set(side * 0.145, 0.06, 0.08)
    fang.rotation.z = side * 0.08
    mouth.add(fang)
    const fang2 = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.075, 8), fangMat)
    fang2.position.set(side * 0.08, -0.09, 0.085)
    fang2.rotation.z = Math.PI + side * 0.05
    mouth.add(fang2)
  }

  const necklaces = new THREE.Group()
  const linkGeo = new THREE.TorusGeometry(0.034, 0.008, 5, 9)
  const linkMatrix = new THREE.Matrix4()
  const links = new THREE.InstancedMesh(linkGeo, iron, 34)
  for (let i = 0; i < 34; i++) {
    const t = i / 33
    const a = Math.PI * (1 - t)
    const x = Math.cos(a) * 0.46
    const z = Math.sin(a) * 0.49 + 0.06
    const y = 1.55 - Math.sin(a) * 0.19
    linkMatrix.makeRotationY(a + Math.PI / 2)
    linkMatrix.setPosition(x, y, z)
    links.setMatrixAt(i, linkMatrix)
  }
  links.castShadow = true
  necklaces.add(links)

  const skull = new THREE.Group()
  skull.position.set(0, 1.27, 0.53)
  const skullHead = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), boneMat)
  skullHead.scale.set(0.92, 1.05, 0.88)
  skull.add(skullHead)
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.09), boneMat)
  jaw.position.set(0, -0.105, 0.01)
  skull.add(jaw)
  for (const side of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), redEye)
    socket.position.set(side * 0.043, 0.011, 0.09)
    socket.scale.set(1, 1.15, 0.5)
    skull.add(socket)
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.035, 0.04), black)
    tooth.position.set(side * 0.035, -0.115, 0.035)
    skull.add(tooth)
  }
  necklaces.add(skull)
  bodyGroup.add(necklaces)

  const arms = [makeArm(-1, white, iron), makeArm(1, white, iron)]
  bodyGroup.add(arms[0], arms[1])

  const eyeLight = new THREE.PointLight(0xff1428, 1.4, 4.2, 2)
  eyeLight.position.set(0, 2.02, 0.82)
  root.add(eyeLight)

  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture([[0, 'rgba(150,190,255,0.24)'], [0.35, 'rgba(90,130,190,0.09)'], [1, 'rgba(0,0,0,0)']]),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0x9fc7ff,
    opacity: 0.7
  }))
  aura.scale.set(4.4, 4.4, 1)
  aura.position.y = 1.45
  root.add(aura)

  let blinkTimer = 2.5
  let blink = 0
  let screamT = 0
  let idleT = 0
  let moving = false
  let exposure = 0

  const state = {
    root,
    bodyGroup,
    setMoving(value) { moving = value },
    scream() { screamT = 1 },
    setExposure(value) { exposure = value },
    update(dt, time) {
      idleT += dt
      if (blinkTimer > 0) blinkTimer -= dt
      else {
        blink += dt * 14
        if (blink >= 1) {
          blink = 0
          blinkTimer = 2 + Math.random() * 4.5
        }
      }
      const blinkScale = blink > 0 ? Math.max(0.06, Math.abs(1 - blink * 2)) : 1 + Math.sin(time * 1.7) * 0.03

      screamT = Math.max(0, screamT - dt * 1.5)
      const scream = Math.sin(Math.min(1, (1 - screamT) * 2.2) * Math.PI) * (screamT > 0 ? 1 : 0)
      const screamEase = screamT > 0 ? Math.sin((1 - screamT) * Math.PI) : 0

      const bob = Math.sin(time * 1.75) * 0.075 + Math.sin(time * 0.63) * 0.025
      root.position.y = bob
      bodyGroup.position.y = moving ? Math.sin(time * 5.2) * 0.035 : 0
      bodyGroup.rotation.z = Math.sin(time * 1.23) * 0.028
      bodyGroup.rotation.x = THREE.MathUtils.lerp(bodyGroup.rotation.x, moving ? -0.1 : Math.sin(time * 0.7) * 0.018, 0.05)
      bodyGroup.rotation.y = Math.sin(time * 0.83) * 0.04

      hood.rotation.z = Math.sin(time * 0.9 + 1) * 0.012
      hoodInner.rotation.z = hood.rotation.z

      for (const { eye, iris, glow, brow } of eyeGroups) {
        eye.scale.y = THREE.MathUtils.lerp(eye.scale.y, blinkScale * (1 + screamEase * 0.22), 0.5)
        iris.scale.x = 1 + screamEase * 0.16 + exposure * 0.08
        iris.scale.y = 1.14 + screamEase * 0.2
        glow.material.opacity = 0.46 + Math.sin(time * 2.1) * 0.1 + screamEase * 0.7 + exposure * 0.4
        glow.scale.setScalar(0.9 + screamEase * 1.6 + Math.sin(time * 1.7) * 0.06)
        brow.rotation.x = Math.sin(time * 0.7) * 0.04 + screamEase * 0.3
      }

      mouth.scale.set(1 + screamEase * 0.18, 1 + screamEase * 0.85, 1)
      mouth.position.y = -0.32 - screamEase * 0.03
      tongue.position.y = -0.1 - screamEase * 0.025

      arms[0].rotation.z = -0.38 + Math.sin(time * 1.5 + 0.4) * 0.1 + screamEase * 0.8
      arms[1].rotation.z = 0.38 + Math.sin(time * 1.5 + Math.PI) * 0.1 - screamEase * 0.8
      arms[0].rotation.x = -0.28 + Math.sin(time * 1.2) * 0.06 - screamEase * 0.55
      arms[1].rotation.x = -0.28 + Math.sin(time * 1.2 + 1.3) * 0.06 - screamEase * 0.55
      arms[0].position.y = 1.72 + Math.sin(time * 1.8) * 0.045
      arms[1].position.y = 1.72 + Math.sin(time * 1.8 + 0.9) * 0.045
      for (const arm of arms) {
        for (const [i, child] of arm.userData.hand.children.entries()) {
          if (i === 0) continue
          child.rotation.x = 0.18 + Math.sin(time * 2.2 + i) * 0.05
        }
      }

      for (const tail of [tailL, tailR]) {
        const { phase, spheres, base } = tail.userData
        for (const { mesh, t } of spheres) {
          const p = base[Math.round(t * (base.length - 1))]
          const sway = Math.sin(time * 1.35 + phase + t * 2.8) * (0.035 + t * 0.07)
          mesh.position.set(p.x + sway, p.y + Math.sin(time * 1.1 + phase + t * 3.4) * 0.02 * t, p.z + Math.cos(time * 1.15 + phase + t * 2.2) * 0.04 * t)
        }
      }

      skull.rotation.z = Math.sin(time * 1.2) * 0.06
      skull.rotation.y = Math.sin(time * 0.8) * 0.15
      aura.material.opacity = 0.48 + Math.sin(time * 1.4) * 0.08 + screamEase * 0.4
      aura.scale.setScalar(4.3 + screamEase * 2.8)
      eyeLight.intensity = 1.2 + screamEase * 5 + exposure * 1.6
      eyeLight.position.z = 0.82 + screamEase * 0.25
      cape.rotation.z = Math.sin(time * 1.1) * 0.008
    }
  }
  return state
}
