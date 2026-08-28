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
  return 23.5 * Math.sin(Math.PI * 2 * orbitalPhase / 365);
}
