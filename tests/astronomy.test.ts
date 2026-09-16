import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_AXIS, orbitPosition, unit, dot, cross, declinationForCalendarDay, terminatorPoint, illuminationDerivative, type Vector } from '../app/astronomy.ts';
const close = (a: number, b: number, tolerance=1e-10) => assert.ok(Math.abs(a-b)<tolerance, `${a} != ${b}`);
test('four seasonal positions, fixed axis and direct latitude agree', () => {
  for (const [day, expected] of [[0,0],[93,23.5],[186,0],[276,-23.5],[365,0]]) {
    const sun = unit(orbitPosition(day).map(v => -v) as Vector);
    close(Math.asin(dot(EARTH_AXIS,sun))*180/Math.PI, expected);
    close(declinationForCalendarDay(day),expected);
    close(Math.hypot(...orbitPosition(day)),4);
  }
});
test('all seasons: entire great circle, dawn/night-to-day and dusk/day-to-night', () => {
  for (let day=0; day<=365; day++) {
    const sun = unit(orbitPosition(day).map(v => -v) as Vector);
    close(declinationForCalendarDay(day),Math.asin(dot(EARTH_AXIS,sun))*180/Math.PI);
    for (let half=0; half<2; half++) {
      for (let i=1;i<64;i++) {
        const n=terminatorPoint(sun,-Math.PI/2+i/64*Math.PI+half*Math.PI);
        close(dot(n,sun),0); close(Math.hypot(...n),1);
        const v=cross(EARTH_AXIS,n);
        const before = unit(n.map((x,j)=>x-v[j]*1e-6) as Vector);
        const after = unit(n.map((x,j)=>x+v[j]*1e-6) as Vector);
        assert.ok((half===0?1:-1)*illuminationDerivative(n,sun)>0);
        assert.ok((half===0?1:-1)*dot(before,sun)<0);
        assert.ok((half===0?1:-1)*dot(after,sun)>0);
      }
    }
    close(illuminationDerivative(terminatorPoint(sun,Math.PI/2),sun),0);
  }
});
test('orbit advances counterclockwise viewed from ecliptic north',()=>{
  const velocity=orbitPosition(.01).map((v,i)=>v-orbitPosition(0)[i]) as Vector;
  assert.ok(cross(orbitPosition(0),velocity)[1]>0);
});
