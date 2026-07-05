import type { Card, Tracker, Character, LegendsThemeDetails, LegendsHeroDetails } from '@/lib/types/character';
import type { Drawer, DrawerItem, Folder, GameSystem, GeneralItemType } from '../types/drawer';
import type { Board, BoardItemContent } from '@/lib/types/board';
import type { CustomTheme } from '@/lib/theme/themeTokens';
import { APP_VERSION } from '../config';
import { getAsset, storeAsset } from '@/lib/assets/assetRepository';
import { hashBytes } from '@/lib/assets/processImage';
import type { ProcessedImage } from '@/lib/assets/processImage';

// `CUSTOM_THEME` is a 2.0-native type (themes live in app settings, not the drawer); it rides the same
// envelope as everything else. A board (`FULL_BOARD`) rides it too.
export type ExportableItemType = GeneralItemType | 'CUSTOM_THEME';
export type ExportableContent = Card | Tracker | Character | Folder | Drawer | Board | CustomTheme;

/** One asset's bytes carried inside an exported file so the file is self-contained. */
export interface EmbeddedAsset {
   mimeType: string;
   width: number;
   height: number;
   /** The processed webp bytes, base64-encoded. */
   base64: string;
}

/**
 * The full data of every entity the exported content only REFERENCES (not copies), so a reference
 * survives on another machine: the importer recreates the entity locally and rewires the references to
 * it. Typed by entity kind, each map keyed by the source id the references use. Optional and additive -
 * absent when nothing is referenced. 2.0 embeds `characters` (a board's character elements); Portals
 * extend it with boards/notes without reshaping the envelope.
 */
export interface EmbeddedEntities {
   characters?: Record<string, Character>;
}

export interface ExportFile {
   fileType: ExportableItemType;
   game: GameSystem;
   version?: string;
   content: ExportableContent;
   /**
    * The bytes of every asset the `content` references, keyed by hash. Optional and
    * additive: files written before this (and any asset-free export) omit it and
    * import exactly as before.
    */
   assets?: Record<string, EmbeddedAsset>;
   /**
    * The full data of every entity the `content` only references (2.0: a board's character elements),
    * so the reference survives the trip. Optional and additive - only a `FULL_BOARD` with character
    * elements carries it; every other export omits it.
    */
   embedded?: EmbeddedEntities;
};

/**
 * Generates a nicely formatted filename for exported items.
 * Format: [Name]_[GameAbbrev]_[Type]_[Date].cotm
 * Example: "MyHero_LitM_Character_2025-01-15.cotm"
 */
export function generateExportFilename(game: GameSystem, type: ExportableItemType, customHandle?: string): string {
   const date = new Date().toISOString().slice(0, 10);
   let textType: string | undefined = undefined
   let textGame: string | undefined = undefined

   switch(game) {
      case "LEGENDS":
         textGame = "LitM"
         break;

      case "CITY_OF_MIST":
         textGame = "CoM"
         break;

      case "OTHERSCAPE":
         textGame = "OS"
         break;
   }

   switch(type) {
      case "FULL_CHARACTER_SHEET":
         textType = "Character"
         break;

      case "CHARACTER_CARD":
         textType = "Character-Card"
         break;

      case "CHARACTER_THEME":
         textType = "Theme-Card"
         break;

      case "GROUP_THEME":
         textType = "Group-Theme-Card"
         break;

      case "FOLDER":
         textType = "Drawer-Folder"
         break;
      
      case "FULL_DRAWER":
         textType = "Drawer"
         break;

      case "FULL_BOARD":
         textType = "Board"
         break;

      case "STATUS_TRACKER":
         textType = "Status-Tracker"
         break;

      case "STORY_TAG_TRACKER":
         textType = "Story-Tag-Tracker"
         break;

      case "STORY_THEME_TRACKER":
         textType = "Story-Theme-Tracker"
         break;

      case "IMAGE_CARD":
         textType = "Portrait"
         break;

      case "CHALLENGE_CARD":
         textType = "Challenge-Card"
         break;

      case "CUSTOM_THEME":
         textType = "Theme"
         break;
   }

   const baseName = textGame ? `${textGame}_${textType}` : textType;
   const prefix = customHandle ? `${customHandle}_${baseName}` : baseName;

   return `${prefix}_${date}`;
};

/**
 * Derives the human-readable handle (filename prefix) for an exported item.
 *
 * Theme/fellowship cards use their main tag's name; character cards use the
 * character's name. Everything else (loadout cards, trackers, folders, drawers)
 * uses the supplied fallback - typically the item's display name or title.
 */
export function deriveExportHandle(content: ExportableContent, fallback?: string): string | undefined {
   if ('cardType' in content) {
      const card = content as Card;
      if (card.cardType === 'CHARACTER_THEME' || card.cardType === 'GROUP_THEME') {
         return (card.details as LegendsThemeDetails).mainTag.name;
      }
      if (card.cardType === 'CHARACTER_CARD') {
         return (card.details as LegendsHeroDetails).characterName;
      }
   }
   return fallback;
}

/**
 * Derives the folder name for a full-drawer import from the picked file's name.
 *
 * Reduces the name to a basename (guarding against any path prefix) and strips a
 * trailing extension (`.cotm`/`.json`, or defensively any `.ext`), then trims.
 * When the cleaned result is empty/unusable, returns `${fallbackName} - ${date}`
 * using the project's `YYYY-MM-DD` date convention (matching
 * `generateExportFilename`). The `fallbackName` is passed in already-localized by
 * the caller, so this helper never calls `t()` - the same pattern as
 * `generateExportFilename` taking a pre-derived handle.
 *
 * @param fileName - The imported file's name (e.g. "MyDrawer.cotm").
 * @param fallbackName - Localized default base name, used when the filename is unusable.
 * @returns The cleaned folder name, or the dated fallback.
 */
export function deriveDrawerFolderName(fileName: string, fallbackName: string): string {
   const baseName = fileName.split(/[/\\]/).pop() ?? '';
   const withoutExtension = baseName.replace(/\.[^.]+$/, '');
   const cleaned = withoutExtension.trim();

   if (cleaned) {
      return cleaned;
   }

   const date = new Date().toISOString().slice(0, 10);
   return `${fallbackName} - ${date}`;
}

// ==================
//  Asset embedding (inline-embed export / import)
// ==================

/*
 * The in-hand-content analogue of `collectReferencedAssetHashes` (which reads the DB):
 * it walks whatever is being exported and returns the asset hashes it references. The
 * per-card/per-character walk mirrors that collector so the two stay consistent.
 */

/** Adds a card's `details.assetId` to `into` when present (a pure presence check, no `cardType` gate). */
function collectFromCard(card: Card, into: Set<string>): void {
   const assetId = (card.details as { assetId?: unknown }).assetId;
   if (typeof assetId === 'string' && assetId.length > 0) into.add(assetId);
}

/** Walks every card on a character. */
function collectFromCharacter(character: Character, into: Set<string>): void {
   for (const card of character.cards) collectFromCard(card, into);
}

/** A drawer item's content is a character (has `cards`), a card (has `details`), or a tracker (neither). */
function collectFromItem(item: DrawerItem, into: Set<string>): void {
   const content = item.content;
   if (Array.isArray((content as Character).cards)) {
      collectFromCharacter(content as Character, into);
   } else if ('details' in content) {
      collectFromCard(content as Card, into);
   }
}

/** Recurses a folder's items and sub-folders. */
function collectFromFolder(folder: Folder, into: Set<string>): void {
   for (const item of folder.items) collectFromItem(item, into);
   for (const sub of folder.folders) collectFromFolder(sub, into);
}

/** Walks a board aggregate's items: a native image's `assetId` and any embedded card COPY's art. */
function collectFromBoard(board: Board, into: Set<string>): void {
   for (const item of board.items) {
      const content: BoardItemContent = item.content;
      if (content.kind === 'image') {
         if (content.assetId) into.add(content.assetId);
      } else if (content.kind === 'card' && content.mode === 'copy' && content.data && typeof content.data === 'object' && 'details' in content.data) {
         collectFromCard(content.data as Card, into);
      }
   }
}

/**
 * Collects every asset hash referenced by `content`, whatever it is: a character, a
 * single card, or a folder/drawer of them. Trackers reference nothing.
 *
 * @param content - The item being exported.
 * @returns The set of referenced asset hashes.
 */
export function collectAssetIdsFromContent(content: ExportableContent): Set<string> {
   const ids = new Set<string>();
   // A custom theme is just token sets - no asset references; bail before the item walks.
   if ('light' in content && 'dark' in content && 'radius' in content) return ids;
   if ('rootItems' in content) {
      // Drawer: root items + every folder subtree.
      for (const item of content.rootItems) collectFromItem(item, ids);
      for (const folder of content.folders) collectFromFolder(folder, ids);
   } else if ('viewport' in content) {
      collectFromBoard(content as Board, ids); // Board (checked before Folder: both have `items`)
   } else if ('items' in content) {
      collectFromFolder(content, ids); // Folder
   } else if (Array.isArray((content as Character).cards)) {
      collectFromCharacter(content as Character, ids);
   } else if ('details' in content) {
      collectFromCard(content as Card, ids);
   }
   // Trackers hold no asset references.
   return ids;
}

/** Base64-encodes a blob's bytes, chunking the binary string so large images never blow the call stack. */
export async function blobToBase64(blob: Blob): Promise<string> {
   const bytes = new Uint8Array(await blob.arrayBuffer());
   let binary = '';
   const CHUNK = 0x8000;
   for (let offset = 0; offset < bytes.length; offset += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
   }
   return btoa(binary);
}

/** Decodes a base64 string to its raw bytes (ArrayBuffer-backed, so it feeds Blob/hashBytes directly). */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
   const binary = atob(base64);
   const bytes = new Uint8Array(binary.length);
   for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
   return bytes;
}

/**
 * Builds the `assets` map for an export by reading each referenced asset's bytes and
 * base64-encoding them. Takes the already-collected id set (the caller can union in
 * ids from embedded entities). A referenced asset that is missing from the store (e.g.
 * a dangling reference) is skipped, not fatal. Returns `undefined` when nothing embeds.
 */
async function buildEmbeddedAssets(ids: Set<string>): Promise<Record<string, EmbeddedAsset> | undefined> {
   if (ids.size === 0) return undefined;

   const assets: Record<string, EmbeddedAsset> = {};
   for (const id of ids) {
      const record = await getAsset(id);
      if (!record) {
         console.warn(`Export: referenced asset ${id} is missing from the store; skipping embed.`);
         continue;
      }
      assets[id] = {
         mimeType: record.mimeType,
         width: record.width,
         height: record.height,
         base64: await blobToBase64(record.blob),
      };
   }
   return Object.keys(assets).length > 0 ? assets : undefined;
}

/**
 * Re-stores every embedded asset so the imported content's references resolve on this
 * machine. Dedup-aware: assets already present collapse (no duplicate rows). The
 * embedded hash is trusted as the key (the content references it); the bytes are
 * re-hashed only to warn on a mismatch. A single bad asset is logged and skipped so
 * it never blocks the rest of the import. Exported so the rehydration can be tested
 * without a DOM `FileReader` (the full `importFromFile` path is browser-verified).
 */
export async function rehydrateEmbeddedAssets(assets: Record<string, EmbeddedAsset>): Promise<void> {
   for (const [hash, embedded] of Object.entries(assets)) {
      try {
         const bytes = base64ToBytes(embedded.base64);
         const blob = new Blob([bytes], { type: embedded.mimeType });
         const actual = await hashBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
         if (actual !== hash) {
            console.warn(`Import: embedded asset hash mismatch (key ${hash}, bytes ${actual}); storing under the referenced key.`);
         }
         const processed: ProcessedImage = {
            hash,
            blob,
            mimeType: embedded.mimeType,
            width: embedded.width,
            height: embedded.height,
            byteSize: blob.size,
         };
         await storeAsset(processed);
      } catch (error) {
         console.error(`Import: failed to rehydrate embedded asset ${hash}:`, error);
      }
   }
}

/**
 * Exports an item to a .cotm file and triggers the browser download. Wraps the
 * content in an ExportFile with metadata + version, and embeds the bytes of every
 * asset it references so the file is self-contained across devices. Async because
 * reading the referenced asset blobs is async.
 *
 * `embedded` carries the full data of entities the content only references (a board's
 * character elements); the caller resolves them (kept out of here so this stays
 * generic). Their own assets are unioned into the `assets` build so portraits ride along.
 */
export async function exportToFile(item: ExportableContent, type: ExportableItemType, game: GameSystem, fileName: string, embedded?: EmbeddedEntities) {
   const exportData: ExportFile = {
      fileType: type,
      game: game,
      version: APP_VERSION,
      content: item,
   };
   if (embedded) exportData.embedded = embedded;

   const ids = collectAssetIdsFromContent(item);
   // Fold in the embedded characters' own assets (portraits) so they ride the same `assets` map.
   if (embedded?.characters) {
      for (const character of Object.values(embedded.characters)) collectFromCharacter(character, ids);
   }
   const assets = await buildEmbeddedAssets(ids);
   if (assets) exportData.assets = assets;

   const jsonString = JSON.stringify(exportData, null, 2);
   const blob = new Blob([jsonString], { type: 'application/json' });
   const url = URL.createObjectURL(blob);

   const a = document.createElement('a');
   a.href = url;
   a.download = `${fileName}.cotm`;
   document.body.appendChild(a);
   a.click();

   document.body.removeChild(a);
   URL.revokeObjectURL(url);
};

/**
 * Quick helper to export a full character sheet.
 * Generates the filename automatically from the character's name and game.
 */
export async function exportCharacterSheet(character: Character) {
   const fileName = generateExportFilename(character.game, 'FULL_CHARACTER_SHEET', character.name);
   await exportToFile(character, 'FULL_CHARACTER_SHEET', character.game, fileName);
};

/**
 * Exports the entire drawer - all your characters, folders, and components in one file.
 * Perfect for backups or transferring your whole collection to another device.
 */
export async function exportDrawer(drawer: Drawer) {
   const drawerFileName = generateExportFilename('NEUTRAL', 'FULL_DRAWER', 'Full Drawer');
   await exportToFile(drawer, 'FULL_DRAWER', 'NEUTRAL', drawerFileName);
};

/**
 * Quick helper to export a single custom theme. Themes are game-agnostic (NEUTRAL) and asset-free, so the
 * file is just the envelope around the theme (its light/dark token sets, radius, and any seedMode/seeds).
 */
export async function exportCustomTheme(theme: CustomTheme) {
   const fileName = generateExportFilename('NEUTRAL', 'CUSTOM_THEME', theme.name);
   await exportToFile(theme, 'CUSTOM_THEME', 'NEUTRAL', fileName);
};

/**
 * Whether a parsed file is a custom-theme export carrying the token sets a theme needs - so a
 * character/board/malformed `.cotm` is rejected before it's added as a theme. (Themes are 2.0-native,
 * so there's no harmonize step; the importer just re-IDs the validated content.)
 */
export function isExportedCustomTheme(file: ExportFile): boolean {
   const content = file.content as Partial<CustomTheme>;
   return file.fileType === 'CUSTOM_THEME'
      && !!content.light && !!content.dark && typeof content.radius === 'string'
      && !!content.paper && typeof content.paper === 'object';
}

/**
 * Imports a .cotm file and parses it into an ExportFile structure.
 * Returns a promise that resolves with the parsed data, or rejects if the file is invalid.
 * Validates the file format to make sure it's actually a CotM export.
 *
 * Side effect: any embedded `assets` are re-stored (dedup-aware) BEFORE the promise
 * resolves, so every import path resolves its asset references locally. An asset-free
 * (or pre-embedding) file skips this and behaves exactly as before.
 */
export function importFromFile(file: File): Promise<ExportFile> {
   return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
         try {
            const result = event.target?.result;
            if (typeof result !== 'string') {
               throw new Error('File could not be read as text.');
            }

            const parsedData = JSON.parse(result);

            if (!parsedData.fileType || !parsedData.content) {
               throw new Error('Invalid file format: Missing required properties.');
            }

            const file = parsedData as ExportFile;
            if (file.assets) await rehydrateEmbeddedAssets(file.assets);

            resolve(file);
         } catch (error) {
            reject(error);
         }
      };

      reader.onerror = (error) => {
         reject(error);
      };

      reader.readAsText(file);
   });
};