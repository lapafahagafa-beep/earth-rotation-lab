const CALENDAR_NODES = [0, 93, 186, 276, 365] as const;
const ORBITAL_PHASE_NODES = [0, 91.25, 182.5, 273.75, 365] as const;

export function orbitalPhaseForCalendarDay(day: number) {
  const boundedDay = Math.max(0, Math.min(day, 365));
  for (let index = 0; index < CALENDAR_NODES.length - 1; index += 1) {
    const fromDay = CALENDAR_NODES[index];
    const toDay = CALENDAR_NODES[index + 1];
    if (boundedDay > toDay) continue;
    const progress = (boundedDay - fromDay) / (toDay - fromDay);
    return ORBITAL_PHASE_NODES[index]
      + progress * (ORBITAL_PHASE_NODES[index + 1] - ORBITAL_PHASE_NODES[index]);
  }
  return 365;
}

export function declinationForCalendarDay(day: number) {
  const orbitalPhase = orbitalPhaseForCalendarDay(day);
  return Math.asin(Math.sin(23.5 * Math.PI / 180) * Math.sin(Math.PI * 2 * orbitalPhase / 365)) * 180 / Math.PI;
}

// Right-handed world: +Y is ecliptic north; rotation is eastward about axis.
export type Vector = [number, number, number];
export const EARTH_AXIS: Vector = [Math.sin(23.5 * Math.PI / 180), Math.cos(23.5 * Math.PI / 180), 0];
export function orbitPosition(day: number, radius = 4): Vector {
  const angle = orbitalPhaseForCalendarDay(day) / 365 * Math.PI * 2;
  return [-radius * Math.sin(angle), 0, -radius * Math.cos(angle)];
}
export function cross(a: Vector, b: Vector): Vector {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
export function dot(a: Vector, b: Vector) { return a.reduce((sum, v, i) => sum + v*b[i], 0); }
export function unit(a: Vector): Vector { const n = Math.hypot(...a); return a.map(v => v/n) as Vector; }
// d(n·s)/dt = (axis × n)·s. Positive = night to day (dawn).
export function illuminationDerivative(normal: Vector, sun: Vector) { return dot(cross(EARTH_AXIS, normal), sun); }
export function terminatorPoint(sun: Vector, angle: number): Vector {
  const dawn = unit(cross(sun, EARTH_AXIS));
  const tangent = unit(cross(sun, dawn));
  return dawn.map((v, i) => v * Math.cos(angle) + tangent[i] * Math.sin(angle)) as Vector;
}
