'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createSun } from './sun';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { declinationForCalendarDay, orbitPosition, terminatorPoint, type Vector } from './astronomy';

export type ViewMode = 'equator' | 'north' | 'south';

type EarthSceneProps = {
  day: number;
  solar: boolean;
  showPolar: boolean;
  view: ViewMode;
  viewRequest: number;
  autoRotate: boolean;
  spinPaused: boolean;
  speed: number;
  resetSignal: number;
  onFreeView: () => void;
};

type SceneConfig = EarthSceneProps;

const LATITUDE_GUIDES = [
  { latitude: 66.5, label: '北极圈 · 66.5°N', kind: 'polar', longitudeOffset: .65 },
  { latitude: -66.5, label: '南极圈 · 66.5°S', kind: 'polar', longitudeOffset: .65 },
  { latitude: 60, label: '北纬 60°', kind: 'degree', longitudeOffset: -.88 },
  { latitude: 30, label: '北纬 30°', kind: 'degree', longitudeOffset: -.88 },
  { latitude: 23.5, label: '北回归线 · 23.5°N', kind: 'tropic', longitudeOffset: .88 },
  { latitude: 0, label: '赤道 · 0°', kind: 'equator', longitudeOffset: .88 },
  { latitude: -23.5, label: '南回归线 · 23.5°S', kind: 'tropic', longitudeOffset: .88 },
  { latitude: -30, label: '南纬 30°', kind: 'degree', longitudeOffset: -.88 },
  { latitude: -60, label: '南纬 60°', kind: 'degree', longitudeOffset: -.88 },
] as const;

const CONTINENTS = [
  [[.08,.28],[.13,.19],[.23,.15],[.31,.22],[.34,.33],[.29,.43],[.23,.42],[.19,.51],[.12,.45]],
  [[.31,.44],[.39,.46],[.44,.57],[.42,.68],[.38,.82],[.34,.72],[.33,.58]],
  [[.42,.12],[.47,.11],[.49,.23],[.45,.29],[.41,.22]],
  [[.47,.34],[.55,.31],[.62,.39],[.59,.53],[.55,.69],[.49,.61],[.46,.46]],
  [[.51,.27],[.58,.19],[.71,.17],[.84,.26],[.88,.38],[.79,.48],[.68,.44],[.63,.36],[.56,.39]],
  [[.75,.59],[.86,.57],[.91,.66],[.88,.75],[.79,.77],[.73,.69]],
  [[.0,.88],[.18,.86],[.35,.89],[.52,.87],[.71,.9],[.9,.86],[1,.9],[1,1],[0,1]],
] as const;

function mulberry32(seed: number) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function polygonPath(points: readonly (readonly [number, number])[], width: number, height: number) {
  const path = new Path2D();
  points.forEach(([x, y], index) => {
    if (index === 0) path.moveTo(x * width, y * height);
    else path.lineTo(x * width, y * height);
  });
  path.closePath();
  return path;
}

function makeEarthTexture(night = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 1536;
  canvas.height = 768;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');

  const ocean = context.createLinearGradient(0, 0, 0, canvas.height);
  if (night) {
    ocean.addColorStop(0, '#020918');
    ocean.addColorStop(.5, '#010715');
    ocean.addColorStop(1, '#020b1b');
  } else {
    ocean.addColorStop(0, '#126f91');
    ocean.addColorStop(.48, '#087a9d');
    ocean.addColorStop(1, '#064d70');
  }
  context.fillStyle = ocean;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const paths = CONTINENTS.map((points) => polygonPath(points, canvas.width, canvas.height));
  const land = context.createLinearGradient(0, canvas.height * .12, 0, canvas.height * .9);
  if (night) {
    land.addColorStop(0, '#071828');
    land.addColorStop(.5, '#0a1a21');
    land.addColorStop(1, '#06151f');
  } else {
    land.addColorStop(0, '#b2bf86');
    land.addColorStop(.28, '#718b54');
    land.addColorStop(.62, '#7c8652');
    land.addColorStop(1, '#d7e0cc');
  }

  context.fillStyle = land;
  context.strokeStyle = night ? '#10283a' : 'rgba(218,231,179,.38)';
  context.lineWidth = 3;
  paths.forEach((path) => {
    context.fill(path);
    context.stroke(path);
  });

  const random = mulberry32(night ? 117 : 73);
  if (night) {
    context.globalCompositeOperation = 'screen';
    for (let index = 0; index < 650; index += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height * .78 + canvas.height * .08;
      if (!paths.some((path) => context.isPointInPath(path, x, y))) continue;
      const size = random() > .93 ? 2.4 : 1.15;
      context.globalAlpha = .3 + random() * .7;
      context.fillStyle = random() > .18 ? '#ffc56f' : '#f58d49';
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
    }
  } else {
    context.globalAlpha = .2;
    context.fillStyle = '#ffffff';
    for (let index = 0; index < 115; index += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      context.beginPath();
      context.ellipse(x, y, 18 + random() * 68, 3 + random() * 10, random() * .4, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function makeGrid() {
  const grid = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: 0x72d6ef,
    transparent: true,
    opacity: .18,
    depthWrite: false,
  });

  for (let latitude = -75; latitude <= 75; latitude += 15) {
    const lat = THREE.MathUtils.degToRad(latitude);
    const radius = Math.cos(lat) * 1.007;
    const y = Math.sin(lat) * 1.007;
    const points: THREE.Vector3[] = [];
    for (let segment = 0; segment <= 128; segment += 1) {
      const angle = segment / 128 * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    }
    grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }

  for (let longitude = 0; longitude < 360; longitude += 15) {
    const lon = THREE.MathUtils.degToRad(longitude);
    const points: THREE.Vector3[] = [];
    for (let segment = 0; segment <= 96; segment += 1) {
      const lat = -Math.PI / 2 + segment / 96 * Math.PI;
      const radius = Math.cos(lat) * 1.008;
      points.push(new THREE.Vector3(
        Math.sin(lon) * radius,
        Math.sin(lat) * 1.008,
        Math.cos(lon) * radius,
      ));
    }
    grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }
  return grid;
}

function makeLatitudeGuide(latitude: number, kind: 'degree' | 'tropic' | 'equator' | 'polar') {
  const radians = THREE.MathUtils.degToRad(latitude);
  const surfaceRadius = 1.013;
  const ringRadius = Math.cos(radians) * surfaceRadius;
  if (kind === 'tropic' || kind === 'polar') {
    const positions: number[] = [];
    for (let segment = 0; segment <= 192; segment += 1) {
      const angle = segment / 192 * Math.PI * 2;
      positions.push(
        Math.cos(angle) * ringRadius,
        Math.sin(radians) * surfaceRadius,
        Math.sin(angle) * ringRadius,
      );
    }
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    const line = new Line2(
      geometry,
      new LineMaterial({
        color: kind === 'polar' ? 0x8bf1c0 : 0xff9a61,
        linewidth: 2.6,
        dashed: true,
        transparent: true,
        opacity: .9,
        dashSize: .042,
        gapSize: .028,
        depthWrite: false,
        alphaToCoverage: true,
      }),
    );
    line.computeLineDistances();
    return line;
  }
  const tubeRadius = kind === 'equator' ? .006 : .0027;
  const color = kind === 'equator' ? 0xffa63d : 0x78bfd2;
  const opacity = kind === 'equator' ? .9 : .48;
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, tubeRadius, 6, 192), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = Math.sin(radians) * surfaceRadius;
  return ring;
}

function setProjectedPosition(
  element: HTMLElement | null,
  point: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
  visible = true,
) {
  if (!element) return;
  const projected = point.clone().project(camera);
  const inView = visible
    && projected.z > -1 && projected.z < 1
    && Math.abs(projected.x) < .96 && Math.abs(projected.y) < .92;
  element.style.opacity = inView ? '1' : '0';
  element.style.transform = `translate3d(${(projected.x * .5 + .5) * width}px, ${(-projected.y * .5 + .5) * height}px, 0) translate(-50%, -50%)`;
}

export default function EarthScene(props: EarthSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const northRef = useRef<HTMLSpanElement>(null);
  const southRef = useRef<HTMLSpanElement>(null);
  const directRef = useRef<HTMLSpanElement>(null);
  const duskRef = useRef<HTMLSpanElement>(null);
  const terminatorRef = useRef<HTMLSpanElement>(null);
  const sunRef = useRef<HTMLSpanElement>(null);
  const directRayRef = useRef<HTMLSpanElement>(null);
  const latitudeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const configRef = useRef<SceneConfig>(props);
  const [error, setError] = useState(false);

  useEffect(() => {
    configRef.current = props;
  }, [props]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      window.setTimeout(() => setError(true), 0);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', '可拖拽旋转并可滚轮缩放的三维地球，显示昼夜半球、晨昏线、地轴、重点纬线与太阳直射箭头');
    renderer.domElement.tabIndex = 0;
    if (host.firstChild) host.insertBefore(renderer.domElement, host.firstChild);
    else host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const earthSystem = new THREE.Group();
    scene.add(earthSystem);
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
    camera.position.set(0, .15, 4.25);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .065;
    controls.enablePan = false;
    controls.minDistance = 2.45;
    controls.maxDistance = 6;
    controls.rotateSpeed = .58;
    controls.zoomSpeed = .7;
    controls.target.set(0, 0, 0);
    const markFreeView = () => configRef.current.onFreeView();
    controls.addEventListener('start', markFreeView);

    const fallbackDayMap = makeEarthTexture(false);
    const nightMap = makeEarthTexture(true);
    let activeDayMap: THREE.Texture = fallbackDayMap;
    let disposed = false;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: fallbackDayMap },
        nightMap: { value: nightMap },
        sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D dayMap;
        uniform sampler2D nightMap;
        uniform vec3 sunDirection;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 normal = normalize(vWorldNormal);
          float light = dot(normal, normalize(sunDirection));
          float mixValue = smoothstep(-0.10, 0.10, light);
          vec3 dayColor = texture2D(dayMap, vUv).rgb * (0.42 + max(light, 0.0) * 0.86);
          vec3 nightColor = texture2D(nightMap, vUv).rgb * (0.72 + max(-light, 0.0) * 0.25);
          vec3 color = mix(nightColor, dayColor, mixValue);
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.1);
          color += vec3(0.02, 0.40, 0.68) * rim * 0.34;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    new THREE.TextureLoader().load('/earth-day.jpg', (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      material.uniforms.dayMap.value = texture;
      fallbackDayMap.dispose();
      activeDayMap = texture;
    });

    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = THREE.MathUtils.degToRad(-23.5);
    earthSystem.add(tiltGroup);

    const spinGroup = new THREE.Group();
    tiltGroup.add(spinGroup);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material);
    earth.rotation.y = -.45;
    spinGroup.add(earth);
    spinGroup.add(makeGrid());
    const latitudeGuideMeshes = LATITUDE_GUIDES.map((guide) => {
      const ring = makeLatitudeGuide(guide.latitude, guide.kind);
      spinGroup.add(ring);
      return ring;
    });

    const atmosphereMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vNormal = normalize(mat3(modelMatrix) * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float intensity = pow(0.72 - dot(vNormal, viewDirection), 2.2);
          gl_FragColor = vec4(0.06, 0.65, 1.0, intensity * 0.55);
        }
      `,
    });
    earthSystem.add(new THREE.Mesh(new THREE.SphereGeometry(1.13, 72, 48), atmosphereMaterial));

    const axisMaterial = new THREE.MeshBasicMaterial({ color: 0x8eeaff, transparent: true, opacity: .68 });
    const axis = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 2.92, 8), axisMaterial);
    tiltGroup.add(axis);
    const northCap = new THREE.Mesh(new THREE.SphereGeometry(.022, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb8f4ff }));
    northCap.position.y = 1.06;
    tiltGroup.add(northCap);

    const makeBoundary = (color: number) => {
      const geometry = new LineGeometry();
      geometry.setPositions([0, 0, 0, 0, 1, 0]);
      const line = new Line2(geometry, new LineMaterial({ color, linewidth: 3.5, depthWrite: false }));
      earthSystem.add(line);
      return line;
    };
    const terminator = makeBoundary(0x49e2ff);
    const dusk = makeBoundary(0xff71be);
    const crossingArrows = [0x49e2ff, 0xff71be].map(color => {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), .32, color, .10, .055);
      earthSystem.add(arrow);
      return arrow;
    });
    const orbit = new THREE.Group();
    scene.add(orbit);
    const orbitPoints = Array.from({length: 257}, (_, i) => new THREE.Vector3(-4*Math.sin(i/256*Math.PI*2), 0, -4*Math.cos(i/256*Math.PI*2)));
    orbit.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints), new THREE.LineBasicMaterial({color: 0x647c9c})));
    const sunRadius = 1.9;
    const solarSun = createSun(sunRadius);
    orbit.add(solarSun.group);
    const orbitRay = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), 3, 0xffb347, .18, .10);
    orbit.add(orbitRay);
    const orbitArrow = new THREE.ArrowHelper(new THREE.Vector3(-1,0,0), new THREE.Vector3(0,0,-4), .7, 0xa2b6d1, .18, .1);
    orbit.add(orbitArrow);
    let lastSolar: boolean | null = null;

    const directPointArrow = new THREE.ArrowHelper(
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(1.54, 0, 0),
      .5,
      0xff7545,
      .19,
      .105,
    );
    const directArrowLineMaterial = directPointArrow.line.material as THREE.LineBasicMaterial;
    const directArrowConeMaterial = directPointArrow.cone.material as THREE.MeshBasicMaterial;
    directArrowLineMaterial.transparent = true;
    directArrowLineMaterial.opacity = .98;
    directArrowConeMaterial.transparent = true;
    directArrowConeMaterial.opacity = 1;
    earthSystem.add(directPointArrow);

    const directTargetMaterial = new THREE.MeshBasicMaterial({
      color: 0xffa26f,
      transparent: true,
      opacity: .88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const directTarget = new THREE.Mesh(new THREE.RingGeometry(.036, .062, 32), directTargetMaterial);
    earthSystem.add(directTarget);
    const directTargetPosition = new THREE.Vector3(1.022, 0, 0);
    const surfaceNormal = new THREE.Vector3(0, 0, 1);

    const localSun = createSun(.16);
    const sunMarker = localSun.group;
    earthSystem.add(sunMarker);
    const sunlightRays = [-.58, -.29, 0, .29, .58].map((offset) => {
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(),
        offset === 0 ? 1.42 : 1.25,
        offset === 0 ? 0xff8a56 : 0xc86343,
        offset === 0 ? .14 : .1,
        offset === 0 ? .068 : .045,
      );
      const lineMaterial = arrow.line.material as THREE.LineBasicMaterial;
      const coneMaterial = arrow.cone.material as THREE.MeshBasicMaterial;
      lineMaterial.transparent = true;
      coneMaterial.transparent = true;
      lineMaterial.opacity = offset === 0 ? .92 : .42;
      coneMaterial.opacity = offset === 0 ? .95 : .56;
      earthSystem.add(arrow);
      return { arrow, offset };
    });

    const axisDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(tiltGroup.quaternion).normalize();
    const equatorDirection = new THREE.Vector3(1, 0, 0).applyQuaternion(tiltGroup.quaternion).normalize();
    const inverseTiltQuaternion = tiltGroup.quaternion.clone().invert();
    const northPoint = axisDirection.clone().multiplyScalar(1.22);
    const southPoint = axisDirection.clone().multiplyScalar(-1.22);

    const cameraAxis = new THREE.Vector3(0, 1, 0);
    let previousTime = performance.now();
    const desiredPosition = new THREE.Vector3();
    const desiredUp = new THREE.Vector3();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animationFrame = 0;
    let lastViewRequest = configRef.current.viewRequest;
    let lastReset = configRef.current.resetSignal;
    let stableFrontLongitude = Math.PI / 2;
    let cameraMove: {
      start: number;
      fromDirection: THREE.Vector3;
      axis: THREE.Vector3;
      angle: number;
      fromRadius: number;
      toRadius: number;
      upFrom: THREE.Vector3;
      upTo: THREE.Vector3;
    } | null = null;

    const viewTarget = (mode: ViewMode) => {
      if (configRef.current.solar) {
        desiredPosition.set(6, 8, 10);
        desiredUp.set(0, 1, 0);
      } else if (mode === 'north') {
        desiredPosition.copy(axisDirection).multiplyScalar(4.15);
        desiredUp.set(0, 0, -1);
      } else if (mode === 'south') {
        desiredPosition.copy(axisDirection).multiplyScalar(-4.15);
        desiredUp.set(0, 0, 1);
      } else {
        desiredPosition.set(0, .15, 4.25);
        desiredUp.set(0, 1, 0);
      }

      if (reducedMotion.matches) {
        camera.position.copy(desiredPosition);
        camera.up.copy(desiredUp);
        camera.lookAt(0, 0, 0);
        controls.update();
        cameraMove = null;
        return;
      }

      const fromDirection = camera.position.clone().normalize();
      const toDirection = desiredPosition.clone().normalize();
      const dot = THREE.MathUtils.clamp(fromDirection.dot(toDirection), -1, 1);
      const axis = new THREE.Vector3().crossVectors(fromDirection, toDirection);
      if (axis.lengthSq() < .00001) {
        axis.crossVectors(
          fromDirection,
          Math.abs(fromDirection.z) < .88 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0),
        );
      }
      axis.normalize();
      cameraMove = {
        start: performance.now(),
        fromDirection,
        axis,
        angle: Math.acos(dot),
        fromRadius: camera.position.length(),
        toRadius: desiredPosition.length(),
        upFrom: camera.up.clone(),
        upTo: desiredUp.clone(),
      };
    };

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      [terminator, dusk].forEach(line => line.material.resolution.set(width, height));
      latitudeGuideMeshes.forEach(line => { if (line instanceof Line2) line.material.resolution.set(width, height); });
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key.toLowerCase() !== 'a' && event.key.toLowerCase() !== 'd') return;
      event.preventDefault();
      const direction = event.key.toLowerCase() === 'a' ? .105 : -.105;
      configRef.current.onFreeView();
      cameraMove = null;
      camera.position.applyAxisAngle(cameraAxis, direction);
      camera.lookAt(0, 0, 0);
      controls.update();
    };
    window.addEventListener('keydown', onKeyDown);

    const animate = (time: number) => {
      animationFrame = requestAnimationFrame(animate);
      const config = configRef.current;
      const delta = Math.min((time - previousTime) / 1000, .05);
      previousTime = time;

      if (config.solar !== lastSolar) {
        lastSolar = config.solar;
        controls.minDistance = config.solar ? 9 : 2.45;
        controls.maxDistance = config.solar ? 26 : 6;
        cameraMove = null;
        camera.position.set(...(config.solar ? [6,8,10] : [0,.15,4.25]) as [number,number,number]);
        camera.up.set(0,1,0);
        controls.update();
      }
      orbit.visible = config.solar;
      earthSystem.position.set(...(config.solar ? orbitPosition(config.day) : [0,0,0]) as Vector);
      if (config.viewRequest !== lastViewRequest) {
        lastViewRequest = config.viewRequest;
        viewTarget(config.view);
      }
      if (config.resetSignal !== lastReset) {
        lastReset = config.resetSignal;
        spinGroup.rotation.y = 0;
        lastViewRequest = config.viewRequest;
        viewTarget('equator');
      }
      if (cameraMove) {
        const progress = Math.min((time - cameraMove.start) / 760, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const direction = cameraMove.fromDirection.clone()
          .applyAxisAngle(cameraMove.axis, cameraMove.angle * eased);
        const radius = THREE.MathUtils.lerp(cameraMove.fromRadius, cameraMove.toRadius, eased);
        camera.position.copy(direction.multiplyScalar(radius));
        const arcUp = cameraMove.upFrom.clone()
          .applyAxisAngle(cameraMove.axis, cameraMove.angle * eased);
        const correctedUp = arcUp.clone().lerp(cameraMove.upTo, eased * eased);
        camera.up.copy(correctedUp.lengthSq() < .0001 ? arcUp : correctedUp).normalize();
        camera.lookAt(0, 0, 0);
        if (progress >= 1) cameraMove = null;
      }

      if (config.autoRotate && !config.spinPaused) {
        spinGroup.rotation.y += delta * .18 * config.speed;
      }

      const declinationDegrees = declinationForCalendarDay(config.day);
      const declination = THREE.MathUtils.degToRad(declinationDegrees);
      const sunDirection = config.solar ? earthSystem.position.clone().negate().normalize() : equatorDirection.clone().multiplyScalar(Math.cos(declination))
        .add(axisDirection.clone().multiplyScalar(Math.sin(declination))).normalize();
      material.uniforms.sunDirection.value.copy(sunDirection);
      directTargetPosition.copy(sunDirection).multiplyScalar(1.022);
      directPointArrow.position.copy(sunDirection).multiplyScalar(1.54);
      directPointArrow.setDirection(sunDirection.clone().negate());
      directPointArrow.setLength(.5, .19, .105);
      directTarget.position.copy(directTargetPosition);
      directTarget.quaternion.setFromUnitVectors(surfaceNormal, sunDirection);
      const sunVector = sunDirection.toArray() as Vector;
      [terminator, dusk].forEach((line, half) => {
        const positions: number[] = [];
        for (let i=0; i<=128; i++) {
          const angle = -Math.PI/2 + i/128*Math.PI + half*Math.PI;
          positions.push(...terminatorPoint(sunVector, angle).map(v => v*1.014));
        }
        line.geometry.setPositions(positions);
        const normal = new THREE.Vector3(...terminatorPoint(sunVector, half*Math.PI));
        crossingArrows[half].position.copy(normal).multiplyScalar(1.06);
        crossingArrows[half].setDirection(new THREE.Vector3().crossVectors(axisDirection, normal).normalize());
      });
      orbitRay.position.copy(earthSystem.position).normalize().multiplyScalar(sunRadius + .05);
      orbitRay.setDirection(earthSystem.position.clone().normalize());
      orbitRay.setLength(4 - sunRadius - 1.07, .16, .08);
      sunlightRays.forEach(({arrow}) => { arrow.visible = !config.solar; });
      sunMarker.visible = !config.solar;
      const incomingDirection = sunDirection.clone().negate();
      const beamOffsetDirection = new THREE.Vector3().crossVectors(sunDirection, axisDirection).normalize();
      sunlightRays.forEach(({ arrow, offset }) => {
        arrow.position.copy(sunDirection).multiplyScalar(2.55)
          .addScaledVector(beamOffsetDirection, offset);
        arrow.setDirection(incomingDirection);
      });
      sunMarker.position.copy(sunDirection).multiplyScalar(2.72);

      controls.update();
      solarSun.glow.quaternion.copy(camera.quaternion);
      localSun.glow.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);

      const width = host.clientWidth;
      const height = host.clientHeight;
      const cameraDirection = camera.position.clone().sub(earthSystem.position).normalize();
      const project = (element: HTMLElement | null, point: THREE.Vector3, cam: THREE.Camera, w: number, h: number, visible = true) => setProjectedPosition(element, point.clone().add(earthSystem.position), cam, w, h, visible);
      const localCameraDirection = cameraDirection.clone().applyQuaternion(inverseTiltQuaternion);
      const equatorialCameraLength = Math.hypot(localCameraDirection.x, localCameraDirection.z);
      if (equatorialCameraLength > .05) {
        stableFrontLongitude = Math.atan2(localCameraDirection.z, localCameraDirection.x);
      }
      const northFacing = axisDirection.dot(cameraDirection);
      project(northRef.current, northPoint.clone().multiplyScalar(config.solar ? 1.25 : 1), camera, width, height, northFacing > -.14);
      project(southRef.current, southPoint, camera, width, height, !config.solar && northFacing < .14);
      project(
        directRef.current,
        sunDirection.clone().multiplyScalar(config.solar ? 1.9 : 1.32).addScaledVector(beamOffsetDirection, .1),
        camera,
        width,
        height,
        sunDirection.dot(cameraDirection) > -.06,
      );
      if (directRef.current) {
        const latitude = Math.abs(declinationDegrees) < .05
          ? '0°'
          : `${Math.abs(declinationDegrees).toFixed(1)}°${declinationDegrees > 0 ? 'N' : 'S'}`;
        directRef.current.textContent = `太阳直射点 · ${latitude}`;
      }
      [terminatorRef.current, duskRef.current].forEach((element, half) => {
        // Select a visible point strictly inside this physical half, never screen left/right.
        let best = new THREE.Vector3(); let score = -Infinity;
        for (let i=1; i<32; i++) {
          const n = new THREE.Vector3(...terminatorPoint(sunVector, -Math.PI/2+i/32*Math.PI+half*Math.PI));
          const facing = n.dot(cameraDirection);
          if (facing > score) { score = facing; best = n; }
        }
        project(element, best.multiplyScalar(config.solar ? 1.48 : 1.18), camera, width, height, score > .04);
      });
      if (config.solar) setProjectedPosition(sunRef.current, new THREE.Vector3(0,sunRadius + .35,0), camera, width, height);
      else project(sunRef.current, sunMarker.position, camera, width, height);
      if (sunRef.current) sunRef.current.textContent = config.solar ? '太阳 · 公转中心' : '太阳平行光';
      project(
        directRayRef.current,
        sunDirection.clone().multiplyScalar(1.72).addScaledVector(beamOffsetDirection, -.12),
        camera,
        width,
        height,
        !config.solar,
      );
      LATITUDE_GUIDES.forEach((guide, index) => {
        latitudeGuideMeshes[index].visible = guide.kind !== 'polar' || config.showPolar;
        const latitude = THREE.MathUtils.degToRad(guide.latitude);
        const longitude = stableFrontLongitude + guide.longitudeOffset;
        const point = new THREE.Vector3(
          Math.cos(longitude) * Math.cos(latitude),
          Math.sin(latitude),
          Math.sin(longitude) * Math.cos(latitude),
        ).applyQuaternion(tiltGroup.quaternion).normalize();
        const facing = point.dot(cameraDirection);
        project(
          latitudeRefs.current[index],
          point.clone().multiplyScalar(1.075),
          camera,
          width,
          height,
          facing > -.02 && (guide.kind !== 'polar' || config.showPolar) && !config.solar,
        );
      });
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('keydown', onKeyDown);
      controls.removeEventListener('start', markFreeView);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      activeDayMap.dispose();
      nightMap.dispose();
      material.dispose();
      atmosphereMaterial.dispose();
      latitudeGuideMeshes.forEach((ring) => {
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      });
      terminator.geometry.dispose();
      terminator.material.dispose();
      dusk.geometry.dispose();
      dusk.material.dispose();
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(m => m?.dispose());
      });
      directPointArrow.line.geometry.dispose();
      directArrowLineMaterial.dispose();
      directPointArrow.cone.geometry.dispose();
      directArrowConeMaterial.dispose();
      directTarget.geometry.dispose();
      directTargetMaterial.dispose();
      solarSun.dispose();
      localSun.dispose();
      sunlightRays.forEach(({ arrow }) => {
        arrow.line.geometry.dispose();
        (arrow.line.material as THREE.Material).dispose();
        arrow.cone.geometry.dispose();
        (arrow.cone.material as THREE.Material).dispose();
      });
      host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="earth-scene" ref={hostRef}>
      <span className="scene-label pole-label" ref={northRef}>北极点</span>
      <span className="scene-label pole-label" ref={southRef}>南极点</span>
      <span className="scene-label direct-label" ref={directRef}>太阳直射点</span>
      <span className="scene-label terminator-label" ref={terminatorRef}>晨线 · 夜→昼</span>
      <span className="scene-label dusk-label" ref={duskRef}>昏线 · 昼→夜</span>
      <span className="scene-label sun-ray-label" ref={sunRef}>太阳平行光</span>
      <span className="scene-label direct-ray-label" ref={directRayRef}>太阳直射光线</span>
      {LATITUDE_GUIDES.map((guide, index) => (
        <span
          className={`scene-label latitude-label ${guide.kind}`}
          key={`${guide.label}-${guide.latitude}`}
          ref={(element) => { latitudeRefs.current[index] = element; }}
        >
          {guide.label}
        </span>
      ))}
      {error && (
        <div className="webgl-fallback" role="status">
          <strong>三维视图暂不可用</strong>
          <span>你仍可以用时间轴查看太阳直射点与昼夜参数。</span>
        </div>
      )}
    </div>
  );
}
