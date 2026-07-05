// -- React Imports --
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

// -- Icon Imports --
import { Star, Skull, Swords, Tags, Minus, Plus, Trash2, Pencil } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { CardHeaderMolecule } from '@/components/molecules/cards/CardHeader';
import { CardSectionHeader } from '@/components/molecules/cards/CardSectionHeader';
import { CardFlipWrapper } from '@/components/molecules/cards/CardFlipWrapper';
import { MentionMarkdown } from '@/components/molecules/MentionMarkdown';

// -- Store and Hook Imports --
import { useCharacterActions, useCharacterStore } from '@/lib/stores/characterStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useToolbarHover } from '@/hooks/useToolbarHover';
import { useCardViewMode } from '@/hooks/useCardViewMode';
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';
import { useInputDebouncer } from '@/hooks/useInputDebouncer';

// -- Utils Imports --
import { applyStatusTier } from '@/lib/trackers/applyStatusTier';
import { addRow, newStatus, newTag, removeRowById, updateRowById } from '@/lib/cards/challengeCardFactories';

// -- Type Imports --
import type { CardComponentProps } from '@/components/organisms/cards/resolveCardComponent';
import type { BlandTag, ChallengeStatus, LegendsChallengeDetails } from '@/lib/types/character';
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * The GM Challenge Card (LitM). Front = image / name / italic types / star level / flavor; back = Limits /
 * Tags & Statuses / Threats & Consequences. Threats & Consequences, types, image, and star level are
 * dialog-only. Flavor, Limits, Statuses, and Tags are also editable in place while `isEditing` - the dialog
 * (ChallengeCardEditor) stays the complete editor for everything else. Inline edits share the dialog's row
 * factories/list helpers (`challengeCardFactories`) and commit through the same `updateCardDetails` action.
 */

const CARD_TYPE_CLASS = 'card-type-challenge';

/** The challenge's win-conditions: an outlined `name-tier` pill on the parchment. */
function LimitPill({ status }: { status: ChallengeStatus }) {
   return (
      <span className="inline-flex items-center gap-1 rounded-full border border-card-border/40 bg-card-popover-bg px-2 py-0.5 text-xs font-semibold text-card-popover-fg">
         <span>{status.name}</span>
         <span className="tabular-nums opacity-80">{status.tier}</span>
      </span>
   );
}

/** The challenge's own status: a green `name-tier` pill (fixed game-content color). */
function StatusPill({ status }: { status: ChallengeStatus }) {
   return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-700 px-2 py-0.5 text-xs font-semibold text-green-50">
         <span>{status.name}</span>
         <span className="tabular-nums opacity-90">{status.tier}</span>
      </span>
   );
}

/** The challenge's own tag: a yellow italic pill (fixed game-content color). */
function TagPill({ tag }: { tag: BlandTag }) {
   return (
      <span className="inline-flex items-center rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-medium italic text-yellow-950">
         {tag.name}
      </span>
   );
}

/** A tight `-  N  +` stepper pill, styled like `LimitPill` (card tokens). Commits immediately on click. */
function TierStepperPill({ tier, onChange }: { tier: number; onChange: (next: number) => void }) {
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
function StatusEditRow({ status, namePlaceholder, onCommitName, onCommitTier, onRemove, removeLabel }: {
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
function TagEditRow({ tag, namePlaceholder, onCommitName, onRemove, removeLabel }: {
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
function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
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

/** A threat's name: a filled card-accent pill (holds its shape as the flavor wraps beside it). */
function ThreatPill({ tag }: { tag: string }) {
   return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-card-accent px-2 py-0.5 align-baseline text-xs font-semibold text-card-paper-bg">
         {tag}
      </span>
   );
}

export const LegendsChallengeCard = React.memo(
   React.forwardRef<HTMLDivElement, CardComponentProps>(
      ({ card, isEditing = false, isSnapshot, isDrawerPreview, isBoardEmbed = false, isMobile = false, useVerticalStack, dragAttributes, dragListeners, onEditCard, onExport, onMentionClick }, ref) => {
         const { t } = useTranslation();
         const actions = useCharacterActions();
         const character = useCharacterStore((state) => state.character);
         const details = card.details as LegendsChallengeDetails;

         const { isHovered, hoverHandlers } = useToolbarHover(isDrawerPreview);
         const { url } = useAssetObjectUrl(details.assetId);

         const globalCardViewMode = useAppSettingsStore((state) => state.isSideBySideView ? 'SIDE_BY_SIDE' : 'FLIP');
         const effectiveViewMode = useMemo(() => card.viewMode || globalCardViewMode, [card.viewMode, globalCardViewMode]);
         const { handleCycleViewMode } = useCardViewMode(card);

         const name = card.title || t('Cards.challenge.untitled');
         const stars = Math.max(0, Math.min(10, details.challengeLevel));

         // Flavor text (front). Hook state stays above the `isEditing` branch below so flipping the card
         // or toggling edit mode never remounts the field and drops a pending edit.
         const [localFlavor, setLocalFlavor] = useInputDebouncer(
            details.flavor,
            (value) => actions.updateCardDetails(card.id, { flavor: value }),
         );

         // Limits / statuses / tags (back) list mutations. Each edit re-derives the full next list and
         // commits it wholesale via `updateCardDetails` - identical for the sheet and the board embed
         // (both ride the same per-embed store), so there is no isBoardEmbed branch here.
         const commitLimits = (next: ChallengeStatus[]) => actions.updateCardDetails(card.id, { limits: next });
         const commitStatuses = (next: ChallengeStatus[]) => actions.updateCardDetails(card.id, { statuses: next });
         const commitTags = (next: BlandTag[]) => actions.updateCardDetails(card.id, { tags: next });

         // A tapped mention applies to the active character: a status create-or-RAISES (bubble-up, no
         // duplicate); a tag de-dupes by name. Only wired on the interactive sheet card (see below).
         const handleMentionClick = (segment: MentionSegment) => {
            if (segment.type === 'status') {
               const wanted = segment.name.trim().toLowerCase();
               const existing = character?.trackers.statuses.find((status) => status.name.trim().toLowerCase() === wanted);
               if (existing) {
                  actions.updateStatus(existing.id, { tiers: applyStatusTier(existing.tiers, segment.tier) });
                  toast.success(t('Cards.challenge.mention.raised', { name: segment.name }));
               } else {
                  const id = actions.addStatus(segment.name);
                  actions.updateStatus(id, { tiers: applyStatusTier(Array(6).fill(false), segment.tier) });
                  toast.success(t('Cards.challenge.mention.applied', { name: segment.name }));
               }
               return;
            }
            if (segment.type === 'tag') {
               const wanted = segment.name.trim().toLowerCase();
               if (character?.trackers.storyTags.some((tag) => tag.name.trim().toLowerCase() === wanted)) {
                  toast(t('Cards.challenge.mention.alreadyExists', { name: segment.name }));
                  return;
               }
               actions.addStoryTag(segment.name);
               toast.success(t('Cards.challenge.mention.applied', { name: segment.name }));
            }
         };
         // A board embed routes taps to the board (create-only, via `onMentionClick`); the live sheet card
         // uses the create-or-raise handler above; a static preview / drawer snapshot stays plain.
         const mentionClick = isBoardEmbed
            ? onMentionClick
            : (!isDrawerPreview && !isSnapshot) ? handleMentionClick : undefined;

         const cardShell = cn(
            isMobile ? 'w-full h-full' : 'w-62.5 h-150',
            'flex flex-col border-2 shadow-lg p-0 overflow-hidden gap-0',
            'bg-card-paper-bg text-card-paper-fg border-card-border',
            'relative z-0',
            CARD_TYPE_CLASS,
            { 'h-30 shadow-none pointer-events-none border-2 border-card-border': isDrawerPreview },
         );

         const CardFront = (
            <Card className={cardShell}>
               {/* Image banner (front art). */}
               <div className={cn('w-full shrink-0 overflow-hidden bg-muted', isDrawerPreview ? 'h-12' : 'h-52')}>
                  {url ? (
                     <img src={url} alt={name} title={name} className="h-full w-full object-cover" />
                  ) : (
                     <div className="flex h-full w-full items-center justify-center text-card-paper-fg/30">
                        <Skull className={isDrawerPreview ? 'h-6 w-6' : 'h-12 w-12'} />
                     </div>
                  )}
               </div>

               <h2 className={cn('shrink-0 px-2 pt-2 text-center font-bold', isDrawerPreview ? 'text-sm' : 'text-xl')}>{name}</h2>

               {details.types.length > 0 && (
                  <p className={cn('shrink-0 px-2 pb-1 text-center italic text-card-paper-fg/70', isDrawerPreview ? 'text-[0.65rem]' : 'text-sm')}>
                     {details.types.join(' · ')}
                  </p>
               )}

               {/* Star level divider (cosmetic difficulty label). */}
               <div className="flex shrink-0 items-center justify-center gap-0.5 border-y border-card-accent/30 py-1 text-card-accent">
                  {Array.from({ length: stars }).map((_, index) => (
                     <Star key={index} className={cn('fill-current', isDrawerPreview ? 'h-3 w-3' : 'h-4 w-4')} />
                  ))}
               </div>

               {!isDrawerPreview && (
                  <div className="min-w-0 grow overflow-y-auto overflow-x-hidden overscroll-contain">
                     {isEditing ? (
                        <div className="flex flex-col gap-1 p-2">
                           <Textarea
                              value={localFlavor}
                              onChange={(event) => setLocalFlavor(event.target.value)}
                              placeholder={t('Cards.challenge.flavorPlaceholder')}
                              className="min-h-20 resize-none border-0 bg-card-popover-bg/40 text-sm text-card-paper-fg placeholder:text-card-paper-fg/50 shadow-none focus-visible:ring-card-accent/50"
                           />
                           {localFlavor.includes('{') && (
                              <MentionMarkdown text={localFlavor} className="rounded bg-card-popover-bg/40 px-2 py-1 text-xs leading-relaxed" />
                           )}
                           {/* Low-contrast pointer to the back sections - they carry the rest of the inline edit surface. */}
                           <p className="mt-1 flex items-center justify-center gap-1.5 text-[0.65rem] text-card-paper-fg/50">
                              <Pencil className="h-3 w-3" />
                              {t('Cards.challenge.editOnBackHint')}
                           </p>
                        </div>
                     ) : (
                        <MentionMarkdown text={details.flavor} onMentionClick={mentionClick} className="p-2 text-sm" />
                     )}
                  </div>
               )}
            </Card>
         );

         const CardBack = (
            <Card className={cardShell}>
               <CardHeaderMolecule title={name} />

               <CardContent className="flex min-h-0 grow flex-col overflow-hidden p-0">
                  <div className="min-w-0 grow overflow-y-auto overflow-x-hidden overscroll-contain">
                     {/* Limits: the statuses required to defeat it. */}
                     <CardSectionHeader title={t('Cards.challenge.limits')} icon={Skull} />
                     {isEditing ? (
                        <div className="flex flex-col gap-1 p-2">
                           {details.limits.map((limit) => (
                              <StatusEditRow
                                 key={limit.id}
                                 status={limit}
                                 namePlaceholder={t('Cards.challenge.limitNamePlaceholder')}
                                 onCommitName={(name) => commitLimits(updateRowById(details.limits, limit.id, { name }))}
                                 onCommitTier={(tier) => commitLimits(updateRowById(details.limits, limit.id, { tier }))}
                                 onRemove={() => commitLimits(removeRowById(details.limits, limit.id))}
                                 removeLabel={t('Cards.challenge.remove')}
                              />
                           ))}
                           <AddRowButton label={t('Cards.challenge.addLimit')} onClick={() => commitLimits(addRow(details.limits, newStatus()))} />
                        </div>
                     ) : (
                        <div className="flex flex-wrap gap-1 p-2">
                           {details.limits.length > 0
                              ? details.limits.map((limit) => <LimitPill key={limit.id} status={limit} />)
                              : <p className="text-xs text-card-paper-fg/50">{`[${t('Cards.challenge.noLimits')}]`}</p>}
                        </div>
                     )}

                     {/* The challenge's own statuses + tags. */}
                     <CardSectionHeader title={t('Cards.challenge.tagsAndStatuses')} icon={Tags} />
                     {isEditing ? (
                        <div className="flex flex-col gap-2 p-2">
                           <div className="flex flex-col gap-1">
                              {details.statuses.map((status) => (
                                 <StatusEditRow
                                    key={status.id}
                                    status={status}
                                    namePlaceholder={t('Cards.challenge.statusNamePlaceholder')}
                                    onCommitName={(name) => commitStatuses(updateRowById(details.statuses, status.id, { name }))}
                                    onCommitTier={(tier) => commitStatuses(updateRowById(details.statuses, status.id, { tier }))}
                                    onRemove={() => commitStatuses(removeRowById(details.statuses, status.id))}
                                    removeLabel={t('Cards.challenge.remove')}
                                 />
                              ))}
                              <AddRowButton label={t('Cards.challenge.addStatus')} onClick={() => commitStatuses(addRow(details.statuses, newStatus()))} />
                           </div>
                           <div className="flex flex-col gap-1">
                              {details.tags.map((tag) => (
                                 <TagEditRow
                                    key={tag.id}
                                    tag={tag}
                                    namePlaceholder={t('Cards.challenge.tagNamePlaceholder')}
                                    onCommitName={(name) => commitTags(updateRowById(details.tags, tag.id, { name }))}
                                    onRemove={() => commitTags(removeRowById(details.tags, tag.id))}
                                    removeLabel={t('Cards.challenge.remove')}
                                 />
                              ))}
                              <AddRowButton label={t('Cards.challenge.addTag')} onClick={() => commitTags(addRow(details.tags, newTag()))} />
                           </div>
                        </div>
                     ) : (
                        <div className="flex flex-wrap items-center gap-1 p-2">
                           {details.statuses.length > 0
                              ? details.statuses.map((status) => <StatusPill key={status.id} status={status} />)
                              : <p className="text-xs text-card-paper-fg/50">{`[${t('Cards.challenge.noStatuses')}]`}</p>}
                           {details.tags.length > 0
                              ? details.tags.map((tag) => <TagPill key={tag.id} tag={tag} />)
                              : <p className="text-xs text-card-paper-fg/50">{`[${t('Cards.challenge.noTags')}]`}</p>}
                        </div>
                     )}

                     {/* Threats & Consequences: a threat-name pill with its flavor inline, over a skull-bulleted list. */}
                     <CardSectionHeader title={t('Cards.challenge.threatsAndConsequences')} icon={Swords} />
                     <div className="flex flex-col gap-2 p-2">
                        {details.abilities.map((ability) => (
                           <div key={ability.id} className="space-y-1">
                              {/* Inline flow (not flex) so the flavor flows word-by-word right after the pill and wraps. */}
                              <div className="text-xs leading-snug">
                                 <ThreatPill tag={ability.tag} />
                                 {ability.flavor && <>{' '}<MentionMarkdown text={ability.flavor} onMentionClick={mentionClick} className="inline [&_p]:my-0 [&_p]:inline" /></>}
                              </div>
                              {ability.consequences.length > 0 && (
                                 <ul className="list-none space-y-0.5 text-xs">
                                    {ability.consequences.map((consequence) => (
                                       <li key={consequence.id} className="flex items-start gap-1.5">
                                          {/* Skull in a header-colored rhombus (rotated square); the icon counter-rotates to stay upright. */}
                                          <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 rotate-45 items-center justify-center rounded-[2px] bg-card-header-bg">
                                             <Skull className="h-2.5 w-2.5 -rotate-45 text-card-header-fg" strokeWidth={2.75} />
                                          </span>
                                          <MentionMarkdown text={consequence.text} onMentionClick={mentionClick} className="min-w-0 [&_p]:my-0" />
                                       </li>
                                    ))}
                                 </ul>
                              )}
                           </div>
                        ))}
                     </div>
                  </div>
               </CardContent>
            </Card>
         );

         return (
            <CardFlipWrapper
               ref={ref}
               effectiveViewMode={effectiveViewMode}
               isDrawerPreview={isDrawerPreview ?? false}
               isBoardEmbed={isBoardEmbed}
               isSnapshot={isSnapshot}
               useVerticalStack={useVerticalStack}
               card={card}
               isHovered={isHovered}
               hoverHandlers={hoverHandlers}
               isEditing={isEditing}
               dragAttributes={dragAttributes}
               dragListeners={dragListeners}
               cardTheme={CARD_TYPE_CLASS}
               onExport={onExport}
               onCycleViewMode={handleCycleViewMode}
               onFlip={() => actions.flipCard(card.id)}
               onDelete={() => actions.deleteCard(card.id)}
               // Editing opens the dedicated Challenge editor (routed by the sheet on cardType).
               onEditCard={onEditCard}
               cardFront={CardFront}
               cardBack={CardBack}
            />
         );
      },
   ),
);

LegendsChallengeCard.displayName = 'LegendsChallengeCard';
