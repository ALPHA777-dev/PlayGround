import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.9 },
    uGrain: { value: 0.045 },
    uExposure: { value: 0 },
    uAberration: { value: 1 },
    uSaturation: { value: 1.08 },
    uContrast: { value: 1.04 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uExposure;
    uniform float uAberration;
    uniform float uSaturation;
    uniform float uContrast;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float dist = length(centered);
      vec2 dir = centered / max(dist, 0.0001);
      float ab = 0.0011 * uAberration * (0.3 + dist);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ab).b;

      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(lum), col, uSaturation);
      col = (col - 0.5) * uContrast + 0.5;
      col = max(col, 0.0);

      float vignette = smoothstep(0.92, 0.28, dist * uVignette);
      col *= mix(0.42, 1.0, vignette);
      col += vec3(0.42, 0.02, 0.05) * uExposure * smoothstep(0.18, 0.82, dist) * 0.55;
      col += vec3(0.03, 0.05, 0.08) * smoothstep(0.5, 1.0, uv.y) * 0.35;

      float grain = hash(uv * vec2(1780.0, 1120.0) + uTime * 19.7) - 0.5;
      col += grain * uGrain;

      gl_FragColor = vec4(col, 1.0);
    }
  `
}

export function createPostProcessing(renderer, scene, camera, { mobile = false } = {}) {
  const composer = new EffectComposer(renderer)
  composer.renderTarget1.samples = mobile ? 2 : 4
  composer.renderTarget2.samples = mobile ? 2 : 4

  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)

  const bloomSize = new THREE.Vector2(window.innerWidth, window.innerHeight)
  const bloom = new UnrealBloomPass(bloomSize, mobile ? 0.42 : 0.68, 0.7, mobile ? 0.72 : 0.62)
  composer.addPass(bloom)

  const grade = new ShaderPass(GradeShader)
  grade.uniforms.uGrain.value = mobile ? 0.032 : 0.042
  grade.uniforms.uVignette.value = mobile ? 0.95 : 0.88
  composer.addPass(grade)

  const output = new OutputPass()
  composer.addPass(output)

  return {
    composer,
    bloom,
    grade,
    renderPass,
    setSize(width, height) {
      composer.setSize(width, height)
      bloom.resolution.set(width, height)
    },
    update(time, exposure) {
      grade.uniforms.uTime.value = time
      grade.uniforms.uExposure.value = exposure
    }
  }
}
