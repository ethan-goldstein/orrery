import { clockStore } from '@/store/clock';
import { experienceStore } from '@/store/experience';
import { cameraStore } from '@/store/camera';
import { shellStore } from '@/store/shell';

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

/** Site-wide keys. Pages add their own on top. */
export function installGlobalShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.shiftKey && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = 0.15;
      cameraStore.getState().nudge(e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0, e.key === 'ArrowUp' ? -step * 0.7 : e.key === 'ArrowDown' ? step * 0.7 : 0);
      return;
    }
    switch (e.key) {
      case '+':
      case '=':
        cameraStore.getState().zoomIn();
        break;
      case '-':
      case '_':
        cameraStore.getState().zoomOut();
        break;
      case '0':
        cameraStore.getState().reset();
        break;
      case 'i':
      case 'I':
        shellStore.getState().toggleDrawer();
        break;
      case ' ':
        e.preventDefault();
        clockStore.getState().toggle();
        break;
      case 'n':
      case 'N':
        clockStore.getState().setFollowNow(true);
        break;
      case 'h':
      case 'H':
        experienceStore.getState().set({ cleanView: !experienceStore.getState().cleanView });
        break;
      case 'f':
      case 'F':
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
        break;
      case '[':
      case ']': {
        const c = clockStore.getState();
        const steps = [1, 60, 3600, 86_400, 259_200, 864_000, 2_629_800, 31_557_600];
        const i = steps.findIndex((s) => s >= c.rate);
        const next = e.key === ']' ? Math.min(steps.length - 1, (i < 0 ? steps.length - 1 : i) + 1) : Math.max(0, (i < 0 ? steps.length : i) - 1);
        c.setRate(steps[next]!);
        break;
      }
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
