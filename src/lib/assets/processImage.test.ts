// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { hashBytes } from './processImage';

/*
 * Only `hashBytes` is unit-tested here. `processImage`'s decode/scale/encode path
 * relies on `createImageBitmap` and a canvas, which the test runner does not
 * provide; that path is verified in-browser once the image-card consumer lands.
 * `hashBytes` is the dedup key and is pure (`crypto.subtle` only), so it is checked
 * against known SHA-256 vectors here.
 */

/** Encodes an ASCII string to an ArrayBuffer for hashing. */
function bufferOf(text: string): ArrayBuffer {
   const bytes = new TextEncoder().encode(text);
   return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('hashBytes', () => {
   it('hashes an empty buffer to the known SHA-256 vector', async () => {
      const digest = await hashBytes(new ArrayBuffer(0));
      expect(digest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
   });

   it('hashes "abc" to the known SHA-256 vector', async () => {
      const digest = await hashBytes(bufferOf('abc'));
      expect(digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
   });

   it('is deterministic and returns a 64-char lowercase hex string', async () => {
      const a = await hashBytes(bufferOf('characters of the mist'));
      const b = await hashBytes(bufferOf('characters of the mist'));
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
   });
});
