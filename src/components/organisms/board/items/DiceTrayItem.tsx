// -- React Imports --
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Library Imports --
import cuid from 'cuid';

// -- Icon Imports --
import { Dices, Minus, Plus, X } from 'lucide-react';

// -- Basic UI Imports --
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { DIE_SIDES, migrateDiceTrayContent, rollDiceTray } from '@/lib/board/diceTray';

// -- Component Imports --
import { DieShape } from './DieShape';

// -- Type Imports --
import type { BoardItem, BoardItemContent, DiceTrayBoardContent, DiceTrayModifier, DieSides } from '@/lib/types/board';

/*
 * A tray of individual dice and labeled modifiers. The CONFIG (dice / modifiers / title) is
 * persisted in content and committed one undoable change at a time. A ROLL computes its
 * result up front, reveals it with a brief staggered shuffle (ephemeral local faces), and
 * caches the settled result - faces + the modifier breakdown + total - via the NON-undoable
 * path so it greets you on reload without ever landing on the undo stack. Every control stops
 * pointer propagation so editing never starts a canvas move.
 */

/** How long (ms) the first die shuffles before settling; each later die settles a touch after. */
const ROLL_BASE_MS = 450;
const ROLL_STAGGER_MS = 90;

/** Formats a signed modifier value for display (`+2` / `-1`). */
const signed = (value: number): string => (value >= 0 ? `+${value}` : `${value}`);

interface DiceTrayItemProps {
   item: BoardItem;
   content: DiceTrayBoardContent;
   isSelected: boolean;
   onContentChange: (content: BoardItemContent) => void;
   /** Direct, non-undoable write - used to cache the last roll. */
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onRequestSelect: () => void;
}

export function DiceTrayItem({ item, content, isSelected, onContentChange, onCacheLastKnown, onRequestSelect }: DiceTrayItemProps) {
   const { t } = useTranslation();

   // Normalize legacy trays (count-map dice, flat modifier); every commit spreads this, so
   // the migration persists on the first edit (or first roll, via the cache).
   const tray = useMemo(() => migrateDiceTrayContent(content), [content]);
   const dice = tray.dice;
   const modifiers = tray.modifiers;
   const modifierTotal = modifiers.reduce((sum, modifier) => sum + modifier.value, 0);

   // Title is held locally and committed on blur, like the other text bodies.
   const [title, setTitle] = useState(tray.title ?? '');
   const [syncedTitle, setSyncedTitle] = useState(tray.title ?? '');
   if ((tray.title ?? '') !== syncedTitle) {
      setSyncedTitle(tray.title ?? '');
      setTitle(tray.title ?? '');
   }

   const [pickerOpen, setPickerOpen] = useState(false);
   // The cycling faces during a roll reveal; null when resting (then faces come from lastRoll).
   const [liveFaces, setLiveFaces] = useState<Record<string, number> | null>(null);
   const rafRef = useRef<number | null>(null);
   useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

   const stopDrag = (event: ReactPointerEvent) => event.stopPropagation();

   const commitTitle = () => {
      const trimmed = title.trim();
      if (trimmed !== (tray.title ?? '')) onContentChange({ ...tray, title: trimmed });
   };

   const addDie = (sides: DieSides) => {
      onContentChange({ ...tray, dice: [...dice, { id: cuid(), sides }] });
      setPickerOpen(false);
   };
   const removeDie = (id: string) => onContentChange({ ...tray, dice: dice.filter((die) => die.id !== id) });

   const addModifier = () => onContentChange({ ...tray, modifiers: [...modifiers, { id: cuid(), label: '', value: 0 }] });
   const removeModifier = (id: string) => onContentChange({ ...tray, modifiers: modifiers.filter((m) => m.id !== id) });
   const setModifierValue = (id: string, value: number) =>
      onContentChange({ ...tray, modifiers: modifiers.map((m) => (m.id === id ? { ...m, value: Math.max(-999, Math.min(999, value)) } : m)) });
   const setModifierLabel = (id: string, label: string) =>
      onContentChange({ ...tray, modifiers: modifiers.map((m) => (m.id === id ? { ...m, label } : m)) });

   // ==================
   //  Roll + animated reveal
   // ==================
   const settle = (faces: Record<string, number>, breakdown: { label?: string; value: number }[], total: number) => {
      setLiveFaces(null); // rest from the cached lastRoll, not stale animation state
      onCacheLastKnown(item.id, { ...tray, lastRoll: { faces, modifiers: breakdown, total } });
   };

   const roll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const result = rollDiceTray(dice, modifiers);
      const finalFaces: Record<string, number> = {};
      for (const face of result.faces) finalFaces[face.id] = face.value;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (dice.length === 0 || reduceMotion) {
         settle(finalFaces, result.modifiers, result.total);
         return;
      }

      const start = performance.now();
      const settleAt = new Map(dice.map((die, index) => [die.id, ROLL_BASE_MS + index * ROLL_STAGGER_MS]));
      const tick = (now: number) => {
         const elapsed = now - start;
         const faces: Record<string, number> = {};
         let allDone = true;
         for (const die of dice) {
            if (elapsed >= (settleAt.get(die.id) ?? 0)) {
               faces[die.id] = finalFaces[die.id];
            } else {
               faces[die.id] = 1 + Math.floor(Math.random() * die.sides);
               allDone = false;
            }
         }
         setLiveFaces(faces);
         if (allDone) {
            rafRef.current = null;
            settle(finalFaces, result.modifiers, result.total);
         } else {
            rafRef.current = requestAnimationFrame(tick);
         }
      };
      rafRef.current = requestAnimationFrame(tick);
   };

   // Resting faces/breakdown come from the cached lastRoll; during a roll, from the live state.
   const faceOf = (id: string): number | null => (liveFaces ? liveFaces[id] ?? null : tray.lastRoll?.faces[id] ?? null);
   const displayTotal = liveFaces
      ? dice.reduce((sum, die) => sum + (liveFaces[die.id] ?? 0), 0) + modifierTotal
      : tray.lastRoll?.total ?? null;
   const displayModifiers = liveFaces ? modifiers.map((m) => ({ label: m.label, value: m.value })) : tray.lastRoll?.modifiers ?? [];

   return (
      <div className="flex w-full flex-col bg-card text-card-foreground">
         <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onFocus={onRequestSelect}
            onBlur={commitTitle}
            onPointerDown={stopDrag}
            placeholder={t('BoardView.diceTitlePlaceholder')}
            className={cn(
               'shrink-0 border-b border-border bg-transparent px-2 py-1.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/60',
               isSelected ? 'pointer-events-auto' : 'pointer-events-none',
            )}
         />

         <div className="flex flex-col">
            {/* The dice, each as its shape, plus the add-die picker. */}
            <div className="flex flex-wrap content-start gap-1.5 p-2">
               {dice.map((die) => (
                  <div key={die.id} className="group/die relative h-11 w-11">
                     <DieShape sides={die.sides} value={faceOf(die.id)} />
                     {isSelected && (
                        <button
                           type="button"
                           title={t('BoardView.diceRemoveDie')}
                           aria-label={t('BoardView.diceRemoveDie')}
                           onPointerDown={stopDrag}
                           onClick={() => removeDie(die.id)}
                           className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover/die:flex cursor-pointer"
                        >
                           <X className="h-2.5 w-2.5" />
                        </button>
                     )}
                  </div>
               ))}

               <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                     <button
                        type="button"
                        title={t('BoardView.diceAddDie')}
                        aria-label={t('BoardView.diceAddDie')}
                        onPointerDown={stopDrag}
                        className="flex h-11 w-11 items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground hover:border-foreground hover:text-foreground cursor-pointer"
                     >
                        <Plus className="h-5 w-5" />
                     </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" sideOffset={6} className="w-auto p-2">
                     <div className="grid grid-cols-4 gap-1">
                        {DIE_SIDES.map((sides) => (
                           <button
                              key={sides}
                              type="button"
                              title={`d${sides}`}
                              aria-label={`d${sides}`}
                              onClick={() => addDie(sides)}
                              className="flex h-12 w-12 flex-col items-center justify-center rounded hover:bg-muted cursor-pointer"
                           >
                              <div className="h-7 w-7"><DieShape sides={sides} value={null} /></div>
                              <span className="font-mono text-[0.6rem] text-muted-foreground">d{sides}</span>
                           </button>
                        ))}
                     </div>
                  </PopoverContent>
               </Popover>
            </div>

            {/* Modifiers: a labeled list, each row one undoable change. */}
            <div className="border-t border-border p-2">
               <div className="mb-1 flex items-center justify-between px-0.5">
                  <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{t('BoardView.diceModifiers')}</span>
                  {modifiers.length > 0 && <span className="font-mono text-xs tabular-nums text-muted-foreground">{signed(modifierTotal)}</span>}
               </div>
               <div className="flex flex-col gap-1">
                  {modifiers.map((modifier) => (
                     <ModifierRow
                        key={modifier.id}
                        modifier={modifier}
                        placeholder={t('BoardView.diceModifierPlaceholder')}
                        removeLabel={t('BoardView.diceRemoveModifier')}
                        stopDrag={stopDrag}
                        onChangeValue={(value) => setModifierValue(modifier.id, value)}
                        onChangeLabel={(label) => setModifierLabel(modifier.id, label)}
                        onRemove={() => removeModifier(modifier.id)}
                     />
                  ))}
                  <button
                     type="button"
                     onPointerDown={stopDrag}
                     onClick={addModifier}
                     className="flex items-center justify-center gap-1 rounded border border-dashed border-border py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground cursor-pointer"
                  >
                     <Plus className="h-3 w-3" />
                     {t('BoardView.diceAddModifier')}
                  </button>
               </div>
            </div>
         </div>

         {/* Roll + the breakdown + total. */}
         <div className="flex shrink-0 flex-col gap-1 border-t border-border p-2">
            {displayTotal !== null && displayModifiers.length > 0 && (
               <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[0.65rem] text-muted-foreground">
                  {displayModifiers.map((modifier, index) => (
                     <span key={index} className="font-mono">{modifier.label ? `${modifier.label} ${signed(modifier.value)}` : signed(modifier.value)}</span>
                  ))}
               </div>
            )}
            <div className="flex items-center gap-2">
               <button
                  type="button"
                  onPointerDown={stopDrag}
                  onClick={roll}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
               >
                  <Dices className="h-4 w-4" />
                  {t('BoardView.diceRoll')}
               </button>
               {displayTotal !== null && (
                  <div className="shrink-0 text-right">
                     <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">{t('BoardView.diceTotal')}</span>
                     <div className="font-mono text-xl font-bold leading-none tabular-nums">{displayTotal}</div>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}

/** One modifier row: a label (commit on blur) + a signed value stepper + remove. */
function ModifierRow({
   modifier,
   placeholder,
   removeLabel,
   stopDrag,
   onChangeValue,
   onChangeLabel,
   onRemove,
}: {
   modifier: DiceTrayModifier;
   placeholder: string;
   removeLabel: string;
   stopDrag: (event: ReactPointerEvent) => void;
   onChangeValue: (value: number) => void;
   onChangeLabel: (label: string) => void;
   onRemove: () => void;
}) {
   const [label, setLabel] = useState(modifier.label ?? '');
   const [synced, setSynced] = useState(modifier.label ?? '');
   if ((modifier.label ?? '') !== synced) {
      setSynced(modifier.label ?? '');
      setLabel(modifier.label ?? '');
   }
   const commit = () => {
      const trimmed = label.trim();
      if (trimmed !== (modifier.label ?? '')) onChangeLabel(trimmed);
   };

   return (
      <div className="flex items-center gap-1">
         <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onBlur={commit}
            onPointerDown={stopDrag}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded border border-border bg-transparent px-1.5 py-0.5 text-xs outline-none placeholder:text-muted-foreground/60"
         />
         <div className="flex shrink-0 items-center gap-0.5 rounded border border-border px-1 py-0.5">
            <StepButton onPointerDown={stopDrag} onClick={() => onChangeValue(modifier.value - 1)}><Minus className="h-3 w-3" /></StepButton>
            <span className="w-6 text-center font-mono text-xs tabular-nums">{signed(modifier.value)}</span>
            <StepButton onPointerDown={stopDrag} onClick={() => onChangeValue(modifier.value + 1)}><Plus className="h-3 w-3" /></StepButton>
         </div>
         <button
            type="button"
            title={removeLabel}
            aria-label={removeLabel}
            onPointerDown={stopDrag}
            onClick={onRemove}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground cursor-pointer"
         >
            <X className="h-3 w-3" />
         </button>
      </div>
   );
}

function StepButton({ onClick, onPointerDown, children }: { onClick: () => void; onPointerDown: (event: ReactPointerEvent) => void; children: React.ReactNode }) {
   return (
      <button
         type="button"
         onPointerDown={onPointerDown}
         onClick={onClick}
         className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
      >
         {children}
      </button>
   );
}
