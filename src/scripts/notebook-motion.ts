const root = document.documentElement;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const pageKey = (url: URL) => `${url.pathname.replace(/\/+$/, '') || '/'}${url.search}`;
let navigating = false;
let stopTurn: (() => void) | undefined;

function clearTurn() {
  stopTurn?.();
  stopTurn = undefined;
  delete root.dataset.notebookDeparture;
  delete root.dataset.notebookArrival;
}

/** A temporary, inert paper surface. The real document keeps its layout and focus. */
function makePaper(sheet: HTMLElement) {
  const rect = sheet.getBoundingClientRect();
  const top = Math.max(0, rect.top);
  const height = Math.min(innerHeight, rect.bottom) - top;
  if (height <= 0) throw new Error('The notebook is outside the viewport');
  const width = rect.width;
  const count = width < 600 ? 28 : 40;
  const stripWidth = width / count;
  const layer = document.createElement('div');
  layer.className = 'notebook-turn-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;

  const stage = document.createElement('div');
  stage.className = 'notebook-turn-stage';
  stage.style.cssText = `left:${rect.left}px;top:${top}px;width:${width}px;height:${height}px`;
  const underlay = document.createElement('div');
  underlay.className = 'notebook-turn-underlay';
  const shadow = document.createElement('div');
  shadow.className = 'notebook-fold-shadow';
  stage.append(underlay, shadow);

  const template = sheet.cloneNode(true) as HTMLElement;
  template.removeAttribute('data-notebook-page');
  template.setAttribute('data-notebook-copy', '');
  template.style.cssText = `position:absolute;top:${rect.top - top}px;width:${width}px;max-width:none;min-height:0;margin:0;box-shadow:none;transform:none;visibility:visible`;
  template.querySelectorAll('script, iframe, audio, video').forEach((element) => element.remove());
  template.querySelectorAll('[id]').forEach((element) => {
    element.setAttribute('data-notebook-id', element.id);
    element.removeAttribute('id');
  });
  template.querySelectorAll('input, textarea, select, button').forEach((element) => {
    element.removeAttribute('name');
    element.removeAttribute('autofocus');
  });

  const strips = Array.from({ length: count }, (_, index) => {
    const strip = document.createElement('div');
    strip.className = 'notebook-paper-strip';
    // A subpixel overlap prevents hairline gaps between the curved segments.
    strip.style.width = `${stripWidth + 0.6}px`;
    const front = document.createElement('div');
    front.className = 'notebook-paper-front';
    const copy = template.cloneNode(true) as HTMLElement;
    copy.style.left = `${-index * stripWidth}px`;
    front.append(copy);
    const back = document.createElement('div');
    back.className = 'notebook-paper-back';
    strip.append(front, back);
    stage.append(strip);
    return strip;
  });
  layer.append(stage);
  document.body.append(layer);

  return {
    draw(progress: number) {
      // A travelling cylindrical bend, rather than one rotation of the page.
      // The flat section stays on the desk while the outer edge rolls over it.
      const radius = width * (0.14 + 0.035 * Math.sin(progress * Math.PI));
      const crease = width * (1 - progress * 1.9);
      const point = (position: number) => {
        const distance = Math.max(0, position - crease);
        const angle = Math.min(Math.PI, distance / radius);
        const x =
          distance === 0
            ? position
            : crease + radius * Math.sin(angle) - Math.max(0, distance - Math.PI * radius);
        const z = radius * (1 - Math.cos(angle));
        return { x, z, angle };
      };
      strips.forEach((strip, index) => {
        const start = point(index * stripWidth);
        const end = point((index + 1) * stripWidth);
        // Join actual curve endpoints: tangent-only strips leave visible gaps.
        const angle = Math.atan2(end.z - start.z, end.x - start.x);
        const length = Math.hypot(end.x - start.x, end.z - start.z);
        strip.style.transform = `translate3d(${start.x}px,0,${start.z}px) rotateY(${-angle}rad) scaleX(${length / stripWidth})`;
        strip.style.setProperty('--fold-shade-start', `${Math.sin(start.angle) * 0.28}`);
        strip.style.setProperty('--fold-shade-end', `${Math.sin(end.angle) * 0.28}`);
      });
      shadow.style.transform = `translateX(${Math.max(-width * 0.15, crease)}px)`;
      shadow.style.opacity = `${Math.sin((Math.min(1, progress * 2) * Math.PI) / 2) * (1 - progress) * 0.38}`;
    },
    remove() {
      layer.remove();
    },
  };
}

function turnPaper(phase: 'depart' | 'arrive'): Promise<void> {
  stopTurn?.();
  const sheet = document.querySelector<HTMLElement>('[data-notebook-page]');
  if (!sheet || motionPreference.matches) {
    clearTurn();
    return Promise.resolve();
  }
  let paper: ReturnType<typeof makePaper>;
  try {
    paper = makePaper(sheet);
  } catch {
    clearTurn();
    return Promise.resolve();
  }
  const duration = phase === 'depart' ? 620 : 480;
  return new Promise((resolve) => {
    let frame = 0;
    let done = false;
    let started = 0;
    let watchdog: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      cancelAnimationFrame(frame);
      clearTimeout(watchdog);
      paper.remove();
      removeEventListener('resize', cancel);
      removeEventListener('beforeprint', cancel);
      motionPreference.removeEventListener('change', cancel);
    };
    const cancel = () => {
      cleanup();
      delete root.dataset.notebookDeparture;
      delete root.dataset.notebookArrival;
      if (!done) {
        done = true;
        resolve();
      }
    };
    stopTurn = cancel;
    addEventListener('resize', cancel, { once: true });
    addEventListener('beforeprint', cancel, { once: true });
    motionPreference.addEventListener('change', cancel, { once: true });
    // Timers still release navigation if frames are throttled in a hidden tab.
    watchdog = setTimeout(cancel, duration + 500);
    const initial = phase === 'depart' ? 0 : 0.32;
    paper.draw(initial);
    const tick = (now: number) => {
      started ||= now;
      const time = Math.min(1, (now - started) / duration);
      const progress = phase === 'depart' ? 0.78 * time ** 1.45 : 0.32 * (1 - time) ** 2.4;
      paper.draw(progress);
      if (time < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        done = true;
        if (phase === 'arrive') {
          cleanup();
          delete root.dataset.notebookArrival;
          stopTurn = undefined;
        }
        // Departures hold the last frame until pagehide, avoiding a flash of
        // the old page. The watchdog also releases a navigation that stalls.
        resolve();
      }
    };
    frame = requestAnimationFrame(tick);
  });
}

document.addEventListener('click', async (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    motionPreference.matches
  )
    return;
  const link =
    event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
  if (
    !link ||
    link.hasAttribute('download') ||
    (link.target && link.target !== '_self') ||
    link.hasAttribute('data-no-page-turn')
  )
    return;
  const next = new URL(link.href, location.href);
  if (
    next.origin !== location.origin ||
    !/^https?:$/.test(next.protocol) ||
    pageKey(next) === pageKey(new URL(location.href)) ||
    /^\/admin(?:\/|$)/.test(next.pathname) ||
    (/\.[a-z0-9]+$/i.test(next.pathname) && !/\.html?$/i.test(next.pathname))
  )
    return;
  if (!document.querySelector('[data-notebook-page]')) return;
  event.preventDefault();
  if (navigating) return;
  navigating = true;
  clearTurn();
  root.dataset.notebookDeparture = 'forward';
  await turnPaper('depart');
  if (!navigating) return;
  try {
    sessionStorage.setItem(
      'notebook-page-turn',
      JSON.stringify({ to: pageKey(next), at: Date.now() }),
    );
  } catch {
    /* Storage is optional; following a link never depends on it. */
  }
  location.assign(next.href);
});

addEventListener('pagehide', () => {
  navigating = false;
  clearTurn();
});
addEventListener('pageshow', (event) => {
  navigating = false;
  const historyNavigation =
    event.persisted ||
    (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type ===
      'back_forward';
  if (historyNavigation && !motionPreference.matches) root.dataset.notebookArrival = 'back';
  if (root.dataset.notebookArrival) void turnPaper('arrive');
});
