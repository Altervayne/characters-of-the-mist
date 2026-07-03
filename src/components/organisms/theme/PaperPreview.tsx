// -- React Imports --
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// -- Library Imports --
import cuid from 'cuid';

// -- Component Imports --
import { StatusTrackerCard } from '@/components/organisms/trackers/StatusTracker';
import { StoryThemeTrackerCard } from '@/components/organisms/trackers/StoryThemeTracker';

// -- Tracker Imports --
import { emptyTracker } from '@/lib/trackers/emptyTracker';

// -- Utils Imports --
import { PAPER_TOKEN_KEYS } from '@/lib/theme/themeTokens';

// -- Type Imports --
import type { CSSProperties } from 'react';
import type { PaperSet } from '@/lib/theme/themeTokens';

/**
 * A live, mode-agnostic preview of the draft's paper: two REAL trackers (a Status + a Story Theme) rendered
 * read-only, so it shows exactly what game-agnostic trackers look like under the chosen paper. The wrapper
 * sets the draft's `--paper-*` vars inline; the `:root` card-* fallback is `var(--paper-*)`, so the cards'
 * card-* colors resolve to the DRAFT paper and the preview tracks edits. `isDrawerPreview` makes them
 * read-only AND drops the card-type class, so they route through the paper fallback (not a game palette).
 */
export function PaperPreview({ paper }: { paper: PaperSet }) {
   const { t } = useTranslation();
   const style = Object.fromEntries(PAPER_TOKEN_KEYS.map((key) => [`--${key}`, paper[key]])) as CSSProperties;

   // Stable samples (fresh cuids only when the language changes), so the read-only preview never churns.
   const { sampleStatus, sampleStoryTheme } = useMemo(() => {
      const status = emptyTracker('STATUS');
      status.name = t('SettingsDialog.themes.paper.sampleStatus');
      status.tiers = [true, true, false, false, false, false]; // a couple active, so the ink reads on both

      const storyTheme = emptyTracker('STORY_THEME');
      storyTheme.mainTag = { id: cuid(), name: t('SettingsDialog.themes.paper.sampleTheme'), isActive: false, isScratched: false };
      storyTheme.powerTags = [{ id: cuid(), name: t('SettingsDialog.themes.paper.samplePower'), isActive: false, isScratched: false }];
      // A weakness tag so paper-destructive is exercised.
      storyTheme.weaknessTags = [{ id: cuid(), name: t('SettingsDialog.themes.paper.sampleWeakness'), isActive: false, isScratched: false }];
      return { sampleStatus: status, sampleStoryTheme: storyTheme };
   }, [t]);

   return (
      <div style={style} className="flex flex-wrap justify-center gap-4">
         <StatusTrackerCard tracker={sampleStatus} isDrawerPreview />
         <StoryThemeTrackerCard tracker={sampleStoryTheme} isDrawerPreview />
      </div>
   );
}
