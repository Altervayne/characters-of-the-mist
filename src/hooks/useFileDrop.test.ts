// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { filterAcceptedFiles, parseAcceptExtensions, reduceDragDepth } from './useFileDrop';

/*
 * The pure pieces of the native file-drop hook: the `accept` extension gate, the extension parser, and the
 * drag-depth counter that suppresses nested-child flicker. The DOM wiring (dragover preventDefault, the hidden
 * input, real drag+drop) is browser-only and is the owner's cursor to confirm.
 */

// Only `.name` is read by the gate, so a bare shape stands in for a File (mirrors the useInView test pattern).
const file = (name: string) => ({ name }) as File;

describe('parseAcceptExtensions', () => {
   it('keeps leading-dot extensions, lowercased, and drops MIME tokens', () => {
      expect(parseAcceptExtensions('.cotm,.JSON, .md')).toEqual(['.cotm', '.json', '.md']);
      expect(parseAcceptExtensions('application/json,.json')).toEqual(['.json']);
   });

   it('returns an empty list for undefined or MIME-only accept', () => {
      expect(parseAcceptExtensions(undefined)).toEqual([]);
      expect(parseAcceptExtensions('application/json')).toEqual([]);
   });
});

describe('filterAcceptedFiles', () => {
   it('keeps only files whose name ends in an allowed extension (case-insensitive)', () => {
      const files = [file('hero.cotm'), file('sheet.JSON'), file('notes.md'), file('image.png')];
      expect(filterAcceptedFiles(files, ['.cotm', '.json']).map((f) => f.name)).toEqual(['hero.cotm', 'sheet.JSON']);
   });

   it('rejects a dropped folder (no matching extension), matching react-dropzone', () => {
      expect(filterAcceptedFiles([file('MyFolder')], ['.json'])).toEqual([]);
   });

   it('is a pass-through when no extension gate is configured', () => {
      const files = [file('anything'), file('image.png')];
      expect(filterAcceptedFiles(files, [])).toBe(files);
   });
});

describe('reduceDragDepth', () => {
   it('balances nested enter/leave without dropping below zero', () => {
      let depth = 0;
      depth = reduceDragDepth(depth, 'enter'); // over the root
      expect(depth).toBe(1);
      depth = reduceDragDepth(depth, 'enter'); // onto a child
      expect(depth).toBe(2);
      depth = reduceDragDepth(depth, 'leave'); // off the child, still over the root -> stays active
      expect(depth).toBe(1);
      depth = reduceDragDepth(depth, 'leave'); // off the root -> inactive
      expect(depth).toBe(0);
   });

   it('never goes negative on an unbalanced leave', () => {
      expect(reduceDragDepth(0, 'leave')).toBe(0);
   });

   it('resets to zero on drop regardless of prior depth', () => {
      expect(reduceDragDepth(3, 'drop')).toBe(0);
   });
});
