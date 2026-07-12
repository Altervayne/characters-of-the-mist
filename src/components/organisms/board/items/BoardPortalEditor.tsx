// -- React Imports --
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Icon Imports --
import { Image as ImageIcon, Loader2, Replace, Upload } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { resolvePortalIcon, portalDestinationIcon, smartPortalIconName, PORTAL_ICON_NAMES } from '@/lib/board/portalIcons';

// -- Pipeline / Asset Store --
import { processImage } from '@/lib/assets/processImage';
import { storeAsset } from '@/lib/assets/assetRepository';

// -- Store and Hook Imports --
import { useCommitOnUnmount } from '@/hooks/useCommitOnUnmount';

// -- Component Imports --
import { PortalCard } from './BoardPortalItem';

// -- Type Imports --
import type { PortalBoardContent, PortalStyle } from '@/lib/types/board';

/*
 * The portal restyle editor: the body of the movable editor window. It drives ONE selected portal's style -
 * change its target (reopens the shared picker), switch between the four styles, pick a curated icon or upload
 * an image, and edit the label - with a live preview of the result. Every edit is one undoable command via
 * `onCommitStyle`, which reads the item LIVE and patches only its style (so a deferred label flush can't
 * clobber a target/visual change, and vice versa). App-theme chrome; the preview alone shows the real style.
 *
 * The four styles fold onto `PortalStyle` = (visual kind) × (label present): text-only = no visual; icon+text
 * = icon + label; icon-only = icon + empty label; image+text = image + label. So icon-only and icon+text share
 * a visual and differ only by the label - selecting icon-only blanks the label (a remembered copy restores it
 * on the way back), and the label input hides for it.
 */

type PortalStyleKind = 'text' | 'icon-text' | 'icon-only' | 'image';

/** Classifies a stored style into its editor kind (icon+text vs icon-only splits on the label). */
function styleKind(style: PortalStyle): PortalStyleKind {
   if (style.visual?.kind === 'image') return 'image';
   if (style.visual?.kind === 'icon') return style.label ? 'icon-text' : 'icon-only';
   return 'text';
}

const KIND_ORDER: { kind: PortalStyleKind; labelKey: string }[] = [
   { kind: 'text', labelKey: 'BoardView.portalStyleTextOnly' },
   { kind: 'icon-text', labelKey: 'BoardView.portalStyleIconText' },
   { kind: 'icon-only', labelKey: 'BoardView.portalStyleIconOnly' },
   { kind: 'image', labelKey: 'BoardView.portalStyleImage' },
];

interface BoardPortalEditorProps {
   /** The portal's live content (re-rendered by the board store on every commit). */
   content: PortalBoardContent;
   /** Commits a style edit as one undoable command, read live-then-patched by the caller. */
   onCommitStyle: (updater: (style: PortalStyle) => PortalStyle) => void;
   /** Reopens the shared target picker in retarget mode (keeps the current style). */
   onChangeTarget: () => void;
}

export function BoardPortalEditor({ content, onCommitStyle, onChangeTarget }: BoardPortalEditorProps) {
   const { t } = useTranslation();
   const { style, target } = content;
   const kind = styleKind(style);

   // The last chosen icon + asset + non-empty label, so switching styles never loses a prior choice: toggling
   // to text/image and back restores the icon, and icon-only (label blanked) restores the label on return.
   const rememberedIcon = useRef(style.visual?.kind === 'icon' ? style.visual.icon : smartPortalIconName(target));
   const rememberedAsset = useRef(style.visual?.kind === 'image' ? style.visual.assetId : '');
   const rememberedLabel = useRef(style.label);
   useEffect(() => {
      if (style.visual?.kind === 'icon') rememberedIcon.current = style.visual.icon;
      else if (style.visual?.kind === 'image' && style.visual.assetId) rememberedAsset.current = style.visual.assetId;
      if (style.label) rememberedLabel.current = style.label;
   }, [style]);

   // The label typing buffer, resynced when the stored label changes externally (a style toggle, undo, a
   // retarget leaves it be). Committed on blur / unmount, not per keystroke, so one edit session = one undo.
   const [label, setLabel] = useState(style.label);
   const [syncedLabel, setSyncedLabel] = useState(style.label);
   if (style.label !== syncedLabel) {
      setSyncedLabel(style.label);
      setLabel(style.label);
   }

   const commitLabel = () => {
      if (kind === 'icon-only') return; // icon-only carries no label field to flush
      if (label === style.label) return; // unchanged
      onCommitStyle((prev) => ({ ...prev, label }));
   };
   useCommitOnUnmount(commitLabel);

   /** Switches the portal to `next`, carrying the remembered visual + label where the style has room for them. */
   const applyKind = (next: PortalStyleKind) => {
      const nextLabel = () => label || rememberedLabel.current;
      onCommitStyle((prev): PortalStyle => {
         const icon = prev.visual?.kind === 'icon' ? prev.visual.icon : rememberedIcon.current;
         const asset = prev.visual?.kind === 'image' ? prev.visual.assetId : rememberedAsset.current;
         switch (next) {
            case 'text': return { visual: null, label: nextLabel() };
            case 'icon-text': return { visual: { kind: 'icon', icon }, label: nextLabel() };
            case 'icon-only': return { visual: { kind: 'icon', icon }, label: '' };
            case 'image': return { visual: { kind: 'image', assetId: asset }, label: nextLabel() };
         }
      });
   };

   const pickIcon = (name: string) => onCommitStyle((prev) => ({ ...prev, visual: { kind: 'icon', icon: name } }));
   const setAsset = (assetId: string) => onCommitStyle((prev) => ({ ...prev, visual: { kind: 'image', assetId } }));

   // The preview reflects the typing buffer live even though the label commit is deferred.
   const previewContent = useMemo<PortalBoardContent>(
      () => ({ ...content, style: { ...style, label: kind === 'icon-only' ? '' : label } }),
      [content, style, kind, label],
   );
   const DestinationIcon = portalDestinationIcon(target);

   return (
      <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
         {/* Live preview at the current style. */}
         <div className="flex h-16 items-center justify-center rounded-md border border-border bg-muted/30 p-2">
            <div className="h-full w-full max-w-56">
               <PortalCard content={previewContent} size={{ width: 224, height: 48 }} />
            </div>
         </div>

         {/* Change target: reopens the shared picker in retarget mode (keeps the style + label). */}
         <button
            type="button"
            onClick={onChangeTarget}
            className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
         >
            {/* eslint-disable-next-line react-hooks/static-components */}
            <DestinationIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-left">{targetLabel(content, t)}</span>
            <Replace className="h-4 w-4 shrink-0 text-muted-foreground" />
         </button>

         {/* Style: the four-way segmented control. */}
         <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('BoardView.portalStyleLabel')}</span>
            <div className="grid grid-cols-2 gap-1.5">
               {KIND_ORDER.map(({ kind: optionKind, labelKey }) => (
                  <button
                     key={optionKind}
                     type="button"
                     onClick={() => applyKind(optionKind)}
                     className={cn(
                        'rounded-md border px-2 py-1.5 text-sm transition-colors cursor-pointer',
                        kind === optionKind ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                     )}
                  >
                     {t(labelKey)}
                  </button>
               ))}
            </div>
         </div>

         {/* Conditional visual control: the curated icon grid (icon styles) or the image upload (image style). */}
         {(kind === 'icon-text' || kind === 'icon-only') && (
            <PortalIconPicker value={style.visual?.kind === 'icon' ? style.visual.icon : ''} onPick={pickIcon} />
         )}
         {kind === 'image' && (
            <PortalImageControl assetId={style.visual?.kind === 'image' ? style.visual.assetId : ''} onUploaded={setAsset} />
         )}

         {/* Label: hidden for icon-only (its label lives in the tooltip). */}
         {kind !== 'icon-only' && (
            <label className="flex flex-col gap-1.5">
               <span className="text-xs font-medium text-muted-foreground">{t('BoardView.portalLabelField')}</span>
               <input
                  type="text"
                  value={label}
                  placeholder={t('BoardView.portalLabelPlaceholder')}
                  onChange={(event) => setLabel(event.target.value)}
                  onBlur={commitLabel}
                  onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
               />
            </label>
         )}
      </div>
   );
}

/** A short human label for the portal's current target (its cached name, else the external URL, else a kind). */
function targetLabel(content: PortalBoardContent, t: (key: string) => string): string {
   if (content.style.label) return content.style.label;
   if (content.lastKnownName) return content.lastKnownName;
   if (content.target.kind === 'external') return content.target.href;
   return t('BoardView.portalChangeTarget');
}

/**
 * The curated icon picker: a searchable `grid-cols-8` grid over the ~300-name catalog (statically imported, so
 * the search is instant and the bundle never balloons). Stores the icon NAME string; the selected name rings.
 */
function PortalIconPicker({ value, onPick }: { value: string; onPick: (name: string) => void }) {
   const { t } = useTranslation();
   const [search, setSearch] = useState('');
   const filtered = useMemo(() => {
      const term = search.trim().toLowerCase();
      return term ? PORTAL_ICON_NAMES.filter((name) => name.includes(term)) : PORTAL_ICON_NAMES;
   }, [search]);

   return (
      <div className="flex flex-col gap-1.5">
         <input
            type="text"
            value={search}
            placeholder={t('BoardView.portalIconSearch')}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
         />
         {filtered.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">{t('BoardView.portalNoIcons')}</div>
         ) : (
            <div className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-border p-1">
               {filtered.map((name) => {
                  const Icon = resolvePortalIcon(name);
                  const selected = name === value;
                  return (
                     <button
                        key={name}
                        type="button"
                        title={name}
                        aria-label={name}
                        onClick={() => onPick(name)}
                        className={cn(
                           'flex h-9 w-9 items-center justify-center rounded text-foreground hover:bg-muted cursor-pointer',
                           selected && 'ring-1 ring-primary bg-primary/10',
                        )}
                     >
                        <Icon className="h-4 w-4" />
                     </button>
                  );
               })}
            </div>
         )}
      </div>
   );
}

/**
 * The image control: uploads through the shared `processImage -> storeAsset` pipeline (the same one covers +
 * image cards use), storing the content-hash `assetId`. Shows Upload when empty, Change once set.
 */
function PortalImageControl({ assetId, onUploaded }: { assetId: string; onUploaded: (assetId: string) => void }) {
   const { t } = useTranslation();
   const [isProcessing, setIsProcessing] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);

   const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = ''; // allow re-picking the same file
      if (!file) return;
      setIsProcessing(true);
      try {
         const processed = await processImage(file);
         const hash = await storeAsset(processed);
         onUploaded(hash);
      } catch {
         toast.error(t('BoardView.imageUploadFailed'));
      } finally {
         setIsProcessing(false);
      }
   };

   return (
      <>
         <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer disabled:cursor-default"
         >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : assetId ? <ImageIcon className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            <span>{assetId ? t('BoardView.imageChange') : t('BoardView.imageUpload')}</span>
         </button>
         <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
      </>
   );
}
