import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ROUTES } from "@/app/route-list";
import { useExperience } from "@/store/experience";
import { SourcesDialog } from "@/ui/SourcesDialog";
import { SettingsButton } from "@/ui/Settings";
import { ShareMenu } from "./ShareMenu";
import { prefetchRoute } from "@/app/prefetch";
import { Glyph, type GlyphName } from "./icons";

/**
 * The left rail: one glyph per world, the wordmark on top, sources, settings
 * and the repository at the foot. Becomes a horizontal strip on phones.
 */
export function Rail() {
  const [location] = useLocation();
  const cleanView = useExperience((s) => s.cleanView);
  const [sources, setSources] = useState(false);
  if (cleanView) return <div className="rail rail-hidden" aria-hidden="true" />;
  return (
    <>
      <nav aria-label="Worlds" className="rail" data-ui>
        <Link
          href="/"
          className="rail-home"
          aria-label="Orrery home"
          aria-current={location === "/" ? "page" : undefined}
          data-tip="Orrery"
        >
          <Glyph.orrery size={26} />
        </Link>
        <ul className="rail-list">
          {ROUTES.filter((r) => r.id !== "home").map((r) => {
            const Icon = Glyph[r.id as GlyphName] ?? Glyph.solar;
            const active = location === r.path;
            return (
              <li key={r.id}>
                <Link
                  href={r.path}
                  className={`rail-link${active ? " is-active" : ""}`}
                  aria-label={r.nav}
                  aria-current={active ? "page" : undefined}
                  data-tip={r.nav}
                  onPointerEnter={() => prefetchRoute(r.id)}
                  onFocus={() => prefetchRoute(r.id)}
                >
                  <Icon />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="rail-foot">
          <ShareMenu />
          <button
            className="rail-link"
            onClick={() => setSources(true)}
            data-testid="sources-button"
            aria-label="Sources and credits"
            data-tip="Sources"
          >
            <Glyph.sources />
          </button>
          <SettingsButton />
          <a
            href="https://github.com/ethan-goldstein/orrery"
            target="_blank"
            rel="noopener noreferrer"
            className="rail-link"
            aria-label="Source code on GitHub"
            data-tip="GitHub"
          >
            <Glyph.github />
          </a>
        </div>
      </nav>
      <SourcesDialog open={sources} onClose={() => setSources(false)} />
    </>
  );
}
