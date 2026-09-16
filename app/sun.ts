import * as THREE from 'three';

// Illustrative spherical texture: Solar System Scope, CC BY 4.0.
// Self-lit photosphere with limb darkening; not a shaded, solid planet.
export function createSun(radius: number) {
  const group = new THREE.Group();
  const fallback = new THREE.DataTexture(new Uint8Array([255, 192, 105, 255]), 1, 1);
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.needsUpdate = true;
  let map: THREE.Texture = fallback;
  let disposed = false;
  const material = new THREE.ShaderMaterial({
    uniforms: { surface: { value: fallback } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = -p.xyz;
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: `
      uniform sampler2D surface;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float mu = max(dot(normalize(vNormal), normalize(vView)), 0.0);
        vec3 photo = texture2D(surface, vUv).rgb;
        // Preserve surface detail, warm white center and darker golden limb.
        vec3 color = mix(photo, vec3(1.0, .82, .48), .18);
        color *= .50 + .65 * pow(mu, .55);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const surface = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), material);
  group.add(surface);
  new THREE.TextureLoader().load('/sun-surface.jpg', texture => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    material.uniforms.surface.value = texture;
    map = texture;
    fallback.dispose();
  });
  // Camera-facing radial halo: no hard boundary or opaque shell over the surface.
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(radius * 3.5, radius * 3.5), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {},
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float r = length(vUv - .5) * 3.5;
        float halo = exp(-max(r - .94, 0.0) * 7.0) * smoothstep(.82, 1.04, r);
        halo *= 1.0 - smoothstep(1.45, 1.72, r);
        gl_FragColor = vec4(1.0, .38, .055, halo * .28);
      }
    `,
  }));
  group.add(glow);
  return {
    group, glow,
    dispose() {
      disposed = true;
      map.dispose();
      surface.geometry.dispose(); material.dispose();
      glow.geometry.dispose(); glow.material.dispose();
    },
  };
}
