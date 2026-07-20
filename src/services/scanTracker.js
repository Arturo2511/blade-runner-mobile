import { getMetrics, triggerScan } from './backendApi';

const active = new Map();
const listeners = new Set();

const keyOf = (projectUrl, prId) => `${projectUrl}#${prId}`;

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

export function subscribeScans(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isScanning(projectUrl, prId) {
  return active.has(keyOf(projectUrl, String(prId)));
}

export async function startScan(projectUrl, prId) {
  const key = keyOf(projectUrl, String(prId));
  if (active.has(key)) return;

  const before = await getMetrics(projectUrl, String(prId));
  const prevDate = before?.sonarMetrics?.analysisDate || null;

  await triggerScan(projectUrl, String(prId));

  active.set(key, true);
  emit();

  let tries = 0;
  const timer = setInterval(async () => {
    tries += 1;
    const data = await getMetrics(projectUrl, String(prId));
    const newDate = data?.sonarMetrics?.analysisDate || null;
    const done =
      !!data && (prevDate === null || (newDate !== null && newDate !== prevDate));
    if (done || tries >= 90) {
      clearInterval(timer);
      active.delete(key);
      emit();
    }
  }, 10000);
}
