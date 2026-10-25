import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  mulberry32,
  makeGrassTexture,
  makeGrassBump,
  makeDirtTexture,
  makeStoneTexture,
  makeStoneBump,
  makeBarkTexture,
  makeClothTexture,
  makeGlowTexture,
  makeFogTexture,
  makeMoonTexture,
  makeCloudTexture,
  makeGroundLightTexture,
  makeSignTexture
} from './textures.js'

const UP = new THREE.Vector3(0, 1, 0)
const NIGHT = {
  top: new THREE.Color(0x04060d),
  horizon: new THREE.Color(0x18242e),
  fog: new THREE.Color(0x0a1017),
  ambient: new THREE.Color(0x6f8ba8),
  groundLight: new THREE.Color(0x15131a),
  moon: new THREE.Color(0xaec8ff)
}
const DAWN = {
  top: new THREE.Color(0x2a1a3f),
  horizon: new THREE.Color(0xd66b44),
  fog: new THREE.Color(0x3b2b3c),
  ambient: new THREE.Color(0xffa273),
  groundLight: new THREE.Color(0x3b2a2b),
  moon: new THREE.Color(0xffb68f)
}

function makeSky() {
  const uniforms = {
    uTop: { value: NIGHT.top.clone() },
    uHorizon: { value: NIGHT.horizon.clone() },
    uGlow: { value: new THREE.Color(0x0b1220) },
    uMoonDir: { value: new THREE.Vector3(-0.35, 0.48, -0.8).normalize() },
    uTime: { value: 0 },
    uDawn: { value: 0 }
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform vec3 uMoonDir;
      uniform float uTime;
      uniform float uDawn;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
        float horizonBand = pow(1.0 - abs(d.y), 5.0);
        vec3 col = mix(uHorizon, uTop, smoothstep(0.48, 0.96, h));
        float moonGlow = pow(max(dot(d, normalize(uMoonDir)), 0.0), 24.0);
        col += uGlow * moonGlow * 1.6;
        col += uHorizon * horizonBand * (0.2 + uDawn * 0.65);
        float cloud = noise(vec2(atan(d.z, d.x) * 2.4 + uTime * 0.004, d.y * 7.0 + uTime * 0.008));
        cloud = smoothstep(0.58, 0.82, cloud) * smoothstep(0.02, 0.22, d.y) * (1.0 - smoothstep(0.5, 0.78, d.y));
        col += vec3(cloud) * (0.018 + uDawn * 0.06) * vec3(0.7, 0.8, 1.0);
        float grain = hash(gl_FragCoord.xy + uTime) - 0.5;
        col += grain * 0.008;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(260, 48, 32), material)
  mesh.renderOrder = -10
  mesh.frustumCulled = false
  return { mesh, uniforms }
}

function makeStars(rng) {
  const positions = []
  const colors = []
  const sizes = []
  for (let i = 0; i < 1300; i++) {
    const a = rng() * Math.PI * 2
    const y = 0.08 + Math.pow(rng(), 0.65) * 0.92
    const r = Math.sqrt(1 - y * y)
    const radius = 235
    positions.push(Math.cos(a) * r * radius, y * radius, Math.sin(a) * r * radius)
    const c = new THREE.Color().setHSL(0.56 + rng() * 0.1, 0.25 + rng() * 0.3, 0.62 + rng() * 0.35)
    colors.push(c.r, c.g, c.b)
    sizes.push(0.8 + rng() * 2.4)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
  const mat = new THREE.PointsMaterial({
    size: 1.7,
    map: makeGlowTexture(),
    transparent: true,
    opacity: 0.9,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    sizeAttenuation: true
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  return points
}

function makePath() {
  const points = [
    new THREE.Vector3(0.5, 0.022, 44),
    new THREE.Vector3(1.5, 0.022, 35),
    new THREE.Vector3(3.2, 0.022, 26),
    new THREE.Vector3(0.4, 0.022, 15),
    new THREE.Vector3(-2.4, 0.022, 3),
    new THREE.Vector3(-0.8, 0.022, -10),
    new THREE.Vector3(2.4, 0.022, -24),
    new THREE.Vector3(0, 0.022, -34)
  ]
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35)
  const pts = curve.getPoints(100)
  const positions = []
  const uvs = []
  const indices = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const t = curve.getTangent(i / (pts.length - 1)).setY(0).normalize()
    const n = new THREE.Vector3(-t.z, 0, t.x)
    const w = 2.4 + Math.sin(i * 0.42) * 0.5 + Math.sin(i * 0.13) * 0.35
    positions.push(p.x + n.x * w, p.y, p.z + n.z * w, p.x - n.x * w, p.y, p.z - n.z * w)
    uvs.push(0, i / 10, 1, i / 10)
    if (i < pts.length - 1) {
      const a = i * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({
    map: makeDirtTexture(),
    color: 0x8e806b,
    roughness: 0.94,
    metalness: 0.02
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  return { mesh, curve }
}

function buildTree(rng, scale) {
  const parts = []
  const start = new THREE.Vector3(0, 0, 0)
  const baseDir = new THREE.Vector3((rng() - 0.5) * 0.25, 1, (rng() - 0.5) * 0.25).normalize()

  function branch(startPos, dir, length, radius, depth) {
    const end = startPos.clone().addScaledVector(dir, length)
    const geo = new THREE.CylinderGeometry(radius * 0.62, radius, length, 6, 1, true)
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir)
    const mat = new THREE.Matrix4().compose(startPos.clone().add(end).multiplyScalar(0.5), quat, new THREE.Vector3(1, 1, 1))
    geo.applyMatrix4(mat)
    parts.push(geo)
    if (depth <= 0 || radius < 0.035) return
    const count = 2 + (rng() > 0.55 ? 1 : 0)
    for (let i = 0; i < count; i++) {
      const axis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize()
      const angle = 0.38 + rng() * 0.7
      const nd = dir.clone().applyAxisAngle(axis, angle)
      nd.y = Math.max(0.08, nd.y)
      nd.normalize()
      branch(end, nd, length * (0.55 + rng() * 0.18), radius * (0.55 + rng() * 0.12), depth - 1)
    }
  }

  branch(start, baseDir, 4.2 * scale, 0.48 * scale, 4)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng() * 0.5
    const dir = new THREE.Vector3(Math.cos(a) * 0.8, -0.15, Math.sin(a) * 0.8).normalize()
    branch(new THREE.Vector3(Math.cos(a) * 0.22, 0.08, Math.sin(a) * 0.22), dir, 1.2 * scale, 0.19 * scale, 1)
  }
  return mergeGeometries(parts)
}

function makeCrow(material) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), material)
  body.scale.set(0.8, 1.05, 1.55)
  body.position.y = 0.12
  group.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), material)
  head.position.set(0, 0.27, 0.15)
  group.add(head)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.17, 6), material)
  beak.rotation.x = Math.PI / 2
  beak.position.set(0, 0.26, 0.31)
  group.add(beak)
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 5), material)
  tail.rotation.x = -Math.PI / 2 + 0.3
  tail.position.set(0, 0.1, -0.3)
  group.add(tail)
  return group
}

function makeTombstoneGeometry(kind) {
  if (kind === 'cross') {
    const parts = [
      new THREE.BoxGeometry(0.16, 1.55, 0.22).translate(0, 0.83, 0),
      new THREE.BoxGeometry(0.86, 0.16, 0.2).translate(0, 1.18, 0)
    ]
    return mergeGeometries(parts)
  }
  if (kind === 'obelisk') {
    const parts = [
      new THREE.CylinderGeometry(0.07, 0.24, 2.1, 4).translate(0, 1.1, 0),
      new THREE.ConeGeometry(0.18, 0.36, 4).translate(0, 2.32, 0),
      new THREE.BoxGeometry(0.75, 0.18, 0.75).translate(0, 0.09, 0)
    ]
    return mergeGeometries(parts)
  }
  const w = kind === 'wide' ? 1.45 : 1.0
  const h = kind === 'wide' ? 1.2 : 1.52
  const shape = new THREE.Shape()
  shape.moveTo(-w / 2, 0)
  shape.lineTo(w / 2, 0)
  shape.lineTo(w / 2, h * 0.72)
  shape.quadraticCurveTo(w / 2, h, 0, h)
  shape.quadraticCurveTo(-w / 2, h, -w / 2, h * 0.72)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.045,
    bevelThickness: 0.045,
    curveSegments: 8
  })
  geo.translate(0, 0.1, -0.11)
  return geo
}

function makePumpkin(rng, withFace) {
  const group = new THREE.Group()
  const geo = new THREE.SphereGeometry(0.55, 30, 20)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const a = Math.atan2(z, x)
    const ridge = 1 + Math.cos(a * 10) * 0.038
    pos.setXYZ(i, x * ridge, y * 0.82, z * ridge)
  }
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({ color: 0xc7611d, roughness: 0.58, metalness: 0.02 })
  const body = new THREE.Mesh(geo, mat)
  body.position.y = 0.42
  body.castShadow = true
  group.add(body)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x324127, roughness: 0.9 }))
  stem.position.y = 0.93
  stem.rotation.z = 0.12
  group.add(stem)
  if (withFace) {
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xffb14a, emissive: 0xff7a14, emissiveIntensity: 2.6, roughness: 0.6 })
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 3), faceMat)
      eye.rotation.z = side * 0.2
      eye.rotation.x = -0.1
      eye.position.set(side * 0.22, 0.5, 0.44)
      group.add(eye)
    }
    const mouth = new THREE.Group()
    const mouthMat = faceMat
    for (let i = 0; i < 5; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 3), mouthMat)
      tooth.rotation.x = Math.PI
      tooth.position.set((i - 2) * 0.1, 0.26 + Math.abs(i - 2) * 0.012, 0.48)
      mouth.add(tooth)
    }
    group.add(mouth)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: 0xff8b32,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }))
    glow.scale.set(1.7, 1.7, 1)
    glow.position.set(0, 0.45, 0.42)
    group.add(glow)
  }
  group.rotation.y = rng() * Math.PI * 2
  const scale = 0.65 + rng() * 0.65
  group.scale.setScalar(scale)
  return group
}

function makeLanternPost(stoneMat, metalMat, warmMat, rng) {
  const group = new THREE.Group()
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.37, 0.32, 8), stoneMat)
  base.position.y = 0.16
  group.add(base)
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 2.65, 8), metalMat)
  post.position.y = 1.5
  group.add(post)
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), metalMat)
  finial.position.y = 2.85
  group.add(finial)
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 6, 14, Math.PI / 2), metalMat)
  arm.rotation.z = Math.PI / 2
  arm.rotation.y = Math.PI / 2
  arm.position.set(0, 2.62, -0.3)
  group.add(arm)
  const cage = new THREE.Group()
  cage.position.set(0, 2.3, -0.6)
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 0.32), warmMat)
  cage.add(glass)
  for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.035), metalMat)
    bar.position.set(x, 0, z)
    cage.add(bar)
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.2, 4), metalMat)
  cap.position.y = 0.31
  cap.rotation.y = Math.PI / 4
  cage.add(cap)
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.36), metalMat)
  bottom.position.y = -0.24
  cage.add(bottom)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: 0xffad5d,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }))
  glow.scale.set(2.3, 2.3, 1)
  cage.add(glow)
  const light = new THREE.PointLight(0xffa759, 7.5, 9, 2)
  light.position.y = 0.03
  light.castShadow = false
  cage.add(light)
  group.add(cage)

  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({
      map: makeGroundLightTexture(),
      color: 0xff9f4e,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  )
  pool.rotation.x = -Math.PI / 2
  pool.position.y = 0.025
  group.add(pool)

  group.userData = { light, glow, glass, baseIntensity: 6.5 + rng() * 2.5, phase: rng() * 10, pool }
  return group
}

function makeMausoleum(stoneMat) {
  const group = new THREE.Group()
  const base = new THREE.Mesh(new THREE.BoxGeometry(11, 0.55, 7.5), stoneMat)
  base.position.y = 0.275
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(9.2 - i * 0.7, 0.18, 0.9), stoneMat)
    step.position.set(0, 0.1 + i * 0.18, 3.9 - i * 0.3)
    group.add(step)
  }
  const hall = new THREE.Mesh(new THREE.BoxGeometry(8.6, 4.1, 5.7), stoneMat)
  hall.position.y = 2.6
  hall.castShadow = true
  hall.receiveShadow = true
  group.add(hall)
  const roofShape = new THREE.Shape()
  roofShape.moveTo(-5.1, 0)
  roofShape.lineTo(5.1, 0)
  roofShape.lineTo(0, 2.6)
  roofShape.closePath()
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 6.6, bevelEnabled: false })
  roofGeo.translate(0, 0, -3.3)
  const roof = new THREE.Mesh(roofGeo, stoneMat)
  roof.position.y = 4.63
  roof.castShadow = true
  group.add(roof)
  for (const side of [-1, 1]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 4.1, 10), stoneMat)
    column.position.set(side * 3.2, 2.55, 3.0)
    column.castShadow = true
    group.add(column)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.9), stoneMat)
    cap.position.set(side * 3.2, 4.65, 3.0)
    group.add(cap)
  }
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.3, 0.3), stoneMat)
  doorFrame.position.set(0, 1.9, 2.92)
  group.add(doorFrame)
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x0a0b0d, emissive: 0x2c0c08, emissiveIntensity: 0.7, roughness: 0.8 })
  )
  door.position.set(0, 1.75, 3.1)
  group.add(door)
  const innerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: 0xff5b2e,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }))
  innerGlow.scale.set(3.2, 3.8, 1)
  innerGlow.position.set(0, 1.9, 3.4)
  group.add(innerGlow)
  const light = new THREE.PointLight(0xff5a2d, 4, 11, 2)
  light.position.set(0, 2, 4.6)
  group.add(light)
  const name = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.3),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('HOLLOW', 'HILL'), transparent: true, opacity: 0.7 })
  )
  name.position.set(0, 4.15, 3.12)
  group.add(name)
  return group
}

function makeManor() {
  const group = new THREE.Group()
  const wall = new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: 0.95 })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x080a0e, roughness: 0.9 })
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffa75a, toneMapped: false })
  const core = new THREE.Mesh(new THREE.BoxGeometry(28, 15, 13), wall)
  core.position.y = 7.5
  group.add(core)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(19, 7, 4), roofMat)
  roof.position.y = 18
  roof.rotation.y = Math.PI / 4
  roof.scale.z = 0.62
  group.add(roof)
  for (const x of [-14, 14]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.0, 24, 8), wall)
    tower.position.set(x, 12, 0)
    group.add(tower)
    const top = new THREE.Mesh(new THREE.ConeGeometry(4.4, 8, 8), roofMat)
    top.position.set(x, 28, 0)
    group.add(top)
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.7), windowMat)
      win.position.set(x, 14 + i * 4.3, 3.35)
      win.rotation.y = 0.02
      group.add(win)
    }
  }
  for (let i = 0; i < 8; i++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.0), windowMat)
    win.position.set(-10 + i * 2.85, 8 + (i % 3) * 3.2, 6.52)
    group.add(win)
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.4), windowMat)
  door.position.set(0, 3.2, 6.52)
  group.add(door)
  group.position.set(0, 0, -78)
  return group
}

function makeAngel(stoneMat, metalMat) {
  const group = new THREE.Group()
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 1.5, 10), stoneMat)
  pedestal.position.y = 0.75
  group.add(pedestal)
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.95, 3.0, 10), stoneMat)
  robe.position.y = 3.2
  group.add(robe)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), stoneMat)
  head.position.y = 4.9
  group.add(head)
  for (const side of [-1, 1]) {
    const wingShape = new THREE.Shape()
    wingShape.moveTo(0, 0)
    wingShape.quadraticCurveTo(side * 1.9, 1.4, side * 1.5, 2.9)
    wingShape.quadraticCurveTo(side * 0.8, 1.7, 0, 1.2)
    wingShape.closePath()
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, { depth: 0.13, bevelEnabled: false }), stoneMat)
    wing.position.set(side * 0.2, 3.8, -0.2)
    wing.rotation.y = side * 0.2
    group.add(wing)
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 6, 20), metalMat)
  halo.position.y = 5.35
  halo.rotation.x = Math.PI / 2
  group.add(halo)
  return group
}

export async function createWorld(scene, renderer, { mobile = false } = {}) {
  const rng = mulberry32(7731)
  const colliders = []
  const animated = []
  const lanterns = []
  const flickerLights = []
  const wisps = []

  const world = new THREE.Group()
  scene.add(world)

  const sky = makeSky()
  scene.add(sky.mesh)
  const stars = makeStars(rng)
  scene.add(stars)

  const moonTex = makeMoonTexture()
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, fog: false, toneMapped: false, depthWrite: false }))
  moon.position.set(-54, 47, -145)
  moon.scale.set(23, 23, 1)
  scene.add(moon)
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture([[0, 'rgba(200,225,255,0.75)'], [0.25, 'rgba(130,170,230,0.2)'], [1, 'rgba(0,0,0,0)']]),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  }))
  moonGlow.position.copy(moon.position)
  moonGlow.scale.set(70, 70, 1)
  scene.add(moonGlow)

  const clouds = []
  const cloudTex = makeCloudTexture()
  for (let i = 0; i < 7; i++) {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex,
      color: 0x182437,
      transparent: true,
      opacity: 0.35 + rng() * 0.25,
      depthWrite: false,
      fog: false
    }))
    cloud.position.set(-95 + rng() * 190, 42 + rng() * 30, -105 - rng() * 40)
    cloud.scale.set(50 + rng() * 55, 18 + rng() * 16, 1)
    cloud.userData = { speed: 0.35 + rng() * 0.5, sway: rng() * 10 }
    clouds.push(cloud)
    scene.add(cloud)
  }

  const hemi = new THREE.HemisphereLight(0x6f8ba8, 0x15131a, 0.55)
  scene.add(hemi)
  const moonLight = new THREE.DirectionalLight(0xaec8ff, 1.25)
  moonLight.position.set(-38, 54, -24)
  moonLight.castShadow = true
  const shadowSize = mobile ? 1024 : 2048
  moonLight.shadow.mapSize.set(shadowSize, shadowSize)
  moonLight.shadow.camera.left = -46
  moonLight.shadow.camera.right = 46
  moonLight.shadow.camera.top = 46
  moonLight.shadow.camera.bottom = -46
  moonLight.shadow.camera.near = 1
  moonLight.shadow.camera.far = 120
  moonLight.shadow.bias = -0.0004
  moonLight.shadow.normalBias = 0.035
  scene.add(moonLight)
  const fill = new THREE.DirectionalLight(0x3b5f7c, 0.32)
  fill.position.set(30, 18, 35)
  scene.add(fill)
  scene.add(new THREE.AmbientLight(0x1e2a38, 0.5))

  const grassTex = makeGrassTexture()
  const grassBump = makeGrassBump()
  const groundMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    bumpMap: grassBump,
    bumpScale: 0.055,
    color: 0x9da689,
    roughness: 0.97,
    metalness: 0
  })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120, 1, 1), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  world.add(ground)

  const path = makePath()
  world.add(path.mesh)

  const stoneTex = makeStoneTexture()
  const stoneBump = makeStoneBump()
  const stoneMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    bumpMap: stoneBump,
    bumpScale: 0.05,
    color: 0x6e7168,
    roughness: 0.88,
    metalness: 0.02
  })
  const darkStoneMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    bumpMap: stoneBump,
    bumpScale: 0.04,
    color: 0x464b46,
    roughness: 0.92
  })
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.42, metalness: 0.82 })
  const barkTex = makeBarkTexture()
  const barkMat = new THREE.MeshStandardMaterial({ map: barkTex, color: 0x3c2f26, roughness: 0.95, metalness: 0.02 })
  const warmMat = new THREE.MeshStandardMaterial({
    color: 0xffd9a0,
    emissive: 0xff9a3d,
    emissiveIntensity: 3.4,
    roughness: 0.4
  })
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.7 })

  const grass = makeGrassBlades(rng)
  world.add(grass.mesh)

  const tombKinds = ['round', 'round', 'wide', 'cross', 'obelisk']
  const tombGeos = new Map()
  for (const kind of tombKinds) tombGeos.set(kind, makeTombstoneGeometry(kind))
  const graves = new THREE.Group()
  world.add(graves)
  const occupied = []
  let attempts = 0
  while (occupied.length < 46 && attempts < 900) {
    attempts++
    const side = rng() > 0.5 ? 1 : -1
    const x = side * (8 + rng() * 27)
    let z = -33 + rng() * 68
    if (Math.abs(x) < 12 && Math.abs(z) > 20) z += 8
    if (Math.abs(x - pathAt(z).x) < 6.5) continue
    if (occupied.some((p) => Math.hypot(p.x - x, p.z - z) < 4.2)) continue
    occupied.push({ x, z })
    const kind = tombKinds[(rng() * tombKinds.length) | 0]
    const geo = tombGeos.get(kind)
    const mesh = new THREE.Mesh(geo, kind === 'cross' || kind === 'obelisk' ? stoneMat : darkStoneMat)
    mesh.position.set(x, 0.02, z)
    mesh.rotation.y = (rng() - 0.5) * 0.3
    mesh.rotation.z = (rng() - 0.5) * 0.08
    mesh.rotation.x = (rng() - 0.5) * 0.04
    mesh.scale.setScalar(0.8 + rng() * 0.55)
    mesh.castShadow = true
    mesh.receiveShadow = true
    graves.add(mesh)
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 1.1), stoneMat)
    base.position.set(x, 0.06, z)
    base.scale.setScalar(0.8 + rng() * 0.5)
    base.rotation.y = mesh.rotation.y
    base.receiveShadow = true
    graves.add(base)
    colliders.push({ x, z, r: kind === 'wide' ? 1.0 : 0.65 })
    if (rng() > 0.65) {
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x1a2217, roughness: 1 })
      )
      mound.scale.set(1.05, 0.18, 0.6)
      mound.position.set(x, 0.01, z + 0.75)
      mound.receiveShadow = true
      graves.add(mound)
    }
  }

  const treePositions = [
    [-30, 31, 1.15], [27, 26, 1.05], [-34, 8, 1.3], [-24, -13, 0.95], [31, -4, 1.2],
    [19, -28, 1.0], [-17, -31, 1.25], [37, 37, 0.9], [12, 33, 0.82], [-38, -22, 1.1]
  ]
  for (const [x, z, scale] of treePositions) {
    const geo = buildTree(rng, scale)
    const tree = new THREE.Mesh(geo, barkMat)
    tree.position.set(x, 0, z)
    tree.rotation.y = rng() * Math.PI * 2
    tree.castShadow = true
    tree.receiveShadow = true
    world.add(tree)
    colliders.push({ x, z, r: 0.9 * scale })
    if (rng() > 0.35) {
      const crow = makeCrow(blackMat)
      crow.position.set(x + 1.2 * scale, 4.0 * scale, z + 0.4 * scale)
      crow.rotation.y = rng() * Math.PI * 2
      crow.userData.phase = rng() * 10
      world.add(crow)
      animated.push((dt, t) => {
        crow.position.y = 4.0 * scale + Math.sin(t * 0.6 + crow.userData.phase) * 0.02
      })
    }
  }
  const distantTrees = new THREE.Group()
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2
    const r = 58 + rng() * 28
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (z > 20 && Math.abs(x) < 20) continue
    const tree = new THREE.Mesh(new THREE.ConeGeometry(3 + rng() * 4, 15 + rng() * 14, 5), new THREE.MeshStandardMaterial({ color: 0x070b0d, roughness: 1 }))
    tree.position.set(x, 6, z)
    distantTrees.add(tree)
  }
  world.add(distantTrees)

  const wallSegments = []
  const wallGroup = new THREE.Group()
  const baseMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x4c504b, roughness: 0.95, bumpMap: stoneBump, bumpScale: 0.04 })
  const railGeo = new THREE.BoxGeometry(8, 0.07, 0.07)
  const picketParts = []
  const bar = new THREE.BoxGeometry(0.055, 1.7, 0.055).translate(0, 0.85, 0)
  const tip = new THREE.ConeGeometry(0.09, 0.2, 4).translate(0, 1.8, 0).rotateY(Math.PI / 4)
  picketParts.push(bar, tip)
  const picketGeo = mergeGeometries(picketParts)
  const picketPositions = []
  for (const side of [-1, 1]) {
    for (let z = -44; z <= 44; z += 1.15) {
      if (z > 38) continue
      picketPositions.push([side * 45, z, Math.PI / 2])
    }
    for (let x = -44; x <= 44; x += 1.15) {
      picketPositions.push([x, side * 45, 0])
    }
  }
  picketPositions.push([-4.3, 44.2, Math.PI / 2], [4.3, 44.2, Math.PI / 2])
  const pickets = new THREE.InstancedMesh(picketGeo, metalMat, picketPositions.length)
  const dummy = new THREE.Object3D()
  picketPositions.forEach(([x, z, ry], i) => {
    dummy.position.set(x, 0.38, z)
    dummy.rotation.set(0, ry, 0)
    dummy.updateMatrix()
    pickets.setMatrixAt(i, dummy.matrix)
  })
  pickets.castShadow = true
  wallGroup.add(pickets)
  for (const [x, z, ry, len] of [[0, -45, 0, 90], [-45, 0, Math.PI / 2, 90], [45, 0, Math.PI / 2, 90], [0, 45, 0, 9]]) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(len, 0.65, 0.45), baseMat)
    base.position.set(x, 0.32, z)
    base.rotation.y = ry
    base.castShadow = true
    base.receiveShadow = true
    wallGroup.add(base)
    for (const y of [0.82, 1.85]) {
      const rail = new THREE.Mesh(railGeo, metalMat)
      rail.scale.x = len / 8
      rail.position.set(x, y, z)
      rail.rotation.y = ry
      if (len < 20 && z > 0) rail.position.x = 0
      wallGroup.add(rail)
    }
  }
  for (let x = -44; x <= 44; x += 4.4) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.23, 2.35, 0.23), metalMat)
    post.position.set(x, 1.18, -45)
    wallGroup.add(post)
  }
  for (const x of [-45, 45]) {
    for (let z = -44; z <= 44; z += 4.4) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.23, 2.35, 0.23), metalMat)
      post.position.set(x, 1.18, z)
      wallGroup.add(post)
    }
  }
  world.add(wallGroup)

  for (const [x, z] of [[-4.3, 44], [4.3, 44]]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.7, 1.2), stoneMat)
    pillar.position.set(x, 1.85, z)
    pillar.castShadow = true
    world.add(pillar)
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), stoneMat)
    top.position.set(x, 3.9, z)
    world.add(top)
    colliders.push({ x, z, r: 0.9 })
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.55, 0.16, 8, 24, Math.PI), metalMat)
  arch.position.set(0, 3.4, 44)
  arch.rotation.z = Math.PI
  world.add(arch)
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 1.9),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('HOLLOW HILL', 'EST. 1666'), transparent: true, side: THREE.DoubleSide })
  )
  sign.position.set(0, 4.9, 43.9)
  sign.rotation.y = Math.PI
  world.add(sign)

  const mausoleum = makeMausoleum(stoneMat)
  mausoleum.position.set(0, 0, -38)
  world.add(mausoleum)
  colliders.push({ x: 0, z: -38, r: 6.2 })
  const manor = makeManor()
  scene.add(manor)
  const angel = makeAngel(stoneMat, metalMat)
  angel.position.set(-13, 0, -31)
  angel.rotation.y = 0.3
  world.add(angel)
  colliders.push({ x: -13, z: -31, r: 1.6 })

  const lanternPositions = [[-10, 31], [10, 28], [-18, 13], [17, 11], [-13, -5], [14, -15], [-9, -27], [20, -28]]
  for (const [x, z] of lanternPositions) {
    const lantern = makeLanternPost(stoneMat, metalMat, warmMat, rng)
    lantern.position.set(x, 0, z)
    lantern.rotation.y = rng() * Math.PI * 2
    world.add(lantern)
    lanterns.push(lantern)
    colliders.push({ x, z, r: 0.55 })
    if (flickerLights.length < (mobile ? 4 : 6)) flickerLights.push(lantern.userData)
  }

  const pumpkinPositions = [
    [-6.5, 25, true], [7.5, 21, true], [-15, 5, false], [19, 3, true], [-20, -18, false],
    [10, -30, true], [26, 15, false], [-27, 24, false], [31, -16, false], [-8, 37, true]
  ]
  for (const [x, z, face] of pumpkinPositions) {
    const pumpkin = makePumpkin(rng, face)
    pumpkin.position.set(x, 0, z)
    world.add(pumpkin)
    colliders.push({ x, z, r: 0.5 })
  }

  const benchPositions = [[-6.4, 8, 0.3], [7.8, -6, -0.4], [-10.5, -22, 0.2]]
  for (const [x, z, ry] of benchPositions) {
    const bench = new THREE.Group()
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.6), darkStoneMat)
    seat.position.y = 0.62
    bench.add(seat)
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.5), darkStoneMat)
      leg.position.set(side * 0.85, 0.3, 0)
      bench.add(leg)
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 0.12), darkStoneMat)
    back.position.set(0, 1.0, -0.25)
    bench.add(back)
    bench.position.set(x, 0, z)
    bench.rotation.y = ry
    bench.castShadow = true
    world.add(bench)
    colliders.push({ x, z, r: 1.2 })
  }

  for (let i = 0; i < 60; i++) {
    const x = (rng() - 0.5) * 84
    const z = (rng() - 0.5) * 84
    if (Math.abs(x - pathAt(z).x) < 4) continue
    const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + rng() * 0.16, 0), stoneMat)
    pebble.position.set(x, 0.06, z)
    pebble.rotation.set(rng() * 3, rng() * 3, rng() * 3)
    pebble.scale.y = 0.55
    world.add(pebble)
  }

  const fogTex = makeFogTexture()
  const fogSheets = []
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: fogTex,
      color: 0x86a2b8,
      transparent: true,
      opacity: 0.16 - i * 0.025,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      fog: false
    })
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(115, 115), mat)
    plane.rotation.x = -Math.PI / 2
    plane.position.y = 0.32 + i * 0.38
    plane.renderOrder = 2
    world.add(plane)
    fogSheets.push({ plane, mat, speed: 0.004 + i * 0.002, phase: rng() * 10 })
  }
  const fogSprites = []
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2
    const r = 12 + rng() * 38
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fogTex,
      color: 0x6c8da2,
      transparent: true,
      opacity: 0.10 + rng() * 0.07,
      depthWrite: false,
      fog: false
    }))
    sprite.position.set(Math.cos(a) * r, 0.7 + rng() * 1.6, Math.sin(a) * r)
    sprite.scale.set(18 + rng() * 18, 7 + rng() * 6, 1)
    sprite.userData = { baseX: sprite.position.x, baseZ: sprite.position.z, phase: rng() * 10, speed: 0.02 + rng() * 0.04 }
    world.add(sprite)
    fogSprites.push(sprite)
  }

  const fireflyCount = mobile ? 90 : 150
  const fireflyPositions = new Float32Array(fireflyCount * 3)
  const fireflyBase = []
  for (let i = 0; i < fireflyCount; i++) {
    const x = (rng() - 0.5) * 76
    const z = (rng() - 0.5) * 76
    const y = 0.4 + rng() * 3.6
    fireflyBase.push({ x, y, z, phase: rng() * 10, speed: 0.15 + rng() * 0.35, amp: 0.2 + rng() * 0.65 })
    fireflyPositions[i * 3] = x
    fireflyPositions[i * 3 + 1] = y
    fireflyPositions[i * 3 + 2] = z
  }
  const fireflyGeo = new THREE.BufferGeometry()
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3))
  const fireflyMat = new THREE.PointsMaterial({
    size: 0.17,
    map: makeGlowTexture(),
    color: 0xffc276,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    fog: false,
    toneMapped: false
  })
  const fireflies = new THREE.Points(fireflyGeo, fireflyMat)
  scene.add(fireflies)

  const dustCount = mobile ? 220 : 380
  const dustGeo = new THREE.BufferGeometry()
  const dustPositions = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (rng() - 0.5) * 86
    dustPositions[i * 3 + 1] = 0.3 + rng() * 7
    dustPositions[i * 3 + 2] = (rng() - 0.5) * 86
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.055,
    map: makeGlowTexture(),
    color: 0xb7c9d9,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    fog: true,
    toneMapped: false
  }))
  scene.add(dust)

  const wispPoints = [
    new THREE.Vector3(-28, 1.15, 30),
    new THREE.Vector3(29, 1.15, 25),
    new THREE.Vector3(-31, 1.15, -8),
    new THREE.Vector3(30, 1.15, -18),
    new THREE.Vector3(-20, 1.15, -26),
    new THREE.Vector3(17, 1.15, 35),
    new THREE.Vector3(23, 1.15, 3),
    new THREE.Vector3(-24, 1.15, 15)
  ]

  const spawnPoints = [
    new THREE.Vector3(0, 0, 40),
    new THREE.Vector3(-4, 0, 35),
    new THREE.Vector3(4, 0, 33),
    new THREE.Vector3(-8, 0, 22),
    new THREE.Vector3(9, 0, 18),
    new THREE.Vector3(-12, 0, 5),
    new THREE.Vector3(12, 0, -2),
    new THREE.Vector3(-9, 0, -18),
    new THREE.Vector3(10, 0, -24),
    new THREE.Vector3(0, 0, -31),
    new THREE.Vector3(18, 0, 34),
    new THREE.Vector3(-18, 0, 36)
  ]

  let lastDawn = -1
  const tmpColor = new THREE.Color()
  function setDawn(progress) {
    const p = THREE.MathUtils.clamp(progress, 0, 1)
    if (Math.abs(p - lastDawn) < 0.001) return
    lastDawn = p
    sky.uniforms.uDawn.value = p
    sky.uniforms.uTop.value.copy(NIGHT.top).lerp(DAWN.top, p)
    sky.uniforms.uHorizon.value.copy(NIGHT.horizon).lerp(DAWN.horizon, p * p)
    sky.uniforms.uGlow.value.copy(tmpColor.setHex(0x0b1220)).lerp(tmpColor.setHex(0xff7545), p * p)
    moon.material.opacity = THREE.MathUtils.lerp(1, 0.12, p * p)
    moonGlow.material.opacity = THREE.MathUtils.lerp(1, 0.12, p)
    stars.material.opacity = THREE.MathUtils.lerp(0.9, 0, p * 1.5)
    hemi.color.copy(NIGHT.ambient).lerp(DAWN.ambient, p)
    hemi.groundColor.copy(NIGHT.groundLight).lerp(DAWN.groundLight, p)
    hemi.intensity = THREE.MathUtils.lerp(0.55, 0.92, p)
    moonLight.color.copy(NIGHT.moon).lerp(DAWN.moon, p)
    moonLight.intensity = THREE.MathUtils.lerp(1.25, 2.0, p)
    fill.intensity = THREE.MathUtils.lerp(0.32, 0.5, p)
    scene.fog.color.copy(NIGHT.fog).lerp(DAWN.fog, p * p)
    renderer.setClearColor(scene.fog.color)
  }

  const fogColor = NIGHT.fog.clone()
  scene.fog = new THREE.FogExp2(fogColor, 0.0135)
  renderer.setClearColor(fogColor)
  setDawn(0)

  function update(dt, time) {
    sky.uniforms.uTime.value = time
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * dt
      if (cloud.position.x > 130) cloud.position.x = -130
      cloud.position.y += Math.sin(time * 0.05 + cloud.userData.sway) * 0.001
    }
    for (const { plane, mat, speed, phase } of fogSheets) {
      mat.map.offset.x = time * speed + phase * 0.01
      mat.map.offset.y = time * speed * 0.4
      plane.position.x = Math.sin(time * 0.03 + phase) * 3
    }
    for (const sprite of fogSprites) {
      sprite.position.x = sprite.userData.baseX + Math.sin(time * sprite.userData.speed + sprite.userData.phase) * 4
      sprite.position.z = sprite.userData.baseZ + Math.cos(time * sprite.userData.speed * 0.8 + sprite.userData.phase) * 4
    }
    for (const data of flickerLights) {
      const f = 0.78 + Math.sin(time * 7.1 + data.phase) * 0.06 + Math.sin(time * 13.7 + data.phase * 2) * 0.04 + Math.sin(time * 2.3 + data.phase) * 0.08
      data.light.intensity = data.baseIntensity * f
      data.glow.material.opacity = 0.55 + f * 0.28
      data.pool.material.opacity = 0.16 + f * 0.08
    }
    const attr = fireflyGeo.attributes.position
    for (let i = 0; i < fireflyCount; i++) {
      const b = fireflyBase[i]
      attr.setXYZ(
        i,
        b.x + Math.sin(time * b.speed + b.phase) * b.amp + Math.sin(time * 0.3 + b.phase) * 0.5,
        b.y + Math.sin(time * b.speed * 1.7 + b.phase) * b.amp * 0.5,
        b.z + Math.cos(time * b.speed * 0.8 + b.phase) * b.amp
      )
    }
    attr.needsUpdate = true
    fireflyMat.opacity = 0.72 + Math.sin(time * 1.4) * 0.12
    for (const fn of animated) fn(dt, time)
    grass.material.userData.time.value = time
    moon.position.y = 47 + Math.sin(time * 0.03) * 0.1
    moonGlow.position.y = moon.position.y
  }

  return {
    group: world,
    colliders,
    lanterns,
    wispPoints,
    spawnPoints,
    moon,
    southGate: new THREE.Vector3(0, 0, 40),
    update,
    setDawn,
    fogColor,
    bounds: 42
  }
}

function pathAt(z) {
  const t = THREE.MathUtils.clamp((44 - z) / 78, 0, 1)
  return { x: Math.sin(t * Math.PI * 1.5) * 2.2 }
}

function makeGrassBlades(rng) {
  const count = 8800
  const positions = []
  const colors = []
  const indices = []
  for (let i = 0; i < count; i++) {
    const x = (rng() - 0.5) * 98
    const z = (rng() - 0.5) * 98
    if (Math.abs(x - pathAt(z).x) < 3.2) continue
    const h = 0.12 + rng() * 0.38
    const w = 0.025 + rng() * 0.04
    const a = rng() * Math.PI
    const dx = Math.cos(a) * w
    const dz = Math.sin(a) * w
    const base = positions.length / 3
    positions.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x + (rng() - 0.5) * 0.1, h, z + (rng() - 0.5) * 0.1)
    const c = new THREE.Color().setHSL(0.22 + rng() * 0.08, 0.24 + rng() * 0.2, 0.10 + rng() * 0.12)
    for (let j = 0; j < 3; j++) colors.push(c.r, c.g, c.b)
    indices.push(base, base + 1, base + 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        float wind = sin(uTime * 1.4 + position.x * 0.35 + position.z * 0.22) * 0.055 + sin(uTime * 2.7 + position.z * 0.5) * 0.02;
        transformed.x += wind * position.y;
        transformed.z += wind * 0.35 * position.y;
      `
      )
    mat.userData.shader = shader
  }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  mesh.castShadow = false
  mesh.frustumCulled = false
  mat.userData.time = { value: 0 }
  const fake = mat.userData
  const oldCompile = mat.onBeforeCompile
  mat.onBeforeCompile = (shader) => {
    oldCompile(shader)
    mat.userData.time = shader.uniforms.uTime
  }
  fake.__unused = true
  return { mesh, material: mat }
}
