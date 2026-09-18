'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import EarthScene, { type ViewMode } from './EarthScene';
import { declinationForCalendarDay } from './astronomy';

const SPEEDS = [.25, .5, 1, 1.5, 2, 4] as const;
const TERMS = [
  { name: '春分', day: 0 }, { name: '清明', day: 15 }, { name: '谷雨', day: 30 },
  { name: '立夏', day: 45 }, { name: '小满', day: 61 }, { name: '芒种', day: 76 },
  { name: '夏至', day: 93 }, { name: '小暑', day: 108 }, { name: '大暑', day: 123 },
  { name: '立秋', day: 139 }, { name: '处暑', day: 155 }, { name: '白露', day: 170 },
  { name: '秋分', day: 186 }, { name: '寒露', day: 201 }, { name: '霜降', day: 216 },
  { name: '立冬', day: 231 }, { name: '小雪', day: 246 }, { name: '大雪', day: 261 },
  { name: '冬至', day: 276 }, { name: '小寒', day: 291 }, { name: '大寒', day: 306 },
  { name: '立春', day: 321 }, { name: '雨水', day: 336 }, { name: '惊蛰', day: 351 },
] as const;

const VIEW_LABELS: Record<ViewMode, string> = {
  equator: '赤道侧视',
  south: '南极俯视',
  north: '北极俯视',
};

const QUARTERS = [
  { name: '春分', day: 0 },
  { name: '夏至', day: 93 },
  { name: '秋分', day: 186 },
  { name: '冬至', day: 276 },
  { name: '春分', day: 365 },
] as const;

function nearestTerm(day: number) {
  const candidates = [...TERMS, { name: '次年春分', day: 365 }] as const;
  return candidates.reduce((closest, candidate) => (
    Math.abs(candidate.day - day) < Math.abs(closest.day - day) ? candidate : closest
  )).name;
}

function formatDate(day: number) {
  if (day >= 364.5) return '次年 3 月 21 日';
  const base = new Date(Date.UTC(2025, 2, 21));
  base.setUTCDate(base.getUTCDate() + Math.round(day));
  return `${base.getUTCMonth() + 1} 月 ${base.getUTCDate()} 日`;
}

function formatDeclination(value: number) {
  if (Math.abs(value) < .05) return '0.0°';
  return `${Math.abs(value).toFixed(1)}°${value > 0 ? 'N' : 'S'}`;
}

function astronomyFor(day: number) {
  const normalized = day >= 365 ? 0 : day;
  const declination = declinationForCalendarDay(day);
  const near = (target: number) => Math.abs(normalized - target) < 1.35;

  let daylight = '';
  if (near(0) || near(186)) daylight = '昼夜等长';
  else if (normalized < 93) daylight = '昼渐长 · 夜渐短';
  else if (normalized < 186) daylight = '昼渐短 · 夜渐长（仍昼长）';
  else if (normalized < 276) daylight = '昼渐短 · 夜渐长';
  else daylight = '昼渐长 · 夜渐短（仍昼短）';

  const halfYear = normalized < 186 ? '北半球夏半年' : '北半球冬半年';
  const boundary = 90 - Math.abs(declination);
  let polar = '全球无极昼极夜';
  if (Math.abs(declination) >= .7) {
    polar = declination > 0
      ? `北纬 ${boundary.toFixed(1)}° 以北极昼 · 南极对应极夜`
      : `南纬 ${boundary.toFixed(1)}° 以南极昼 · 北极对应极夜`;
  }

  let note = '晨昏线与经线重合，全球昼夜等长';
  if (declination > .7) note = '太阳直射北半球，北半球昼长于夜';
  if (declination < -.7) note = '太阳直射南半球，北半球昼短于夜';
  if (Math.abs(declination) > 23.35) note = declination > 0
    ? '北回归线接受直射光，北极圈极昼达到最大范围'
    : '南回归线接受直射光，南极圈极昼达到最大范围';

  return { declination, daylight, halfYear, polar, note };
}

export default function Home() {
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [solar, setSolar] = useState(false);
  const [showPolar, setShowPolar] = useState(true);
  const [day, setDay] = useState(0);
  const dayRef = useRef(day);
  const [view, setView] = useState<ViewMode>('equator');
  const [activeView, setActiveView] = useState<ViewMode | 'free'>('equator');
  const [viewRequest, setViewRequest] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [spinPaused, setSpinPaused] = useState(false);
  const [annualPlaying, setAnnualPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(2);
  const [resetSignal, setResetSignal] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const drawerWasOpenRef = useRef(false);
  const speed = SPEEDS[speedIndex];
  const astronomy = useMemo(() => astronomyFor(day), [day]);
  const term = nearestTerm(day);
  const progress = Math.min(day / 365 * 100, 100);

  useEffect(() => {
    dayRef.current = day;
  }, [day]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const respectPreference = () => {
      if (!preference.matches) return;
      setAutoRotate(false);
      setSpinPaused(true);
      setAnnualPlaying(false);
    };
    const frame = requestAnimationFrame(respectPreference);
    preference.addEventListener('change', respectPreference);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener('change', respectPreference);
    };
  }, []);

  useEffect(() => {
    if (!annualPlaying) return;
    let frame = 0;
    let previous = performance.now();
    const advance = (now: number) => {
      const deltaSeconds = Math.min((now - previous) / 1000, .1);
      previous = now;
      const next = dayRef.current + deltaSeconds * 10.5 * speed;
      if (next >= 365) {
        dayRef.current = 365;
        setDay(365);
        setAnnualPlaying(false);
        return;
      }
      dayRef.current = next;
      setDay(next);
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [annualPlaying, speed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && controlsOpen) {
        setControlsOpen(false);
        return;
      }
      if (event.key === 'Tab' && controlsOpen && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'))
          .filter((element) => element.offsetParent !== null);
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controlsOpen]);

  useEffect(() => {
    if (controlsOpen) {
      drawerWasOpenRef.current = true;
      const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    if (drawerWasOpenRef.current) {
      drawerWasOpenRef.current = false;
      menuButtonRef.current?.focus();
    }
  }, [controlsOpen]);

  const selectDay = (value: number) => {
    setAnnualPlaying(false);
    dayRef.current = value;
    setDay(value);
  };

  const toggleAnnual = () => {
    if (!annualPlaying && dayRef.current >= 364.9) {
      dayRef.current = 0;
      setDay(0);
    }
    setAnnualPlaying(playing => !playing);
  };

  const resetAll = () => {
    dayRef.current = 0;
    setDay(0);
    setSolar(false);
    setShowPolar(true);
    setView('equator');
    setActiveView('equator');
    setViewRequest((value) => value + 1);
    setAutoRotate(true);
    setSpinPaused(false);
    setAnnualPlaying(false);
    setSpeedIndex(2);
    setResetSignal((value) => value + 1);
  };

  const changeSpeed = (direction: -1 | 1) => {
    setSpeedIndex((index) => Math.max(0, Math.min(SPEEDS.length - 1, index + direction)));
  };

  return (
    <main className={`sim-shell ${panelCollapsed ? 'panel-collapsed' : ''}`}>
      <header className="sim-header">
        <button
          className="mobile-menu"
          type="button"
          ref={menuButtonRef}
          aria-expanded={controlsOpen}
          aria-controls="control-panel"
          onClick={() => setControlsOpen(true)}
        >
          <span aria-hidden="true">☰</span> 控制台
        </button>
        <div className="header-center">
          <h1><i aria-hidden="true">◉</i> 地球自转与昼夜交替</h1>
        </div>
        <div className="system-status"><i /> 模拟运行中</div>
      </header>

      {controlsOpen && <button className="drawer-scrim" aria-label="关闭控制台" onClick={() => setControlsOpen(false)} />}

      <section className="workspace">
        <aside ref={panelRef} id="control-panel" className={`control-panel ${controlsOpen ? 'open' : ''}`} aria-label="模拟控制面板">
          <button ref={closeButtonRef} className="drawer-close" type="button" aria-label="关闭控制台" onClick={() => setControlsOpen(false)}>×</button>
          <div className="panel-heading">
            <h2>观察控制台</h2>
          </div>

          <div className="scene-tabs" aria-label="模型视图">
            <button aria-pressed={!solar} onClick={() => {setSolar(false); setControlsOpen(false);}}>地球视角</button>
            <button aria-pressed={solar} onClick={() => {setSolar(true); setControlsOpen(false);}}>太阳中心视角</button>
          </div>
          <label className="polar-toggle"><input type="checkbox" checked={showPolar} onChange={e => setShowPolar(e.target.checked)} />显示南北极圈（66.5°）</label>
          <div className="season-presets"><strong>一键定格节气</strong><div>
            {QUARTERS.slice(0,4).map(q => <button key={q.name} aria-pressed={Math.abs(day-q.day)<.01} onClick={() => {selectDay(q.day); setSpinPaused(true);}}>{q.name}</button>)}
          </div></div>
          <div className="control-section">
            <div className="section-label"><span>01</span><label>切换视角</label></div>
            <div className="segmented view-buttons">
              {(['equator', 'south', 'north'] as ViewMode[]).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  className={activeView === mode ? 'active' : ''}
                  aria-pressed={activeView === mode}
                  onClick={() => {
                    setView(mode);
                    setActiveView(mode);
                    setViewRequest((value) => value + 1);
                    setControlsOpen(false);
                  }}
                >
                  <span aria-hidden="true">{mode === 'equator' ? '◐' : mode === 'north' ? '△' : '▽'}</span>
                  {VIEW_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>

          <div className="control-section">
            <div className="section-label"><span>02</span><label>视图控制</label></div>
            <div className="button-grid">
              <button
                type="button"
                className={autoRotate ? 'toggle-button active' : 'toggle-button'}
                aria-pressed={autoRotate}
                onClick={() => { setAutoRotate((value) => !value); setSpinPaused(false); }}
              >
                <i className="status-dot" /> 地球自转 <b>{autoRotate ? 'ON' : 'OFF'}</b>
              </button>
              <button
                type="button"
                className={spinPaused ? 'small-button active' : 'small-button'}
                aria-pressed={spinPaused}
                disabled={!autoRotate}
                onClick={() => setSpinPaused((value) => !value)}
              >
                {spinPaused ? '▶ 恢复自转' : 'Ⅱ 暂停自转'}
              </button>
              <button type="button" className="small-button" onClick={resetAll}>↺ 重置一切</button>
            </div>
          </div>

          <div className="control-section time-control">
            <div className="section-label"><span>03</span><label htmlFor="year-progress">公转时间进程</label></div>
            <div className="progress-readout"><strong>{term}</strong><span>{formatDate(day)} · 第 {Math.min(Math.round(day) + 1, 365).toString().padStart(3, '0')} 天</span></div>
            <input
              id="year-progress"
              className="year-range"
              type="range"
              min="0"
              max="365"
              step=".1"
              value={day}
              aria-valuetext={`${term}，${formatDate(day)}`}
              onChange={(event) => selectDay(Number(event.target.value))}
            />
            <div className="range-quarters">
              {QUARTERS.map((quarter, index) => (
                <span key={`${quarter.name}-${quarter.day}`} className={index === 0 ? 'first' : index === QUARTERS.length - 1 ? 'last' : ''} style={{ left: `${quarter.day / 365 * 100}%` }}>{quarter.name}</span>
              ))}
            </div>
          </div>

          <div className="control-section speed-control">
            <div className="section-label"><span>04</span><label>播放速度</label></div>
            <div className="speed-stepper">
              <button type="button" aria-label="减慢播放速度" disabled={speedIndex === 0} onClick={() => changeSpeed(-1)}>−</button>
              <div><strong>{speed.toFixed(2)}</strong><span>倍速</span></div>
              <button type="button" aria-label="加快播放速度" disabled={speedIndex === SPEEDS.length - 1} onClick={() => changeSpeed(1)}>＋</button>
            </div>
          </div>

          <button className={`play-button ${annualPlaying ? 'playing' : ''}`} type="button" aria-pressed={annualPlaying} onClick={toggleAnnual}>
            <span aria-hidden="true">{annualPlaying ? 'Ⅱ' : '▶'}</span>
            <strong>{annualPlaying ? '暂停公转' : day >= 364.9 ? '重新播放公转' : '播放公转'}</strong>
            <i aria-hidden="true">→</i>
          </button>

          <div className="astro-card" role="status" aria-live={annualPlaying ? 'off' : 'polite'}>
            <div className="astro-head"><div><i /> 实时天文参数</div></div>
            <dl>
              <div><dt>太阳直射点纬度</dt><dd className="primary-value">{formatDeclination(astronomy.declination)}</dd></div>
              <div><dt>季节阶段</dt><dd>{astronomy.halfYear}</dd></div>
              <div><dt>北半球昼夜</dt><dd>{astronomy.daylight}</dd></div>
            </dl>
            <div className={`polar-note ${Math.abs(astronomy.declination) > 20 ? 'alert' : ''}`}>
              <span aria-hidden="true">◒</span><div><small>极昼 / 极夜范围</small><strong>{astronomy.polar}</strong></div>
            </div>
          </div>
        </aside>

        <div className="stage" aria-label="地球昼夜三维模拟区">
          <div className="stage-grid" aria-hidden="true" />
          <div className="stage-toolbar">
            <div className="view-indicator"><i /> 当前视角 <strong>{solar ? '太阳中心视角' : activeView === 'free' ? '自由视角' : VIEW_LABELS[activeView]}</strong></div>
            <div className="stage-actions"><button className="panel-collapse-button" aria-controls="control-panel" aria-expanded={!panelCollapsed} onClick={() => setPanelCollapsed(v => !v)}>{panelCollapsed ? '显示控制台' : '隐藏控制台'}</button><button onClick={() => {setView('equator'); setActiveView('equator'); setViewRequest(v=>v+1);}}>完整显示</button></div>
            <div className="interaction-hints" aria-label="交互提示">
              <span>↔ 拖拽旋转</span><span>⌁ 滚轮缩放</span>
            </div>
          </div>

          <EarthScene
            solar={solar}
            showPolar={showPolar}
            day={day}
            view={view}
            viewRequest={viewRequest}
            autoRotate={autoRotate}
            spinPaused={spinPaused}
            speed={speed}
            resetSignal={resetSignal}
            onFreeView={() => setActiveView('free')}
          />

          <div className="boundary-legend"><span>━ 晨线</span><span>━ 昏线</span><small>箭头为自西向东自转方向 · 点击白色位置点显示城市名称</small>{solar && <small>太阳直径实际约为地球的 109 倍；地球已放大，距离与速度为教学示意</small>}{solar && <small className="latitude-legend">橙色实线：赤道 0° · 橙色虚线：回归线 ±23.5°{showPolar && ' · 绿色虚线：极圈 ±66.5°'}</small>}</div>
          <div className="stage-note"><span className="pulse" /><div><strong>{term} · {formatDeclination(astronomy.declination)}</strong><p>{astronomy.note}</p></div></div>
          <a className="sun-credit" href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">太阳纹理：Solar System Scope · CC BY 4.0</a>
          <div className="axis-badge"><span>23.5°</span><small>地轴倾角固定</small></div>
          <div className="scale-markers" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        </div>
      </section>

      <footer className="timeline" aria-label="二十四节气时间轴">
        <div className="timeline-meta"><strong>{progress.toFixed(1)}%</strong></div>
        <div className="timeline-main">
          <input
            className="timeline-range"
            type="range"
            min="0"
            max="365"
            step=".1"
            value={day}
            aria-label="全年公转时间轴"
            aria-valuetext={`${term}，${formatDate(day)}`}
            onChange={(event) => selectDay(Number(event.target.value))}
          />
          <div className="timeline-line" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          <div className="terms-grid">
            {TERMS.map(({ name, day: termDay }, index) => {
              const major = index % 6 === 0;
              const solstice = index === 6 || index === 18;
              return (
                <button
                  type="button"
                  className={`term ${major ? 'major' : ''} ${solstice ? 'solstice' : ''}`}
                  key={name}
                  style={{ left: `${termDay / 365 * 100}%` }}
                  aria-label={`跳转到${name}`}
                  title={name}
                  onClick={() => selectDay(termDay)}
                >
                  <i /><span>{major ? name : ''}</span>
                </button>
              );
            })}
          </div>
          <div className="time-cursor" aria-hidden="true" style={{ left: `${progress}%` }}><i /></div>
        </div>
        <div className="timeline-current"><span>{formatDate(day)}</span><strong>{term}</strong></div>
      </footer>
    </main>
  );
}
