// -- Type Imports --
import type { LinkAction } from './linkTarget';

/*
 * The imperative Portals dispatch: runs a resolved {@link LinkAction} by delegating to injected services (no
 * baked store imports, so it stays a thin, swappable seam). Phase 1 executes the "easy" actions - section
 * scroll, external open, and entity open-or-create-tab; the context-dependent element actions
 * (`spawn-on-board`/`reveal-in-drawer`) are Phase 3, wired here only as a graceful deferred notice.
 */

/** The services the dispatch composes. `openExternal` defaults to `window.open`; the rest are always injected. */
export interface RunLinkActionDeps {
   /** Opens (or focuses) an entity's tab, resolving the aggregate and toasting on a dead target. */
   openEntityTab: (entity: 'note' | 'board' | 'character', id: string) => void | Promise<void>;
   /** Scrolls the calling surface to a same-note section slug (a dead slug is the surface's own no-op). */
   scrollToSection: (slug: string) => void;
   /** Notifies that a context-dependent element action is deferred to a later phase (a toast). */
   notifyDeferred: (action: 'spawn-on-board' | 'reveal-in-drawer') => void;
   /** Opens an external URL. Defaults to a `noopener,noreferrer` new tab. */
   openExternal?: (href: string) => void;
}

/** Runs `action` against the injected services. Fire-and-forget: entity opens are async but not awaited here. */
export function runLinkAction(action: LinkAction, deps: RunLinkActionDeps): void {
   switch (action.type) {
      case 'scroll-section':
         deps.scrollToSection(action.slug);
         return;
      case 'open-tab':
         void deps.openEntityTab(action.entity, action.id);
         return;
      case 'open-external':
         (deps.openExternal ?? defaultOpenExternal)(action.href);
         return;
      case 'spawn-on-board':
         deps.notifyDeferred('spawn-on-board');
         return;
      case 'reveal-in-drawer':
         deps.notifyDeferred('reveal-in-drawer');
         return;
      case 'noop':
         return;
   }
}

/** The default external open: a new tab with the opener/referrer severed. */
function defaultOpenExternal(href: string): void {
   window.open(href, '_blank', 'noopener,noreferrer');
}
