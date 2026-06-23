// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { createCompoundCommand } from './boardCommands';

// -- Type Imports --
import type { BoardCommand } from './boardCommands';

/*
 * The compound command is the spine of every group operation: it must run its parts in
 * order on do() and unwind them in REVERSE on undo(), so a group move/delete/duplicate is
 * one symmetric undo step. (The per-item commands are covered through the store + repo.)
 */

/** A stub command that appends `do:<id>` / `undo:<id>` to a shared log, to assert ordering. */
function trace(id: string, log: string[]): BoardCommand {
   return {
      label: `trace-${id}`,
      async do() {
         log.push(`do:${id}`);
      },
      async undo() {
         log.push(`undo:${id}`);
      },
   };
}

describe('createCompoundCommand', () => {
   it('runs parts in order on do() and reverses them on undo()', async () => {
      const log: string[] = [];
      const compound = createCompoundCommand([trace('a', log), trace('b', log), trace('c', log)]);

      await compound.do();
      expect(log).toEqual(['do:a', 'do:b', 'do:c']);

      await compound.undo();
      expect(log).toEqual(['do:a', 'do:b', 'do:c', 'undo:c', 'undo:b', 'undo:a']);
   });

   it('is a no-op for an empty command list', async () => {
      const compound = createCompoundCommand([]);
      await expect(compound.do()).resolves.toBeUndefined();
      await expect(compound.undo()).resolves.toBeUndefined();
   });
});
