// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { ExternalLink, User } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store and Hook Imports --
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';

// -- Board Imports --
import { condensedThemeRows, characterPortraitAssetId, trackerCounts, type CondensedThemeRow } from '@/lib/board/characterOverview';

// -- Type Imports --
import type { Character } from '@/lib/types/character';

/*
 * The read-only character overview shown by a board character element: an app-themed panel (app
 * tokens only - the game is a label, theme type is a label, nothing fixed-colour) with an identity
 * header (portrait + name + game + open) and a condensed row per theme card. It grows with its rows
 * via the box's min-height measure; the deeper stats live in the character tab.
 */

interface CharacterBoardOverviewProps {
   character: Character;
   onOpen: () => void;
}

export function CharacterBoardOverview({ character, onOpen }: CharacterBoardOverviewProps) {
   const { t } = useTranslation();
   const portrait = useAssetObjectUrl(characterPortraitAssetId(character));
   const rows = condensedThemeRows(character);
   const trackers = trackerCounts(character);

   return (
      <div className="flex w-full flex-1 flex-col overflow-hidden rounded-lg border border-border bg-popover/95 shadow-lg backdrop-blur-sm">
         {/* Identity header (stands in for the character card; its deep stats stay in the tab). */}
         <div className="relative flex shrink-0 items-center gap-3 border-b border-border p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
               {portrait.url
                  ? <img src={portrait.url} alt="" className="h-full w-full object-cover" />
                  : <User className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div className="flex min-w-0 flex-col pr-6">
               <span className="truncate text-sm font-semibold text-foreground">{character.name || t('BoardView.referenceSourceRemoved')}</span>
               <span className="truncate text-xs text-muted-foreground">{t(`Drawer.Types.${character.game}`)}</span>
            </div>
            <button
               type="button"
               title={t('BoardView.openCharacter')}
               aria-label={t('BoardView.openCharacter')}
               onPointerDown={(event) => event.stopPropagation()}
               onClick={onOpen}
               className="absolute right-1.5 top-1.5 flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
               <ExternalLink className="h-4 w-4" />
            </button>
         </div>

         {/* Condensed theme rows. */}
         {rows.length === 0 ? (
            <div className="px-3 py-2 text-xs italic text-muted-foreground">{t('BoardView.overviewNoThemes')}</div>
         ) : (
            <div className="flex flex-col divide-y divide-border">
               {rows.map((row) => <ThemeRow key={row.id} row={row} game={character.game} />)}
            </div>
         )}

         {/* Light tracker footer (only when the character has trackers). */}
         {trackers.total > 0 && (
            <div className="mt-auto shrink-0 border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
               {t('BoardView.overviewTrackers', { statuses: trackers.statuses, tags: trackers.tags, themes: trackers.themes })}
            </div>
         )}
      </div>
   );
}

/** One condensed theme row: a type/themebook line, the main tag, and a power/weakness (or gear/flaws) count. */
function ThemeRow({ row, game }: { row: CondensedThemeRow; game: Character['game'] }) {
   const { t } = useTranslation();

   // The type line: a real theme shows "<type> · <themebook>"; a group reads as Fellowship/Crew; a loadout as Loadout.
   const typeLine = row.rowKind === 'group'
      ? (game === 'LEGENDS' ? t('BoardView.themeRowFellowship') : t('BoardView.themeRowCrew'))
      : row.rowKind === 'loadout'
         ? t('BoardView.themeRowLoadout')
         : [row.themeType ? t(row.themeType) : null, row.themebook].filter(Boolean).join(' · ');

   const counts = row.rowKind === 'loadout'
      ? t('BoardView.overviewGearFlaws', { gear: row.powerCount, flaws: row.weaknessCount })
      : t('BoardView.overviewPowerWeakness', { power: row.powerCount, weakness: row.weaknessCount });

   return (
      <div className="flex min-w-0 flex-col gap-0.5 px-3 py-1.5">
         {/* Line 1: the identifying type / themebook, prominent and truncating (never crushed). */}
         {typeLine && <span className="truncate text-xs font-medium text-foreground">{typeLine}</span>}
         {/* Line 2: the main tag with its power/weakness counts. */}
         <div className="flex min-w-0 items-center justify-between gap-2">
            <span className={cn('truncate text-[11px] text-muted-foreground', row.mainTagScratched && 'line-through', row.mainTagActive && 'font-semibold text-foreground')}>
               {row.mainTagName || t('BoardView.overviewUnnamedTag')}
            </span>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{counts}</span>
         </div>
      </div>
   );
}
