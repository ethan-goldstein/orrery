import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Engine, type ExperienceFactory } from '@/engine/Engine';
import { experienceStore } from '@/store/experience';

const EngineCtx = createContext<Engine | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);

  useEffect(() => {
    if (!containerRef.current || !stageRef.current) return;
    const e = new Engine(containerRef.current, stageRef.current);
    setEngine(e);
    return () => {
      e.dispose();
      setEngine(null);
    };
  }, []);

  return (
    <div ref={containerRef} className="engine-root h-full w-full">
      <div ref={stageRef} className="stage" aria-label="Interactive 3D view. Drag to orbit, scroll to zoom." role="application" />
      <EngineCtx.Provider value={engine}>{children}</EngineCtx.Provider>
    </div>
  );
}

export function useEngine(): Engine | null {
  return useContext(EngineCtx);
}

/** Mount an experience for the lifetime of the calling page component. */
export function useExperience(id: string, factory: ExperienceFactory): void {
  const engine = useEngine();
  useEffect(() => {
    if (!engine) return;
    experienceStore.getState().set({ active: id, load: 'loading', status: 'Preparing your view…' });
    let cancelled = false;
    engine.mount(factory).then(() => {
      if (cancelled) return;
      const state = engine.renderer.canvas.dataset.experienceState;
      experienceStore.getState().set({
        load: state === 'error' ? 'error' : 'ready',
        status: state === 'error' ? 'This world could not load. Reload to try again.' : '',
      });
    });
    return () => {
      cancelled = true;
      engine.unmount();
      experienceStore.getState().set({ active: null, load: 'idle', status: '' });
    };
    // factory identity is stable per page module, so only engine and id are deps
  }, [engine, id]);
}
