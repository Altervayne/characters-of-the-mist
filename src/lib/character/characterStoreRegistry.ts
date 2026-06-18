// -- Store Imports --
import { createCharacterStore } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { CharacterStore } from '@/lib/stores/characterStore';

/*
 * Module-level registry of character store instances (tabs spec §1.2), keyed by
 * character id. Each entry is a fully isolated `createCharacterStore()` with its
 * own state and its own zundo undo stack, so N tabs give N independent undo stacks
 * with no shared mutable state.
 *
 * Non-React callers (persistence, the undo-router keydown handler) reach the active
 * instance through `getActiveCharacterStore()`; React callers resolve it through
 * `ActiveCharacterStoreContext`. This is NOT a React module — it holds no JSX and
 * no hooks, only the instance map and the active-id pointer.
 *
 * Phase 1 keeps exactly one instance, created lazily and kept active for the app's
 * lifetime under {@link SINGLE_ACTIVE_INSTANCE_ID} — it replaces the old module
 * singleton's role. Per-character keying and multiple live instances arrive in
 * Phase 2 with the TabManager.
 */

/**
 * The fixed key under which Phase 1 stores its single instance. The running app's
 * one character can change (null → A → null → B) within this same instance, exactly
 * as the old singleton behaved; Phase 2 replaces this with real per-character keys.
 */
export const SINGLE_ACTIVE_INSTANCE_ID = '__single-active__';

/** characterId → store instance. Distinct instances are fully isolated (spec §2.1). */
const registry = new Map<string, CharacterStore>();

/** The id of the instance `getActiveCharacterStore()` resolves to, or `null` when none is active. */
let activeInstanceId: string | null = null;

/**
 * Returns the instance for `id`, creating and registering it on first request.
 * Idempotent: the same id always yields the same instance (so a StrictMode double
 * invocation cannot create two stores for one character).
 *
 * @param id - The character id (or the Phase 1 sentinel) keying the instance.
 * @returns The existing or freshly created store instance.
 */
export function getOrCreateInstance(id: string): CharacterStore {
   const existing = registry.get(id);
   if (existing) return existing;

   const instance = createCharacterStore();
   registry.set(id, instance);
   return instance;
}

/**
 * The currently active store instance, or `null` when none is active. The accessor
 * for non-React callers; it never creates an instance, so callers must tolerate
 * `null` (in Phase 1 the single instance is ensured at startup, so it is non-null
 * in normal flow).
 */
export function getActiveCharacterStore(): CharacterStore | null {
   if (activeInstanceId === null) return null;
   return registry.get(activeInstanceId) ?? null;
}

/**
 * Points the active accessor and context at the instance for `id`. The instance
 * must already exist (via {@link getOrCreateInstance}); pointing at an unknown id
 * makes {@link getActiveCharacterStore} return `null`.
 *
 * @param id - The id to activate.
 */
export function setActiveInstance(id: string): void {
   activeInstanceId = id;
}

/**
 * Drops the instance for `id` from the registry, clearing the active pointer if it
 * referenced that id. Idempotent. (Phase 2 will also flush and detach the
 * instance's persistence handle before disposing; in Phase 1 nothing is disposed in
 * normal flow — this exists for the registry's forward-looking API and tests.)
 *
 * @param id - The id to dispose.
 */
export function disposeInstance(id: string): void {
   registry.delete(id);
   if (activeInstanceId === id) {
      activeInstanceId = null;
   }
}

/**
 * Ensures the Phase 1 single instance exists and is active, returning it. Idempotent
 * — safe to call from every provider render and from boot — because it resolves the
 * same {@link SINGLE_ACTIVE_INSTANCE_ID} entry every time. This is the one seam that
 * replaces `export const useCharacterStore = createCharacterStore()`.
 *
 * @returns The single active store instance.
 */
export function ensureSingleActiveInstance(): CharacterStore {
   const instance = getOrCreateInstance(SINGLE_ACTIVE_INSTANCE_ID);
   setActiveInstance(SINGLE_ACTIVE_INSTANCE_ID);
   return instance;
}
