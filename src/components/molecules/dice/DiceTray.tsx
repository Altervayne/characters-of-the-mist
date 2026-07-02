// -- React Imports --
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Library Imports --
import cuid from 'cuid';

// -- Icon Imports --
import { ChevronDown, CornerDownLeft, Dices, History, Minus, Plus, Terminal, Trash2, X } from 'lucide-react';

// -- Basic UI Imports --
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { QUICK_PICK, appendRollEntry, migrateDiceTrayContent, rollDiceTray } from '@/lib/dice/diceTray';
import { parseDiceCommand } from '@/lib/dice/diceCommand';
import { formatRelativeItemDate } from '@/lib/drawer/itemDateDisplay';

// -- Hook Imports --
import { useLongPress } from '@/hooks/mobile/useLongPress';

// -- Utils Imports --
import { readSafeAreaInsetBottom } from '@/lib/utils/safeArea';

// -- Component Imports --
import { DieShape } from './DieShape';

// -- Type Imports --
import type { DiceTrayContent, DiceTrayDie, DiceTrayModifier, RollEntry } from '@/lib/dice/diceTrayTypes';
import type { Position } from '@/hooks/mobile/useLongPress';

/*
 * The board-agnostic dice tray: a list of individual dice + labeled modifiers (+ optional title), a roll
 * with a staggered reveal, and a total/breakdown. It is a PURE presentational core - it knows nothing
 * about boards, selection, or undo. The host decides what its two writes mean:
 *   - `onChange` commits a CONFIG edit (the host chooses undoable or not).
 *   - `onCacheRoll` writes the SETTLED roll, kept separate from `onChange` so a host can route it down a
 *     non-undoable path (the board does, so a roll never lands on the undo stack).
 * `editable` gates the inputs (read-only when false); `growToFill` renders the drag-resize slack spacer
 * (the board canvas needs it; a fixed-size host does not). Every control stops pointer propagation -
 * harmless off-canvas, needed on the board so editing never starts a drag.
 */

/** How long (ms) the first die shuffles before settling; each later die settles a touch after. */
const ROLL_BASE_MS = 450;
const ROLL_STAGGER_MS = 90;

/** Formats a signed modifier value for display (`+2` / `-1`). */
const signed = (value: number): string => (value >= 0 ? `+${value}` : `${value}`);

interface DiceTrayProps {
   content: DiceTrayContent;
   /** Whether the tray's inputs are editable (read-only when false). */
   editable: boolean;
   /** Commit a config edit (dice / modifiers / title). The host decides if it is undoable. */
   onChange: (content: DiceTrayContent) => void;
   /** Write the settled roll. Kept separate from `onChange` so the host can make it non-undoable. */
   onCacheRoll: (content: DiceTrayContent) => void;
   /** Render the `data-board-fill-spacer` slack so a footer pins to the bottom under canvas drag-resize. */
   growToFill?: boolean;
   /** Whether to render the title input. Off for the generic app-wide tray, which is unnamed. */
   showTitle?: boolean;
   /** Optional: fired when the title input is focused (the board uses it to select the item). */
   onTitleFocus?: () => void;
   /** Grow the interactive controls to comfortable touch targets (and un-hide the per-die buttons, which
       are hover-gated on desktop). Off by default, so desktop + board render exactly as before. */
   isMobile?: boolean;
}

export function DiceTray({ content, editable, onChange, onCacheRoll, growToFill = false, showTitle = true, onTitleFocus, isMobile = false }: DiceTrayProps) {
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
   // Mobile only: the die whose context menu is open, plus the finger point it anchors to. Long-press a
   // die (touch has no hover) to open a positioned menu with its penalty/remove actions.
   const [menuDieId, setMenuDieId] = useState<string | null>(null);
   const [menuPos, setMenuPos] = useState<Position | null>(null);
   const openDieMenu = (id: string, position: Position) => { setMenuDieId(id); setMenuPos(position); };
   const closeDieMenu = () => { setMenuDieId(null); setMenuPos(null); };
   // The cycling faces during a roll reveal; null when resting (then faces come from lastRoll).
   const [liveFaces, setLiveFaces] = useState<Record<string, number> | null>(null);
   const rafRef = useRef<number | null>(null);
   useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

   const stopDrag = (event: ReactPointerEvent) => event.stopPropagation();

   const commitTitle = () => {
      const trimmed = title.trim();
      if (trimmed !== (tray.title ?? '')) onChange({ ...tray, title: trimmed });
   };

   const addDie = (sides: number) => {
      onChange({ ...tray, dice: [...dice, { id: cuid(), sides }] });
      setPickerOpen(false);
   };
   const removeDie = (id: string) => onChange({ ...tray, dice: dice.filter((die) => die.id !== id) });
   // A penalty die: its rolled value subtracts. Toggled per die in editable mode.
   const toggleNegative = (id: string) =>
      onChange({ ...tray, dice: dice.map((die) => (die.id === id ? { ...die, negative: !die.negative } : die)) });

   // A typed/pasted formula REPLACES the tray's dice + modifiers (a command describes a full setup). One
   // onChange = one undoable edit on the board, persisted directly on the app tray. A bad parse is a no-op.
   const applyCommand = (raw: string): boolean => {
      const result = parseDiceCommand(raw);
      if ('error' in result) return false;
      onChange({ ...tray, dice: result.dice, modifiers: result.modifiers });
      return true;
   };

   const addModifier = () => onChange({ ...tray, modifiers: [...modifiers, { id: cuid(), label: '', value: 0 }] });
   const removeModifier = (id: string) => onChange({ ...tray, modifiers: modifiers.filter((m) => m.id !== id) });
   const setModifierValue = (id: string, value: number) =>
      onChange({ ...tray, modifiers: modifiers.map((m) => (m.id === id ? { ...m, value: Math.max(-999, Math.min(999, value)) } : m)) });
   const setModifierLabel = (id: string, label: string) =>
      onChange({ ...tray, modifiers: modifiers.map((m) => (m.id === id ? { ...m, label } : m)) });

   // ==================
   //  Roll + animated reveal
   // ==================
   const settle = (faces: Record<string, number>, breakdown: { label?: string; value: number }[], total: number) => {
      setLiveFaces(null); // rest from the cached lastRoll, not stale animation state
      // Record the roll in history alongside the live lastRoll - both via the non-undoable cache path, so a
      // roll never becomes undo steps. The entry is self-contained (config + faces in dice order + total).
      const entry: RollEntry = {
         id: cuid(),
         at: Date.now(),
         dice: dice.map((die) => (die.negative ? { sides: die.sides, negative: true } : { sides: die.sides })),
         modifiers: breakdown,
         faces: dice.map((die) => faces[die.id] ?? 0),
         total,
      };
      onCacheRoll({ ...tray, lastRoll: { faces, modifiers: breakdown, total }, history: appendRollEntry(tray.history ?? [], entry) });
   };

   // Clicking a history entry RESTORES its setup (dice + modifiers, fresh ids) into the tray - a normal,
   // undoable-on-board edit. It loads the configuration, not the past random result.
   const restoreEntry = (entry: RollEntry) => onChange({
      ...tray,
      dice: entry.dice.map((die) => (die.negative ? { id: cuid(), sides: die.sides, negative: true } : { id: cuid(), sides: die.sides })),
      modifiers: entry.modifiers.map((modifier) => ({ id: cuid(), label: modifier.label, value: modifier.value })),
   });

   // Clearing history is roll-cache management, not a config edit - non-undoable, like the appends.
   const clearHistory = () => onCacheRoll({ ...tray, history: [] });

   const roll = () => {
      closeDieMenu(); // rolling dismisses an open per-die menu (no-op on desktop)
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
      ? dice.reduce((sum, die) => { const v = liveFaces[die.id] ?? 0; return sum + (die.negative ? -v : v); }, 0) + modifierTotal
      : tray.lastRoll?.total ?? null;
   const displayModifiers = liveFaces ? modifiers.map((m) => ({ label: m.label, value: m.value })) : tray.lastRoll?.modifiers ?? [];

   // The die whose mobile context menu is open (mobile only); undefined once it is removed or dismissed.
   const menuDie = menuDieId ? dice.find((die) => die.id === menuDieId) : undefined;

   return (
      <div className="flex min-h-0 w-full flex-1 flex-col bg-card text-card-foreground">
         {showTitle && (
            <input
               type="text"
               value={title}
               onChange={(event) => setTitle(event.target.value)}
               onFocus={onTitleFocus}
               onBlur={commitTitle}
               onPointerDown={stopDrag}
               placeholder={t('BoardView.diceTitlePlaceholder')}
               className={cn(
                  'shrink-0 border-b border-border bg-transparent px-2 py-1.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/60',
                  editable ? 'pointer-events-auto' : 'pointer-events-none',
               )}
            />
         )}

         <div className="flex flex-col">
            {/* The dice, each as its shape, plus the add-die picker. */}
            <div className="flex flex-wrap content-start gap-1.5 p-2">
               {dice.map((die) => (
                  <DieCell
                     key={die.id}
                     die={die}
                     face={faceOf(die.id)}
                     editable={editable}
                     isMobile={isMobile}
                     penaltyLabel={t('BoardView.diceToggleNegative')}
                     removeLabel={t('BoardView.diceRemoveDie')}
                     stopDrag={stopDrag}
                     onToggleNegative={toggleNegative}
                     onRemoveDie={removeDie}
                     onLongPress={openDieMenu}
                  />
               ))}

               <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                     <button
                        type="button"
                        title={t('BoardView.diceAddDie')}
                        aria-label={t('BoardView.diceAddDie')}
                        onPointerDown={stopDrag}
                        className={cn('flex h-11 w-11 items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground hover:border-foreground hover:text-foreground cursor-pointer', isMobile && 'h-13 w-13')}
                     >
                        <Plus className={isMobile ? 'h-6 w-6' : 'h-5 w-5'} />
                     </button>
                  </PopoverTrigger>
                  {/* Above the app-modal overlay band (z-60) so the picker clears a host sheet (the mobile
                      dice tray sits in a bottom sheet); already top-most on desktop/board, so no change there. */}
                  <PopoverContent align="start" sideOffset={6} className="z-[70] w-auto p-2">
                     <div className="grid grid-cols-4 gap-1">
                        {QUICK_PICK.map((sides) => (
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
                     {/* Custom sides: add any dN by hand (any integer >= 2 -> a weird die). */}
                     <CustomSidesAdder
                        placeholder={t('BoardView.diceCustomSidesPlaceholder')}
                        addLabel={t('BoardView.diceAddCustomDie')}
                        onAdd={addDie}
                        isMobile={isMobile}
                     />
                  </PopoverContent>
               </Popover>

               {/* Build the whole tray from a typed formula like 1d6+2d12+4-2. Always rendered, like the
                   add-die picker, so the dice row's layout is identical whether or not the tray is selected
                   (a board item gates `editable` on selection - a conditional in-flow control would reflow). */}
               <CommandPopover
                  triggerLabel={t('BoardView.diceCommandLabel')}
                  placeholder={t('BoardView.diceCommandPlaceholder')}
                  applyLabel={t('BoardView.diceCommandApply')}
                  errorLabel={t('BoardView.diceCommandError')}
                  stopDrag={stopDrag}
                  onApply={applyCommand}
                  isMobile={isMobile}
               />
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
                        isMobile={isMobile}
                     />
                  ))}
                  <button
                     type="button"
                     onPointerDown={stopDrag}
                     onClick={addModifier}
                     className={cn(
                        'flex items-center justify-center gap-1 rounded border border-dashed border-border py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground cursor-pointer',
                        isMobile && 'py-2.5 text-sm',
                     )}
                  >
                     <Plus className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} />
                     {t('BoardView.diceAddModifier')}
                  </button>
               </div>
            </div>
         </div>

         {/* Roll history: a tucked, collapsed-by-default log of recent rolls; click one to restore its setup. */}
         <RollHistory
            entries={tray.history ?? []}
            editable={editable}
            label={t('BoardView.diceHistory')}
            emptyLabel={t('BoardView.diceHistoryEmpty')}
            restoreLabel={t('BoardView.diceHistoryRestore')}
            clearLabel={t('BoardView.diceHistoryClear')}
            stopDrag={stopDrag}
            onRestore={restoreEntry}
            onClear={clearHistory}
            isMobile={isMobile}
         />

         {/* Flexible slack: when the tray is dragged taller than its content, the extra space
             lands here so the Roll footer stays pinned to the bottom (the box reads the floor as
             its height minus this spacer). Only the canvas-resizable host renders it. */}
         {growToFill && <div data-board-fill-spacer className="min-h-0 flex-1" />}

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
                  className={cn(
                     'flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer',
                     isMobile && 'gap-2 py-2 text-base',
                  )}
               >
                  <Dices className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
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

         {/* Mobile: a positioned per-die context menu, anchored where the finger long-pressed. A labeled
             penalty toggle and a separated destructive Remove, clamped on-screen. Mobile-only - never
             mounted on desktop, which keeps its hover-gated buttons. */}
         {isMobile && menuDie && menuPos && (
            <DieContextMenu
               die={menuDie}
               position={menuPos}
               makePenaltyLabel={t('BoardView.diceMakePenaltyDie')}
               makeNormalLabel={t('BoardView.diceMakeNormalDie')}
               removeLabel={t('BoardView.diceRemoveDie')}
               onToggle={() => { toggleNegative(menuDie.id); closeDieMenu(); }}
               onRemove={() => { removeDie(menuDie.id); closeDieMenu(); }}
               onClose={closeDieMenu}
            />
         )}
      </div>
   );
}

/**
 * A positioned per-die context menu on mobile, anchored at the finger. Mirrors the drawer's floating
 * menu: it measures its own rendered rect and clamps left/top inside the viewport (allowing for the
 * bottom safe area) before paint, so a die near an edge still opens fully on-screen. A transparent
 * full-screen catcher dismisses on an outside tap. Sits above the app-modal band so it clears the host
 * sheet.
 */
function DieContextMenu({ die, position, makePenaltyLabel, makeNormalLabel, removeLabel, onToggle, onRemove, onClose }: {
   die: DiceTrayDie;
   position: Position;
   makePenaltyLabel: string;
   makeNormalLabel: string;
   removeLabel: string;
   onToggle: () => void;
   onRemove: () => void;
   onClose: () => void;
}) {
   const menuRef = useRef<HTMLDivElement>(null);
   const [clamped, setClamped] = useState<{ left: number; top: number } | null>(null);

   useLayoutEffect(() => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      const safeBottom = readSafeAreaInsetBottom();
      const maxLeft = window.innerWidth - rect.width;
      const maxTop = window.innerHeight - rect.height - safeBottom;
      setClamped({ left: Math.max(0, Math.min(position.x, maxLeft)), top: Math.max(0, Math.min(position.y, maxTop)) });
   }, [position]);

   // Before the clamp measures, anchor at the raw finger point (size is position-independent, so the
   // pre-clamp rect is still accurate); the layout effect then nudges it fully on-screen.
   const style: CSSProperties = { position: 'fixed', left: `${clamped ? clamped.left : position.x}px`, top: `${clamped ? clamped.top : position.y}px` };

   return (
      <>
         <div className="fixed inset-0 z-[70]" onClick={onClose} />
         <div ref={menuRef} style={style} className="z-[71] min-w-44 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
            <div className="flex flex-col p-1">
               <button
                  type="button"
                  onClick={onToggle}
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm hover:bg-muted cursor-pointer"
               >
                  {die.negative ? <Plus className="h-5 w-5 shrink-0" /> : <Minus className="h-5 w-5 shrink-0" />}
                  {die.negative ? makeNormalLabel : makePenaltyLabel}
               </button>
               <div className="my-1 h-px bg-border" />
               <button
                  type="button"
                  onClick={onRemove}
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-destructive hover:bg-destructive/10 cursor-pointer"
               >
                  <Trash2 className="h-5 w-5 shrink-0" />
                  {removeLabel}
               </button>
            </div>
         </div>
      </>
   );
}

/**
 * One die in the tray. Desktop keeps its hover-gated penalty/remove buttons; mobile shows a clean face
 * and opens a context menu on long-press (touch has no hover), with a subtle press-down cue. The
 * long-press hook is touch-only, so it is inert on desktop; it is still gated to mobile anyway.
 */
function DieCell({ die, face, editable, isMobile, penaltyLabel, removeLabel, stopDrag, onToggleNegative, onRemoveDie, onLongPress }: {
   die: DiceTrayDie;
   face: number | null;
   editable: boolean;
   isMobile: boolean;
   penaltyLabel: string;
   removeLabel: string;
   stopDrag: (event: ReactPointerEvent) => void;
   onToggleNegative: (id: string) => void;
   onRemoveDie: (id: string) => void;
   onLongPress: (id: string, position: Position) => void;
}) {
   const { isPressing, handlers } = useLongPress({ onLongPress: (pos) => onLongPress(die.id, pos) });
   const touchHandlers = isMobile && editable ? handlers : undefined;

   return (
      <div
         className={cn('group/die relative h-11 w-11', isMobile && 'h-13 w-13 transition-transform', isMobile && isPressing && 'scale-95')}
         {...touchHandlers}
      >
         <DieShape sides={die.sides} value={face} negative={die.negative} />
         {editable && !isMobile && (
            <>
               {/* Penalty toggle (top-left): flips the die negative so its value subtracts. Reveals on hover. */}
               <button
                  type="button"
                  title={penaltyLabel}
                  aria-label={penaltyLabel}
                  onPointerDown={stopDrag}
                  onClick={() => onToggleNegative(die.id)}
                  className="absolute -left-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-secondary text-secondary-foreground group-hover/die:flex cursor-pointer"
               >
                  {die.negative ? <Plus className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
               </button>
               {/* Remove (top-right). */}
               <button
                  type="button"
                  title={removeLabel}
                  aria-label={removeLabel}
                  onPointerDown={stopDrag}
                  onClick={() => onRemoveDie(die.id)}
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover/die:flex cursor-pointer"
               >
                  <X className="h-2.5 w-2.5" />
               </button>
            </>
         )}
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
   isMobile = false,
}: {
   modifier: DiceTrayModifier;
   placeholder: string;
   removeLabel: string;
   stopDrag: (event: ReactPointerEvent) => void;
   onChangeValue: (value: number) => void;
   onChangeLabel: (label: string) => void;
   onRemove: () => void;
   isMobile?: boolean;
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
            className={cn(
               'min-w-0 flex-1 rounded border border-border bg-transparent px-1.5 py-0.5 text-xs outline-none placeholder:text-muted-foreground/60',
               isMobile && 'h-9 px-2 text-sm',
            )}
         />
         <div className={cn('flex shrink-0 items-center gap-0.5 rounded border border-border px-1 py-0.5', isMobile && 'h-9 gap-1 px-1.5 py-0')}>
            <StepButton onPointerDown={stopDrag} onClick={() => onChangeValue(modifier.value - 1)} isMobile={isMobile}><Minus className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} /></StepButton>
            <span className={cn('w-6 text-center font-mono text-xs tabular-nums', isMobile && 'w-8 text-sm')}>{signed(modifier.value)}</span>
            <StepButton onPointerDown={stopDrag} onClick={() => onChangeValue(modifier.value + 1)} isMobile={isMobile}><Plus className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} /></StepButton>
         </div>
         <button
            type="button"
            title={removeLabel}
            aria-label={removeLabel}
            onPointerDown={stopDrag}
            onClick={onRemove}
            className={cn(
               'flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground cursor-pointer',
               isMobile && 'h-9 w-9',
            )}
         >
            <X className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} />
         </button>
      </div>
   );
}

/** A compact one-line summary of a past roll, e.g. `2d6 -1d8 +3` (dice grouped by sides + sign, then mods). */
function summarizeRoll(entry: RollEntry): string {
   const groups: { sides: number; negative: boolean; count: number }[] = [];
   for (const die of entry.dice) {
      const group = groups.find((g) => g.sides === die.sides && g.negative === !!die.negative);
      if (group) group.count += 1;
      else groups.push({ sides: die.sides, negative: !!die.negative, count: 1 });
   }
   const parts = [
      ...groups.map((g) => `${g.negative ? '-' : ''}${g.count}d${g.sides}`),
      ...entry.modifiers.map((m) => signed(m.value)),
   ];
   return parts.length > 0 ? parts.join(' ') : '—';
}

/**
 * The tucked roll history: a collapsed-by-default toggle that expands to a scrollable list of recent rolls
 * (newest first - result + relative time). Clicking an entry restores its setup (editable only); a clear
 * affordance empties the log. Reading the log is always allowed; restoring / clearing gate on `editable`.
 */
function RollHistory({ entries, editable, label, emptyLabel, restoreLabel, clearLabel, stopDrag, onRestore, onClear, isMobile = false }: {
   entries: RollEntry[];
   editable: boolean;
   label: string;
   emptyLabel: string;
   restoreLabel: string;
   clearLabel: string;
   stopDrag: (event: ReactPointerEvent) => void;
   onRestore: (entry: RollEntry) => void;
   onClear: () => void;
   isMobile?: boolean;
}) {
   const [open, setOpen] = useState(false);
   return (
      <div className="shrink-0 border-t border-border">
         <button
            type="button"
            onPointerDown={stopDrag}
            onClick={() => setOpen((value) => !value)}
            className={cn(
               'flex w-full items-center justify-between px-2 py-1.5 text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground cursor-pointer',
               isMobile && 'px-3 py-3 text-xs',
            )}
         >
            <span className="flex items-center gap-1"><History className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} />{label}{entries.length > 0 && ` (${entries.length})`}</span>
            <ChevronDown className={cn('transition-transform', isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5', open && 'rotate-180')} />
         </button>
         {open && (
            <div className="max-h-40 overflow-y-auto px-2 pb-2">
               {entries.length === 0 ? (
                  <p className={cn('px-0.5 py-1 text-xs text-muted-foreground', isMobile && 'py-2 text-sm')}>{emptyLabel}</p>
               ) : (
                  <div className="flex flex-col gap-0.5">
                     {entries.map((entry) => (
                        <button
                           key={entry.id}
                           type="button"
                           disabled={!editable}
                           title={editable ? restoreLabel : undefined}
                           onPointerDown={stopDrag}
                           onClick={() => onRestore(entry)}
                           className={cn('flex items-start justify-between gap-2 rounded px-1.5 py-1 text-left', isMobile && 'px-2 py-2.5', editable ? 'hover:bg-muted cursor-pointer' : 'cursor-default')}
                        >
                           {/* The summary wraps (a big roll stays fully readable); the timestamp aligns to its first line. */}
                           <span className={cn('min-w-0 flex-1 break-words font-mono text-xs', isMobile && 'text-sm')}>
                              <span className="text-muted-foreground">{summarizeRoll(entry)} = </span>
                              <span className="font-bold tabular-nums">{entry.total}</span>
                           </span>
                           <span className={cn('shrink-0 text-[0.6rem] text-muted-foreground', isMobile && 'text-xs')}>{formatRelativeItemDate(entry.at)}</span>
                        </button>
                     ))}
                  </div>
               )}
               {editable && entries.length > 0 && (
                  <button
                     type="button"
                     onPointerDown={stopDrag}
                     onClick={onClear}
                     className={cn(
                        'mt-1 flex w-full items-center justify-center gap-1 rounded py-1 text-[0.65rem] text-muted-foreground hover:text-destructive cursor-pointer',
                        isMobile && 'py-2.5 text-xs',
                     )}
                  >
                     <Trash2 className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} />{clearLabel}
                  </button>
               )}
            </div>
         )}
      </div>
   );
}

/**
 * The tucked dice-command entry: a small icon that opens a field where a formula (e.g. `1d6+2d12+4`)
 * REPLACES the tray. `onApply` returns false on a bad parse, which surfaces a subtle inline error and
 * leaves the tray untouched (the popover stays open so the typo can be fixed).
 */
function CommandPopover({ triggerLabel, placeholder, applyLabel, errorLabel, stopDrag, onApply, isMobile = false }: {
   triggerLabel: string;
   placeholder: string;
   applyLabel: string;
   errorLabel: string;
   stopDrag: (event: ReactPointerEvent) => void;
   onApply: (raw: string) => boolean;
   isMobile?: boolean;
}) {
   const [open, setOpen] = useState(false);
   const [value, setValue] = useState('');
   const [error, setError] = useState(false);
   const submit = () => {
      if (onApply(value.trim())) {
         setValue('');
         setError(false);
         setOpen(false);
      } else {
         setError(true);
      }
   };
   return (
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(false); }}>
         <PopoverTrigger asChild>
            <button
               type="button"
               title={triggerLabel}
               aria-label={triggerLabel}
               onPointerDown={stopDrag}
               className={cn('flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer', isMobile && 'h-13 w-13')}
            >
               <Terminal className={isMobile ? 'h-6 w-6' : 'h-5 w-5'} />
            </button>
         </PopoverTrigger>
         <PopoverContent align="start" sideOffset={6} className="z-[70] w-64 p-2">
            <div className="flex items-center gap-1">
               <input
                  type="text"
                  autoFocus
                  value={value}
                  onChange={(event) => { setValue(event.target.value); setError(false); }}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }}
                  onPointerDown={stopDrag}
                  placeholder={placeholder}
                  className={cn(
                     'min-w-0 flex-1 rounded border bg-transparent px-1.5 py-1 font-mono text-xs outline-none placeholder:font-sans placeholder:text-muted-foreground/60',
                     isMobile && 'py-2 text-sm',
                     error ? 'border-destructive' : 'border-border',
                  )}
               />
               <button
                  type="button"
                  title={applyLabel}
                  aria-label={applyLabel}
                  onPointerDown={stopDrag}
                  onClick={submit}
                  className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer', isMobile && 'h-9 w-9')}
               >
                  <CornerDownLeft className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
               </button>
            </div>
            {error && <p className="mt-1 px-0.5 text-[0.65rem] text-destructive">{errorLabel}</p>}
         </PopoverContent>
      </Popover>
   );
}

/** A number field for adding a die with any side count (>= 2): the by-hand path to a weird die. */
function CustomSidesAdder({ placeholder, addLabel, onAdd, isMobile = false }: { placeholder: string; addLabel: string; onAdd: (sides: number) => void; isMobile?: boolean }) {
   const [raw, setRaw] = useState('');
   const submit = () => {
      const sides = parseInt(raw, 10);
      if (Number.isFinite(sides) && sides >= 2) {
         onAdd(sides);
         setRaw('');
      }
   };
   return (
      <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
         <span className={cn('font-mono text-xs text-muted-foreground', isMobile && 'text-sm')}>d</span>
         <input
            type="number"
            min={2}
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }}
            placeholder={placeholder}
            className={cn('w-16 rounded border border-border bg-transparent px-1.5 py-0.5 text-xs outline-none placeholder:text-muted-foreground/60', isMobile && 'w-20 px-2 py-1.5 text-sm')}
         />
         <button
            type="button"
            title={addLabel}
            aria-label={addLabel}
            onClick={submit}
            className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer', isMobile && 'h-9 w-9')}
         >
            <Plus className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
         </button>
      </div>
   );
}

function StepButton({ onClick, onPointerDown, children, isMobile = false }: { onClick: () => void; onPointerDown: (event: ReactPointerEvent) => void; children: React.ReactNode; isMobile?: boolean }) {
   return (
      <button
         type="button"
         onPointerDown={onPointerDown}
         onClick={onClick}
         className={cn('flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer', isMobile && 'h-8 w-8')}
      >
         {children}
      </button>
   );
}
