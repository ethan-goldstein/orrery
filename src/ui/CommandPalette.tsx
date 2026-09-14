import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import { useExperience } from '@/store/experience';
import { clockStore } from '@/store/clock';
import { settingsStore } from '@/store/settings';
import { useLocation } from 'wouter';
import { ROUTES } from '@/app/route-list';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const commands = useExperience((s) => s.commands);
  const [, navigate] = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Command palette" className="palette" data-ui overlayClassName="palette-overlay" contentClassName="palette-content">
      <Command.Input placeholder="Search worlds, views, commands…" autoFocus className="palette-input" />
      <Command.List className="palette-list">
        <Command.Empty className="palette-empty">Nothing found.</Command.Empty>
        <Command.Group heading="Time">
          <Command.Item onSelect={() => run(() => clockStore.getState().setFollowNow(true))}>Jump to now</Command.Item>
          <Command.Item onSelect={() => run(() => clockStore.getState().toggle())}>Play / pause time</Command.Item>
        </Command.Group>
        <Command.Group heading="Pages">
          {ROUTES.filter((r) => r.id !== 'home').map((r) => (
            <Command.Item key={r.id} onSelect={() => run(() => navigate(r.path))}>
              Open {r.nav}
            </Command.Item>
          ))}
        </Command.Group>
        {groupBy(commands).map(([group, items]) => (
          <Command.Group key={group} heading={group}>
            {items.map((c) => (
              <Command.Item key={c.id} value={`${c.label} ${c.keywords?.join(' ') ?? ''}`} onSelect={() => run(c.run)}>
                {c.label}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
        <Command.Group heading="Settings">
          {(['auto', 'low', 'med', 'high', 'ultra'] as const).map((q) => (
            <Command.Item key={q} onSelect={() => run(() => settingsStore.getState().setQuality(q))}>
              Quality: {q}
            </Command.Item>
          ))}
          <Command.Item onSelect={() => run(() => settingsStore.getState().setLabels(!settingsStore.getState().labels))}>Toggle labels</Command.Item>
          <Command.Item onSelect={() => run(() => settingsStore.getState().setGrain(!settingsStore.getState().grain))}>Toggle film grain</Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

function groupBy<T extends { group: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const i of items) map.set(i.group, [...(map.get(i.group) ?? []), i]);
  return [...map.entries()];
}
