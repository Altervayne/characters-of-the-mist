// -- Component Imports --
import { CharacterTab } from './CharacterTab';
import { BoardTab } from './BoardTab';

// -- Type Imports --
import type { OpenTab } from '@/lib/character/tabManagerStore';

/**
 * A single tab in the desktop {@link import('./TabStrip').TabStrip}, dispatched by
 * kind: a {@link BoardTab} for board tabs, a {@link CharacterTab} otherwise. Both share
 * the presentational {@link import('./TabShell').TabShell} (drag-to-reorder, active
 * styling, close button), so the strip treats every tab identically.
 *
 * @param props.tab - The tab descriptor (its `type` selects the kind, its `id` keys the store instance).
 * @param props.isActive - Whether this tab is the active one (drives the highlight).
 */
export function Tab({ tab, isActive }: { tab: OpenTab; isActive: boolean }) {
   return tab.type === 'board' ? <BoardTab tab={tab} isActive={isActive} /> : <CharacterTab tab={tab} isActive={isActive} />;
}
