// -- React Imports --
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { Card, CardContent } from '@/components/ui/card';

// -- Icon Imports --
import { Star, Skull, Swords, Tags } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { CardHeaderMolecule } from '@/components/molecules/cards/CardHeader';
import { CardSectionHeader } from '@/components/molecules/cards/CardSectionHeader';
import { CardFlipWrapper } from '@/components/molecules/cards/CardFlipWrapper';
import { MentionText } from '@/components/molecules/challenge/MentionText';

// -- Store and Hook Imports --
import { useCharacterActions, useCharacterStore } from '@/lib/stores/characterStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useToolbarHover } from '@/hooks/useToolbarHover';
import { useCardViewMode } from '@/hooks/useCardViewMode';
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';

// -- Utils Imports --
import { applyStatusTier } from '@/lib/trackers/applyStatusTier';

// -- Type Imports --
import type { CardComponentProps } from '@/components/organisms/cards/resolveCardComponent';
import type { ChallengeStatus, LegendsChallengeDetails, Tag } from '@/lib/types/character';
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * The GM Challenge Card (LitM). Front = image / name / italic types / star level / flavor; back = Limits /
 * Tags & Statuses / Threats & Consequences. Read-only for now: it renders from `details` and rides the
 * shared card chrome (flip, drawer preview, board embed). The GM editor is a later phase.
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
function TagPill({ tag }: { tag: Tag }) {
   return (
      <span className="inline-flex items-center rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-medium italic text-yellow-950">
         {tag.name}
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
                     <p className="whitespace-pre-wrap p-2 text-sm"><MentionText text={details.flavor} onMentionClick={mentionClick} /></p>
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
                     <div className="flex flex-wrap gap-1 p-2">
                        {details.limits.map((limit) => <LimitPill key={limit.id} status={limit} />)}
                     </div>

                     {/* The challenge's own statuses + tags. */}
                     <CardSectionHeader title={t('Cards.challenge.tagsAndStatuses')} icon={Tags} />
                     <div className="flex flex-wrap gap-1 p-2">
                        {details.statuses.map((status) => <StatusPill key={status.id} status={status} />)}
                        {details.tags.map((tag) => <TagPill key={tag.id} tag={tag} />)}
                     </div>

                     {/* Threats & Consequences: a tag/name, its flavor, and a dotted consequence list. */}
                     <CardSectionHeader title={t('Cards.challenge.threatsAndConsequences')} icon={Swords} />
                     <div className="flex flex-col gap-2 p-2">
                        {details.abilities.map((ability) => (
                           <div key={ability.id} className="space-y-1">
                              <p className="text-sm font-bold">{ability.tag}</p>
                              {ability.flavor && <p className="whitespace-pre-wrap text-xs"><MentionText text={ability.flavor} onMentionClick={mentionClick} /></p>}
                              {ability.consequences.length > 0 && (
                                 <ul className="list-disc space-y-0.5 pl-4 text-xs">
                                    {ability.consequences.map((consequence, index) => (
                                       <li key={index} className="whitespace-pre-wrap"><MentionText text={consequence} onMentionClick={mentionClick} /></li>
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
