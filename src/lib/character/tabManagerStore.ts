// -- Other Library Imports --
import { create } from 'zustand';

// -- Utils Imports --
import { harmonizeData } from '@/lib/harmonization';

// -- Store Imports --
import { buildNewCharacter } from '@/lib/stores/characterStore';

// -- Local Imports --
import {
   SINGLE_ACTIVE_INSTANCE_ID,
   disposeInstance,
   getCharacterInstanceIds,
   getMenuFallbackInstance,
   getOrCreateInstance,
   setActiveInstance,
} from './characterStoreRegistry';
import { attachPersistenceHandle, detachPersistenceHandle, finishBootHydration } from './characterPersistence';
import { getCharacter } from './characterRepository';
import { readWorkspace, writeWorkspace } from './workspaceSession';
import { getEffectiveDeviceType } from '@/hooks/useDeviceType';

// -- Type Imports --
import type { Character } from '@/lib/types/character';
import type { GameSystem } from '@/lib/types/drawer';
import type { Workspace } from './workspaceSession';

/*
 * TabManager (tabs spec §1.2, §3, §4, §7) — owns the open/create/close lifecycle of
 * character tabs: instance creation/disposal, persistence-handle attach/detach, the
 * registry's active pointer, and the workspace session pointer. The per-character
 * store actions (loadCharacter etc.) stay strictly per-character; the TabManager
 * calls them internally to populate or clear an instance, while the UI drives it.
 *
 * PLATFORM SPLIT (Phase 4):
 * - DESKTOP keeps every open instance live (focus-or-add; dispose only on explicit
 *   `closeTab`). "Return to Menu" = `deactivate()` (show the menu, keep the tabs).
 * - MOBILE holds at most ONE live character instance (plus the permanent menu
 *   fallback): the `mobile*` actions dispose the current live instance before
 *   opening/creating the next, but never prune `openTabs` (the shared desktop set).
 * Boot is platform-aware (`runCharacterBoot`): desktop hydrates all tabs (active
 * first), mobile hydrates only the active one.
 */

/** The kind of a tab. Only characters exist today; Boards/Notes are additive later (spec §1.2). */
export type TabType = 'character';

/** A tab in the workspace, in tab order. */
export interface OpenTab {
   /** For a character tab, the character id keying its store instance and handle. */
   id: string;
   /** Discriminant for the tab's content type. */
   type: TabType;
}

interface TabManagerState {
   /** Open tabs in order. */
   openTabs: OpenTab[];
   /** The active tab's id, or `null` when at the menu (the menu fallback instance is active). */
   activeTabId: string | null;
   actions: {
      // -- Desktop (keep-alive) --
      /** Creates a brand-new character of `game`, appends it as a tab, activates it, and persists it. */
      createCharacterTab: (game: GameSystem) => void;
      /** Opens an existing/imported `character`; focuses its tab if already open, else appends + activates. */
      openCharacterTab: (character: Character, drawerItemId?: string) => void;
      /** Closes tab `id` (flush → detach → dispose) and activates a neighbour, or the menu when none remain. */
      closeTab: (id: string) => void;
      /** Convenience: closes the currently active tab. */
      closeActiveTab: () => void;
      /** Activates an already-open tab by id WITHOUT disposing the previously active one (keep-alive). */
      setActiveTab: (id: string) => void;
      /** Moves the `fromId` tab to the position of `toId`, persisting the new order; active tab unchanged. */
      reorderTabs: (fromId: string, toId: string) => void;
      /** Desktop "Return to Menu": show the menu while KEEPING every open tab and its live instance (spec §4). */
      deactivate: () => void;

      // -- Mobile (single live character instance, spec §7) --
      /** Mobile open: disposes the current live character, loads `character`, adds it to `openTabs` if missing, activates. */
      mobileOpenCharacter: (character: Character, drawerItemId?: string) => void;
      /** Mobile create: disposes the current live character, builds + appends a new one, activates. */
      mobileCreateCharacter: (game: GameSystem) => void;
      /** Mobile "Return to Menu": disposes the live character and shows the menu, keeping `openTabs`. */
      mobileReturnToMenu: () => void;
   };
}

/** Persists the current open tabs + active id to the workspace session. */
function persistWorkspace(): void {
   const { openTabs, activeTabId } = useTabManagerStore.getState();
   writeWorkspace({ openTabs, activeId: activeTabId });
}

/**
 * Points the registry active instance at `id`, appends a character tab for it when not
 * already open, marks it active, and persists the workspace. Keep-alive: this never
 * disposes the previously active instance.
 */
function appendAndActivate(id: string): void {
   setActiveInstance(id);
   useTabManagerStore.setState((state) => ({
      openTabs: state.openTabs.some((tab) => tab.id === id)
         ? state.openTabs
         : [...state.openTabs, { id, type: 'character' }],
      activeTabId: id,
   }));
   persistWorkspace();
}

/**
 * Points the active instance at the menu fallback and nulls `activeTabId`, KEEPING
 * `openTabs` and every live instance. Shared by the desktop `deactivate` action and
 * (after disposing the live character) the mobile return-to-menu.
 */
function deactivateToMenu(): void {
   getMenuFallbackInstance();
   setActiveInstance(SINGLE_ACTIVE_INSTANCE_ID);
   useTabManagerStore.setState({ activeTabId: null });
   persistWorkspace();
}

/**
 * Disposes every live character instance (flush → detach → dispose), leaving only the
 * permanent menu fallback. Enforces the mobile single-live invariant (spec §7) in one
 * place; never touches `openTabs`.
 */
function disposeLiveCharacterInstances(): void {
   for (const id of getCharacterInstanceIds()) {
      detachPersistenceHandle(id);
      disposeInstance(id);
   }
}

export const useTabManagerStore = create<TabManagerState>(() => ({
   openTabs: [],
   activeTabId: null,
   actions: {
      // ==================
      //  Desktop (keep-alive)
      // ==================
      createCharacterTab: (game) => {
         const character = buildNewCharacter(game);
         const instance = getOrCreateInstance(character.id);
         attachPersistenceHandle(character.id, instance);
         // Unguarded load: the handle's subscription autosaves the new character.
         instance.getState().actions.loadCharacter(character);
         appendAndActivate(character.id);
      },
      openCharacterTab: (character, drawerItemId) => {
         // Focus-or-add: an already-open character is focused, never reloaded (which
         // would clobber its unsaved edits and undo stack).
         if (useTabManagerStore.getState().openTabs.some((tab) => tab.id === character.id)) {
            useTabManagerStore.getState().actions.setActiveTab(character.id);
            return;
         }
         const instance = getOrCreateInstance(character.id);
         attachPersistenceHandle(character.id, instance);
         // Unguarded load: drawer/import content becomes an autosaved working record.
         instance.getState().actions.loadCharacter(character, drawerItemId);
         appendAndActivate(character.id);
      },
      closeTab: (id) => {
         const { openTabs, activeTabId } = useTabManagerStore.getState();
         const index = openTabs.findIndex((tab) => tab.id === id);
         if (index === -1) return;

         // Tear down only this tab's instance (flush → detach → dispose).
         detachPersistenceHandle(id);
         disposeInstance(id);

         const remaining = openTabs.filter((tab) => tab.id !== id);

         if (activeTabId !== id) {
            // Closed a background tab: the active one is untouched.
            useTabManagerStore.setState({ openTabs: remaining });
            persistWorkspace();
            return;
         }

         // Closed the active tab: activate the right neighbour, else the left, else the menu.
         const nextTab = openTabs[index + 1] ?? openTabs[index - 1] ?? null;
         if (nextTab) {
            setActiveInstance(nextTab.id);
            useTabManagerStore.setState({ openTabs: remaining, activeTabId: nextTab.id });
         } else {
            getMenuFallbackInstance();
            setActiveInstance(SINGLE_ACTIVE_INSTANCE_ID);
            useTabManagerStore.setState({ openTabs: remaining, activeTabId: null });
         }
         persistWorkspace();
      },
      closeActiveTab: () => {
         const { activeTabId } = useTabManagerStore.getState();
         if (activeTabId !== null) useTabManagerStore.getState().actions.closeTab(activeTabId);
      },
      setActiveTab: (id) => {
         const tab = useTabManagerStore.getState().openTabs.find((openTab) => openTab.id === id);
         if (!tab) return;
         const instance = getOrCreateInstance(id);
         setActiveInstance(id); // keep-alive: previous active instance is left intact
         useTabManagerStore.setState({ activeTabId: id });
         persistWorkspace();
         // Device-flip safety net: if this tab has no live character (e.g. the user
         // resized mobile→desktop without a reload, so mobile only hydrated the active
         // one), hydrate it from storage on demand. A reload otherwise reconciles it.
         if (instance.getState().character === null) {
            void hydrateInstanceFromStorage(id);
         }
      },
      reorderTabs: (fromId, toId) => {
         if (fromId === toId) return;
         const { openTabs } = useTabManagerStore.getState();
         const fromIndex = openTabs.findIndex((tab) => tab.id === fromId);
         const toIndex = openTabs.findIndex((tab) => tab.id === toId);
         if (fromIndex === -1 || toIndex === -1) return;

         const next = [...openTabs];
         const [moved] = next.splice(fromIndex, 1);
         next.splice(toIndex, 0, moved);
         // Order only — `activeTabId` and every instance are untouched.
         useTabManagerStore.setState({ openTabs: next });
         persistWorkspace();
      },
      deactivate: () => {
         // Desktop "Return to Menu": no disposal — tabs and instances stay live.
         deactivateToMenu();
      },

      // ==================
      //  Mobile (single live character instance, spec §7)
      // ==================
      mobileOpenCharacter: (character, drawerItemId) => {
         // Already the live active character → nothing to do.
         if (useTabManagerStore.getState().activeTabId === character.id) return;
         disposeLiveCharacterInstances();
         const instance = getOrCreateInstance(character.id);
         attachPersistenceHandle(character.id, instance);
         instance.getState().actions.loadCharacter(character, drawerItemId);
         appendAndActivate(character.id);
      },
      mobileCreateCharacter: (game) => {
         disposeLiveCharacterInstances();
         const character = buildNewCharacter(game);
         const instance = getOrCreateInstance(character.id);
         attachPersistenceHandle(character.id, instance);
         instance.getState().actions.loadCharacter(character);
         appendAndActivate(character.id);
      },
      mobileReturnToMenu: () => {
         // Dispose the live character (the Phase 3 bug fix: don't surface a hidden
         // neighbour), then show the menu while keeping the shared `openTabs`.
         disposeLiveCharacterInstances();
         deactivateToMenu();
      },
   },
}));

/** Selector hook for the TabManager action bag (a stable reference). */
export const useTabManagerActions = () => useTabManagerStore((state) => state.actions);

/**
 * Creates the instance for stored character `id`, attaches its handle, and hydrates
 * it from IndexedDB under the handle's guard (so the just-restored state is not
 * written straight back). Does NOT touch tab state or the active pointer — the boot
 * loop manages ordering and activation. Returns `false` when no record exists.
 */
async function hydrateInstanceFromStorage(id: string): Promise<boolean> {
   const record = await getCharacter(id);
   if (!record) return false;

   const harmonized = harmonizeData(record.character, 'FULL_CHARACTER_SHEET');
   const instance = getOrCreateInstance(id);
   const handle = attachPersistenceHandle(id, instance);
   handle.hydrate(harmonized, record.drawerItemId ?? undefined);
   return true;
}

/**
 * Resolves the id boot should activate. A `null` stored active is intentional
 * (desktop "Return to Menu" deactivated while keeping tabs, spec §4) and is preserved
 * as `null` (boot to the menu). A non-null-but-stale active (its tab is gone) falls
 * back to the first tab. Returns `null` when there are no tabs.
 */
function resolveIntendedActiveId(workspace: Workspace): string | null {
   if (workspace.activeId === null) return null; // deactivated: stay at the menu
   if (workspace.openTabs.some((tab) => tab.id === workspace.activeId)) return workspace.activeId;
   return workspace.openTabs[0]?.id ?? null; // stale active → first tab
}

/**
 * Desktop boot (tabs spec §3.2 / §4): hydrate the intended-active tab FIRST and lift
 * the loading gate immediately, then hydrate the rest just behind it in order,
 * pruning any whose record is missing. Persists the pruned workspace.
 */
async function bootDesktop(workspace: Workspace): Promise<void> {
   const tabs = workspace.openTabs;
   const intendedActiveId = resolveIntendedActiveId(workspace);

   const survivors: OpenTab[] = [];

   if (intendedActiveId !== null && (await hydrateInstanceFromStorage(intendedActiveId))) {
      survivors.push(tabs.find((tab) => tab.id === intendedActiveId)!);
      setActiveInstance(intendedActiveId);
      useTabManagerStore.setState({ openTabs: [...survivors], activeTabId: intendedActiveId });
   }
   // Active is ready (or there was nothing to restore): paint now; the rest follow.
   finishBootHydration();

   for (const tab of tabs) {
      if (tab.id === intendedActiveId) continue;
      if (await hydrateInstanceFromStorage(tab.id)) survivors.push(tab);
   }
   const ordered = tabs.filter((tab) => survivors.some((survivor) => survivor.id === tab.id));

   let activeId = useTabManagerStore.getState().activeTabId;
   if (activeId === null) {
      if (intendedActiveId !== null && ordered.length > 0) {
         // We intended to restore a character but its record was stale → first survivor.
         activeId = ordered[0].id;
         setActiveInstance(activeId);
      } else {
         // Deactivated (intended the menu), or nothing survived → menu fallback.
         getMenuFallbackInstance();
         setActiveInstance(SINGLE_ACTIVE_INSTANCE_ID);
      }
   }
   useTabManagerStore.setState({ openTabs: ordered, activeTabId: activeId });
   writeWorkspace({ openTabs: ordered, activeId });
}

/**
 * Mobile boot (tabs spec §7): preserve the full `openTabs` list (never prune the
 * shared desktop set) but hydrate ONLY the active tab's instance, leaving the others
 * as ids without live instances. Lands on the menu if the active record is missing.
 */
async function bootMobile(workspace: Workspace): Promise<void> {
   const tabs = workspace.openTabs;
   const intendedActiveId = resolveIntendedActiveId(workspace);

   let activeId: string | null = null;
   if (intendedActiveId !== null && (await hydrateInstanceFromStorage(intendedActiveId))) {
      activeId = intendedActiveId;
      setActiveInstance(activeId);
   } else {
      getMenuFallbackInstance();
      setActiveInstance(SINGLE_ACTIVE_INSTANCE_ID);
   }
   finishBootHydration();

   useTabManagerStore.setState({ openTabs: tabs, activeTabId: activeId });
   writeWorkspace({ openTabs: tabs, activeId });
}

/**
 * Boot step run by `AppStartManager` after the character migration: restore the
 * workspace, platform-aware (desktop hydrates all tabs active-first; mobile hydrates
 * only the active one, spec §4 / §7). The device check is non-hook (boot runs outside
 * React). Always lifts the boot loading gate (the inner boots lift it early; the
 * `finally` is the safety net), so first paint resolves to the active sheet or the
 * menu without a flash.
 */
export async function runCharacterBoot(): Promise<void> {
   try {
      const workspace = readWorkspace();
      if (getEffectiveDeviceType() === 'mobile') {
         await bootMobile(workspace);
      } else {
         await bootDesktop(workspace);
      }
   } finally {
      finishBootHydration();
   }
}
