// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// -- Icon Imports --
import { Minus, Plus, Trash2 } from 'lucide-react';

// -- Component Imports --
import { MentionMarkdown } from '@/components/molecules/MentionMarkdown';

// -- Store and Hook Imports --
import { useInputDebouncer } from '@/hooks/useInputDebouncer';

// -- Shared Factories --
import { addRow, newConsequence, removeRowById, updateRowById } from '@/lib/cards/challengeCardFactories';

// -- Type Imports --
import type { BlandTag, ChallengeAbility, ChallengeStatus } from '@/lib/types/character';
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * The Challenge Card's inline edit rows + display pills, shared by the small card and the expanded
 * board sheet so both surfaces render identical Limits / Statuses / Tags / Threats controls. Every
 * text field rides `useInputDebouncer` with its hook state above any conditional, so toggling edit
 * mode or flipping the card never remounts a field mid-edit. List mutations go through the shared
 * `challengeCardFactories` helpers, id-keyed so a delete/reorder can't retarget an in-flight write.
 */

/** The challenge's win-conditions: an outlined `name-tier` pill on the parchment. */
export function LimitPill({ status }: { status: ChallengeStatus }) {
   return (
      <span className="inline-flex items-center gap-1 rounded-full border border-card-border/40 bg-card-popover-bg px-2 py-0.5 text-xs font-semibold text-card-popover-fg">
         <span>{status.name}</span>
         <span className="tabular-nums opacity-80">{status.tier}</span>
      </span>
   );
}

/** The challenge's own status: a green `name-tier` pill (fixed game-content color). */
export function StatusPill({ status }: { status: ChallengeStatus }) {
   return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-700 px-2 py-0.5 text-xs font-semibold text-green-50">
         <span>{status.name}</span>
         <span className="tabular-nums opacity-90">{status.tier}</span>
      </span>
   );
}

/** The challenge's own tag: a yellow italic pill (fixed game-content color). */
export function TagPill({ tag }: { tag: BlandTag }) {
   return (
      <span className="inline-flex items-center rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-medium italic text-yellow-950">
         {tag.name}
      </span>
   );
}

/** A threat's name: a filled card-accent pill (holds its shape as the flavor wraps beside it). */
export function ThreatPill({ tag }: { tag: string }) {
   return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-card-accent px-2 py-0.5 align-baseline text-xs font-semibold text-card-paper-bg">
         {tag}
      </span>
   );
}

/** A tight `-  N  +` stepper pill, styled like `LimitPill` (card tokens). Commits immediately on click. */
export function TierStepperPill({ tier, onChange }: { tier: number; onChange: (next: number) => void }) {
   return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-card-border/40 bg-card-popover-bg px-1 py-0.5 text-card-popover-fg">
         <button
            type="button"
            onClick={() => onChange(Math.max(0, tier - 1))}
            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-card-paper-fg/10 cursor-pointer"
         >
            <Minus className="h-3 w-3" />
         </button>
         <span className="w-4 text-center text-xs tabular-nums">{tier}</span>
         <button
            type="button"
            onClick={() => onChange(tier + 1)}
            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-card-paper-fg/10 cursor-pointer"
         >
            <Plus className="h-3 w-3" />
         </button>
      </span>
   );
}

/** An editable Limit/Status row: `[name input] [tier stepper] [Trash2]`. Shared by both sections (both are `ChallengeStatus`). */
export function StatusEditRow({ status, namePlaceholder, onCommitName, onCommitTier, onRemove, removeLabel }: {
   status: ChallengeStatus;
   namePlaceholder: string;
   onCommitName: (name: string) => void;
   onCommitTier: (tier: number) => void;
   onRemove: () => void;
   removeLabel: string;
}) {
   // Hook state stays above any conditional so toggling edit mode never remounts this row mid-edit.
   const [localName, setLocalName] = useInputDebouncer(status.name, onCommitName);

   return (
      <div className="flex items-center gap-1.5">
         <Input
            value={localName}
            onChange={(event) => setLocalName(event.target.value)}
            placeholder={namePlaceholder}
            className="h-7 min-w-0 flex-1 border-0 bg-transparent px-2 py-0.5 text-xs shadow-none text-card-paper-fg placeholder:text-card-paper-fg/50 focus-visible:ring-card-accent/50"
         />
         <TierStepperPill tier={status.tier} onChange={onCommitTier} />
         <button type="button" onClick={onRemove} title={removeLabel} aria-label={removeLabel} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-card-paper-fg/60 hover:bg-card-paper-fg/10 hover:text-card-paper-fg cursor-pointer">
            <Trash2 className="h-3.5 w-3.5" />
         </button>
      </div>
   );
}

/** An editable Tag row: `[name input] [Trash2]` (name-only, no icon-well). */
export function TagEditRow({ tag, namePlaceholder, onCommitName, onRemove, removeLabel }: {
   tag: BlandTag;
   namePlaceholder: string;
   onCommitName: (name: string) => void;
   onRemove: () => void;
   removeLabel: string;
}) {
   const [localName, setLocalName] = useInputDebouncer(tag.name, onCommitName);

   return (
      <div className="flex items-center gap-1.5">
         <Input
            value={localName}
            onChange={(event) => setLocalName(event.target.value)}
            placeholder={namePlaceholder}
            className="h-7 min-w-0 flex-1 border-0 bg-transparent px-2 py-0.5 text-xs italic shadow-none text-card-paper-fg placeholder:text-card-paper-fg/50 focus-visible:ring-card-accent/50"
         />
         <button type="button" onClick={onRemove} title={removeLabel} aria-label={removeLabel} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-card-paper-fg/60 hover:bg-card-paper-fg/10 hover:text-card-paper-fg cursor-pointer">
            <Trash2 className="h-3.5 w-3.5" />
         </button>
      </div>
   );
}

/** A dashed ghost "add row" button, card-token styled so it doesn't wash out on the challenge palette. */
export function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
   return (
      <button
         type="button"
         onClick={onClick}
         className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-card-border/40 py-1 text-xs text-card-paper-fg/70 hover:bg-card-paper-fg/10 cursor-pointer"
      >
         <Plus className="h-3.5 w-3.5" />
         {label}
      </button>
   );
}

/** A live styled preview of authored text, shown once it carries a `{brace}` mention (card-token chrome). */
function MentionPreview({ text }: { text: string }) {
   if (!text.includes('{')) return null;
   return (
      <MentionMarkdown text={text} className="rounded bg-card-popover-bg/40 px-2 py-1 text-xs leading-relaxed" />
   );
}

/** An editable consequence row: `[text input] [Trash2]`, id-keyed so a delete never scrambles a live edit. */
export function ConsequenceEditRow({ consequence, placeholder, onCommitText, onRemove, removeLabel }: {
   consequence: { id: string; text: string };
   placeholder: string;
   onCommitText: (text: string) => void;
   onRemove: () => void;
   removeLabel: string;
}) {
   // Hook state above any conditional, so a sibling delete/reorder never remounts this row mid-edit.
   const [localText, setLocalText] = useInputDebouncer(consequence.text, onCommitText);

   return (
      <div className="flex items-center gap-1.5">
         <Input
            value={localText}
            onChange={(event) => setLocalText(event.target.value)}
            placeholder={placeholder}
            className="h-7 min-w-0 flex-1 border-0 bg-transparent px-2 py-0.5 text-xs shadow-none text-card-paper-fg placeholder:text-card-paper-fg/50 focus-visible:ring-card-accent/50"
         />
         <button type="button" onClick={onRemove} title={removeLabel} aria-label={removeLabel} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-card-paper-fg/60 hover:bg-card-paper-fg/10 hover:text-card-paper-fg cursor-pointer">
            <Trash2 className="h-3.5 w-3.5" />
         </button>
      </div>
   );
}

/**
 * An editable Threats & Consequences ability: a tag input + flavor textarea (with a live mention
 * preview) over its own consequence list + add button. Every facet commits through `onPatch(mutate)`,
 * which applies `mutate` to the LIVE ability read from the store at commit time - never a captured
 * snapshot. Tag and flavor each carry their own debouncer, and both can flush together when the row
 * unmounts (the accordion collapses this ability as another takes focus); reading live-then-patching
 * means the second flush already sees the first's write, so neither field can clobber the other. The
 * consequence sub-rows patch the live `consequences` the same way, id-keyed via the shared helpers.
 */
export function AbilityEditRow({ ability, onPatch, onRemove }: {
   ability: ChallengeAbility;
   onPatch: (mutate: (current: ChallengeAbility) => ChallengeAbility) => void;
   onRemove: () => void;
}) {
   const { t } = useTranslation();
   // Tag + flavor ride the debouncer with their hook state above any branch, mirroring the other rows.
   const [localTag, setLocalTag] = useInputDebouncer(ability.tag, (tag) => onPatch((current) => ({ ...current, tag })));
   const [localFlavor, setLocalFlavor] = useInputDebouncer(ability.flavor, (flavor) => onPatch((current) => ({ ...current, flavor })));

   return (
      <div className="flex flex-col gap-2">
         <div className="flex items-center gap-1.5">
            <Input
               value={localTag}
               onChange={(event) => setLocalTag(event.target.value)}
               placeholder={t('Cards.challenge.threatNamePlaceholder')}
               className="h-7 min-w-0 flex-1 border-0 bg-transparent px-2 py-0.5 text-xs font-semibold shadow-none text-card-paper-fg placeholder:text-card-paper-fg/50 focus-visible:ring-card-accent/50"
            />
            <button type="button" onClick={onRemove} title={t('Cards.challenge.removeThreat')} aria-label={t('Cards.challenge.removeThreat')} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-card-paper-fg/60 hover:bg-card-paper-fg/10 hover:text-card-paper-fg cursor-pointer">
               <Trash2 className="h-3.5 w-3.5" />
            </button>
         </div>
         <Textarea
            value={localFlavor}
            onChange={(event) => setLocalFlavor(event.target.value)}
            placeholder={t('Cards.challenge.threatFlavorPlaceholder')}
            className="min-h-14 resize-none border-0 bg-card-popover-bg/40 text-xs text-card-paper-fg placeholder:text-card-paper-fg/50 shadow-none focus-visible:ring-card-accent/50"
         />
         <MentionPreview text={localFlavor} />
         <div className="flex flex-col gap-1 pl-2">
            {ability.consequences.map((consequence) => (
               <ConsequenceEditRow
                  key={consequence.id}
                  consequence={consequence}
                  placeholder={t('Cards.challenge.consequencePlaceholder')}
                  onCommitText={(text) => onPatch((current) => ({ ...current, consequences: updateRowById(current.consequences, consequence.id, { text }) }))}
                  onRemove={() => onPatch((current) => ({ ...current, consequences: removeRowById(current.consequences, consequence.id) }))}
                  removeLabel={t('Cards.challenge.remove')}
               />
            ))}
            <AddRowButton label={t('Cards.challenge.addConsequence')} onClick={() => onPatch((current) => ({ ...current, consequences: addRow(current.consequences, newConsequence()) }))} />
         </div>
      </div>
   );
}

/** A tapped-mention handler routed to a row's flavor/consequence text (or undefined on a static surface). */
export type RowMentionClick = ((segment: MentionSegment) => void) | undefined;

/**
 * The by-id commit ops for one of the challenge's single-field lists (limits / statuses / tags). Each
 * op reads the LIVE list from the store at commit time and patches by id, so a debounced field's
 * unmount-flush can't clobber a sibling row that flushed just before it. The host card owns them (it
 * has the store); the expanded sheet reuses the same ops so both surfaces commit identically.
 */
export interface RowListOps<T> {
   commitById: (id: string, updates: Partial<T>) => void;
   removeById: (id: string) => void;
   add: () => void;
}
