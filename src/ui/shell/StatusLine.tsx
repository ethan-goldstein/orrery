import { useExperience } from '@/store/experience';

export function StatusLine() {
  const load = useExperience((s) => s.load);
  const status = useExperience((s) => s.status);
  return (
    <p role="status" aria-live="polite" className="kicker min-h-4" data-load={load}>
      {status}
    </p>
  );
}
