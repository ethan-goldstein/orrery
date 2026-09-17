import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import { useExperience } from '@/store/experience';
import { clockStore } from '@/store/clock';
import { settingsStore } from '@/store/settings';
import { useLocation } from 'wouter';
import { ROUTES } from '@/app/route-list';
import { cameraStore } from '@/store/camera';
import { shellStore } from '@/store/shell';
import { experienceStore } from '@/store/experience';
import { useEngine } from '@/app/EngineContext';
import { captureFrame, copyLinkToClipboard, downloadFile } from '@/ui/shell/share';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const commands = useExperience((s) => s.commands);
  const active = useExperience((s) => s.active);
  const engine = useEngine();
  const [, navigate] = useLocation();
  // a short line in the status slot above the instrument bar
  const say = (text: string) => {
    experienceStore.getState().set({ status: text });
    setTimeout(() => {
      if (experienceStore.getState().status === text) experienceStore.getState().set({ status: '' });
    }, 3000);
  };

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
        <Command.Group heading="Camera">
          <Command.Item onSelect={() => run(() => cameraStore.getState().zoomIn())}>Zoom in</Command.Item>
          <Command.Item onSelect={() => run(() => cameraStore.getState().zoomOut())}>Zoom out</Command.Item>
          <Command.Item onSelect={() => run(() => cameraStore.getState().reset())}>Reset the view</Command.Item>
          <Command.Item onSelect={() => run(() => shellStore.getState().toggleDrawer())}>Show or hide the facts</Command.Item>
          <Command.Item onSelect={() => run(() => experienceStore.getState().set({ cleanView: !experienceStore.getState().cleanView }))}>Hide or show the interface</Command.Item>
        </Command.Group>
        <Command.Group heading="Share">
          <Command.Item
            onSelect={() =>
              run(() => {
                void copyLinkToClipboard().then((ok) => say(ok ? 'Link copied' : 'Copy failed'));
              })
            }
          >
            Copy a link to this view
          </Command.Item>
          <Command.Item
            disabled={!active || active === 'home'}
            onSelect={() =>
              run(() => {
                void captureFrame(engine, active)
                  .then((file) => {
                    if (!file) throw new Error('no frame');
                    downloadFile(file);
                    say(`Saved ${file.name}`);
                  })
                  .catch(() => say('Could not capture the frame'));
              })
            }
          >
            Save an image of this view
          </Command.Item>
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
