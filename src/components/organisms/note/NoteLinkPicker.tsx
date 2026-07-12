// -- React Imports --
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { Command } from 'cmdk';
import { Hash, Globe } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getItemTypeIconComponent } from '@/lib/utils/drawer-icons';

// -- Data Imports --
import { queryItems, getItem } from '@/lib/drawer/drawerRepository';
import { folderPathNames, getDrawerFolderTreeVersion, subscribeDrawerFolderTree } from '@/lib/drawer/drawerFolderTree';
import { extractHeadings } from '@/lib/notes/noteOutline';

// -- Portals Imports --
import { buildLinkMarkdown, detectExternalUrl, entityForItemType } from '@/lib/portals/buildLinkToken';

// -- Type Imports --
import type { DrawerItemSummary } from '@/lib/drawer/drawerRepository';
import type { GeneralItemType } from '@/lib/types/drawer';
import type { LinkInsertTarget } from '@/lib/portals/buildLinkToken';
import type { LinkEditSeed } from '@/components/organisms/note/live/linkNode';
import type { NoteEditorHandle } from '@/components/organisms/note/NoteEditor';

/*
 * The unified search-first link picker (toolbar popover / palette entry). ONE cmdk list, no upfront
 * External/Internal choice: a URL-shaped input surfaces an "external" result on top; same-note sections and
 * saved drawer elements (via the content-free `queryItems` index) fill the rest, grouped by kind. Picking a
 * row builds the correct token (the id-kind rule lives in `buildLinkToken`) and inserts `[label](href)` at the
 * caret - the label is the selected text when there was a selection, else the target's own name (overridable).
 *
 * Chrome, not paper: it floats above the sheet on app-theme tokens (`getItemTypeIconComponent` for the row
 * glyphs, `Hash` for a section). SAVED elements only, because that's what `queryItems` returns. An entity/element
 * row shows its containing-folder PATH as a muted breadcrumb (middle-ellipsised when deep) so same-named items
 * are distinguishable; search matches the NAME and the folder path words (client-side, since the list owns its
 * own filtering), so "combat gob" narrows to the Goblin under Combat.
 *
 * With an `editSeed` (the caret bar's Change-target) it REPLACES an existing link instead of inserting at the
 * caret: the splice covers the whole `[label](href)` node range and the label is FIXED to the seed's, so only
 * the target changes.
 */

/** The coarse group a drawer item falls into (order = display order below the same-note sections). */
type PickerCategory = 'notes' | 'boards' | 'characters' | 'cards' | 'trackers' | 'other';
const CATEGORY_ORDER: PickerCategory[] = ['notes', 'boards', 'characters', 'cards', 'trackers', 'other'];

/** Buckets a drawer item type into its picker group. */
function categoryForType(type: GeneralItemType): PickerCategory {
   switch (type) {
      case 'NOTE': return 'notes';
      case 'FULL_BOARD': return 'boards';
      case 'FULL_CHARACTER_SHEET': return 'characters';
      case 'STATUS_TRACKER':
      case 'STORY_TAG_TRACKER':
      case 'STORY_THEME_TRACKER': return 'trackers';
      case 'POST_IT':
      case 'JOURNAL': return 'other';
      default: return 'cards';
   }
}

const ITEM_CLASS =
   'flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-popover-foreground outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground';

interface NoteLinkPickerProps {
   /** Accessor for the live editor handle: the picker snapshots its selection/buffer once, on mount. */
   getEditor: () => NoteEditorHandle | null;
   /** Closes the picker after an insert (or a dismiss). */
   onClose: () => void;
   /** When set, REPLACE this link's target (keep its label) instead of inserting at the caret. */
   editSeed?: LinkEditSeed;
}

export function NoteLinkPicker({ getEditor, onClose, editSeed }: NoteLinkPickerProps) {
   const { t } = useTranslation();
   // Snapshot the editor's selection + buffer ONCE at open (the picker remounts per open, so a lazy initializer
   // captures the live state without a render-time effect). The selection is the label source; the buffer is the
   // same-note section list; the range is the splice target - all frozen so nav inside the popover can't shift them.
   const [snapshot] = useState(() => {
      const editor = getEditor();
      if (!editor) return { from: 0, to: 0, body: '', selectedText: '' };
      const { from, to } = editor.getSelection();
      const body = editor.getValue();
      return { from, to, body, selectedText: body.slice(from, to) };
   });
   const { body: noteBody, selectedText } = snapshot;
   const hasSelection = snapshot.from !== snapshot.to;
   const [search, setSearch] = useState('');
   // Collapsed-caret only: an optional label override; empty falls back to the target's own name at pick time.
   const [labelOverride, setLabelOverride] = useState('');
   const [results, setResults] = useState<DrawerItemSummary[]>([]);

   // Same-note sections, narrowed by the search text (client-side; they're already in hand).
   const sections = useMemo(() => {
      const term = search.trim().toLowerCase();
      const all = extractHeadings(noteBody);
      return term ? all.filter((heading) => heading.text.toLowerCase().includes(term)) : all;
   }, [noteBody, search]);

   // Drawer summaries, fetched ONCE when the picker opens (a link pick can't mutate the drawer mid-open, so
   // there's nothing to re-fetch). Filtering is client-side below so it can span the NAME and the folder PATH -
   // the server query only sorts by recency, so an empty search still shows the most-recent items first.
   useEffect(() => {
      let alive = true;
      void queryItems({ sort: { by: 'updatedAt', direction: 'desc' } }).then((list) => {
         if (alive) setResults(list);
      });
      return () => { alive = false; };
   }, []);

   const externalUrl = useMemo(() => detectExternalUrl(search), [search]);

   // The folder-tree cache version: recompute the path-aware search/display whenever it warms or changes.
   const folderTreeVersion = useSyncExternalStore(subscribeDrawerFolderTree, getDrawerFolderTreeVersion);

   // Client-side cross-field search: each whitespace token must appear in the item's NAME or its folder PATH,
   // so "combat gob" narrows to the Goblin under Combat. Before the tree warms (version 0) the path is empty,
   // so it degrades to a name-only match - never a wrong drop. Capped so a deep drawer stays a compact list.
   const filteredResults = useMemo(() => {
      void folderTreeVersion;
      const warm = folderTreeVersion > 0;
      const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const matches = tokens.length === 0 ? results : results.filter((item) => {
         const path = warm ? folderPathNames(item.parentFolderId).join(' ') : '';
         const haystack = `${item.name} ${path}`.toLowerCase();
         return tokens.every((token) => haystack.includes(token));
      });
      return matches.slice(0, 40);
   }, [results, search, folderTreeVersion]);

   // Group the filtered results by category, preserving `queryItems`' recency order within each.
   const grouped = useMemo(() => {
      const buckets = new Map<PickerCategory, DrawerItemSummary[]>();
      for (const item of filteredResults) {
         const category = categoryForType(item.type);
         (buckets.get(category) ?? buckets.set(category, []).get(category)!).push(item);
      }
      return CATEGORY_ORDER.map((category) => ({ category, items: buckets.get(category) ?? [] })).filter((group) => group.items.length > 0);
   }, [filteredResults]);

   /**
    * Resolves the label for a pick. In EDIT mode the seed's label is kept (only the target changes); otherwise
    * the selection when present, else the override, else the target's own name.
    */
   const labelFor = (defaultName: string): string => {
      if (editSeed) return editSeed.label.trim() || defaultName;
      return (hasSelection ? selectedText : labelOverride.trim() || defaultName).trim() || defaultName;
   };

   const insert = (target: LinkInsertTarget, defaultName: string): void => {
      const markdown = buildLinkMarkdown(labelFor(defaultName), target);
      const editor = getEditor();
      // EDIT mode splices over the whole link node range; INSERT mode over the snapshot selection (caret).
      const [from, to] = editSeed ? [editSeed.from, editSeed.to] : [snapshot.from, snapshot.to];
      editor?.splice(from, to, markdown, from + markdown.length);
      onClose();
   };

   const pickExternal = (url: string): void => insert({ kind: 'external', url }, url);
   const pickSection = (slug: string, text: string): void => insert({ kind: 'section', slug }, text);
   const pickDrawerItem = (item: DrawerItemSummary): void => {
      const entity = entityForItemType(item.type);
      const defaultName = item.name.trim() || t('Tabs.untitled');
      if (!entity) {
         insert({ kind: 'element', drawerItemId: item.id }, defaultName);
         return;
      }
      // Entity link needs the ENTITY id (note/board/character id), which lives in the item's content.
      void getItem(item.id).then((record) => {
         const entityId = record ? (record.content as { id?: string }).id : undefined;
         if (entityId) insert({ kind: 'entity', entity, id: entityId }, defaultName);
      });
   };

   const showEmpty = !externalUrl && sections.length === 0 && grouped.length === 0;

   return (
      <div className="w-[28rem] max-w-[calc(100vw-2rem)]">
         {/* Label control: an edit keeps the existing label (fixed); a live selection IS the label (fixed); a
             collapsed caret gets an optional override. */}
         {editSeed ? (
            <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
               {t('NoteView.linkPicker.keepingLabel', { text: editSeed.label })}
            </div>
         ) : hasSelection ? (
            <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
               {t('NoteView.linkPicker.usingSelection', { text: selectedText })}
            </div>
         ) : (
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
               <span className="shrink-0 text-xs font-medium text-muted-foreground">{t('NoteView.linkPicker.label')}</span>
               <input
                  type="text"
                  value={labelOverride}
                  onChange={(event) => setLabelOverride(event.target.value)}
                  placeholder={t('NoteView.linkPicker.labelPlaceholder')}
                  className="min-w-0 flex-1 bg-transparent text-sm text-popover-foreground placeholder:text-muted-foreground focus:outline-none"
               />
            </div>
         )}

         <Command
            shouldFilter={false}
            className={cn(
               '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
               '[&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4 [&_[cmdk-item]_svg]:shrink-0',
            )}
         >
            <Command.Input
               autoFocus
               value={search}
               onValueChange={setSearch}
               placeholder={t('NoteView.linkPicker.placeholder')}
               className="h-10 w-full border-b border-border bg-transparent px-3 text-sm text-popover-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <Command.List className="max-h-72 overflow-y-auto overflow-x-hidden p-1">
               {showEmpty && <div className="px-2 py-6 text-center text-sm text-muted-foreground">{t('NoteView.linkPicker.empty')}</div>}

               {externalUrl && (
                  <Command.Group heading={t('NoteView.linkPicker.groups.external')}>
                     <Command.Item value={`ext:${externalUrl}`} onSelect={() => pickExternal(externalUrl)} className={ITEM_CLASS}>
                        <Globe />
                        <span className="truncate">{t('NoteView.linkPicker.linkToUrl', { url: externalUrl })}</span>
                     </Command.Item>
                  </Command.Group>
               )}

               {sections.length > 0 && (
                  <Command.Group heading={t('NoteView.linkPicker.groups.thisNote')}>
                     {sections.map((heading, index) => (
                        <Command.Item
                           key={`${heading.slug}-${index}`}
                           value={`sec:${heading.slug}-${index}`}
                           onSelect={() => pickSection(heading.slug, heading.text)}
                           className={ITEM_CLASS}
                        >
                           <Hash />
                           <span style={{ paddingLeft: `${(heading.level - 1) * 0.75}rem` }} className="truncate">{heading.text}</span>
                        </Command.Item>
                     ))}
                  </Command.Group>
               )}

               {grouped.map(({ category, items }) => (
                  <Command.Group key={category} heading={t(`NoteView.linkPicker.groups.${category}`)}>
                     {items.map((item) => (
                        <DrawerRow
                           key={item.id}
                           item={item}
                           pathNames={folderTreeVersion > 0 ? folderPathNames(item.parentFolderId) : []}
                           onSelect={() => pickDrawerItem(item)}
                        />
                     ))}
                  </Command.Group>
               ))}
            </Command.List>
         </Command>
      </div>
   );
}

/**
 * Compact one-line breadcrumb for a folder path: `''` at root, the leaf alone for one level, `Root / Leaf`
 * for two, `Root / … / Leaf` once deeper - so even a long path never blows out the row.
 */
function formatFolderPath(names: string[]): string {
   if (names.length === 0) return '';
   if (names.length === 1) return names[0];
   if (names.length === 2) return `${names[0]} / ${names[1]}`;
   return `${names[0]} / … / ${names[names.length - 1]}`;
}

/** One drawer result row: the type glyph, the item name (untitled falls back to a label), + its folder path. */
function DrawerRow({ item, pathNames, onSelect }: { item: DrawerItemSummary; pathNames: string[]; onSelect: () => void }) {
   const { t } = useTranslation();
   // `getItemTypeIconComponent` returns a stable module-level lucide component; static-components is a false
   // positive here (same as `CardRenderer`/`InternalLinkChip`).
   const Icon = getItemTypeIconComponent(item.type);
   const name = item.name.trim() || t('Tabs.untitled');
   // The muted path breadcrumb sits on its OWN line UNDER the name, so name and path each get the row's full
   // width (no side-by-side split). Empty (a root item, or the tree not yet warm) renders name-only, no line.
   const pathLabel = formatFolderPath(pathNames);
   return (
      <Command.Item value={`item:${item.id}`} onSelect={onSelect} className={ITEM_CLASS}>
         {/* eslint-disable-next-line react-hooks/static-components */}
         <Icon />
         <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{name}</span>
            {pathLabel && <span className="truncate text-xs text-muted-foreground">{pathLabel}</span>}
         </span>
      </Command.Item>
   );
}
