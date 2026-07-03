// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { Command } from 'cmdk';

// -- Icon Imports --
import { CornerDownLeft, Palette } from 'lucide-react';

// -- Store Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

// -- Constants --
import { GAME_VISUALS, GAME_CARD_OPTIONS } from '@/lib/constants/gameVisuals';

// -- Local Imports --
import { commonItemClass } from '../constants';

// -- Type Imports --
import type { ThemeName } from '@/lib/stores/appSettingsStore';
import type { GameSystem } from '@/lib/types/drawer';



// ############################
// ###   RENAME CHARACTER   ###
// ############################
interface RenameCharacterPageProps {
   inputValue: string;
};

export const RenameCharacterPage = ({ inputValue }: RenameCharacterPageProps) => {
   const { t: t } = useTranslation();
   const { updateCharacterName } = useCharacterActions();
   const { setCommandPaletteOpen } = useAppGeneralStateActions();
   const text = t('CommandPalette.actions.renameTo', { name: inputValue || '...' });

   const handleSelect = () => {
      if (inputValue) {
         updateCharacterName(inputValue);
      }
      setCommandPaletteOpen(false);
   };

   return (
      <Command.Item
         onSelect={handleSelect}
         value={text}
         className={commonItemClass}
      >
         <CornerDownLeft className="mr-2 h-4 w-4" />
         <span>{text}</span>
      </Command.Item>
   );
};



// ################################
// ###   SELECT THEME PALETTE   ###
// ################################
export const SetThemePalettePage = () => {
   const { t } = useTranslation();
   const { setTheme } = useAppSettingsActions();
   const { setCommandPaletteOpen } = useAppGeneralStateActions();

   const availableThemes: ThemeName[] = ['theme-neutral', 'theme-legends', 'theme-otherscape', 'theme-city-of-mist'];

   const handleSelect = (theme: ThemeName) => {
      setTheme(theme);
      setCommandPaletteOpen(false);
   };

   return (
      <Command.Group heading={t('CommandPalette.groups.themePalette')}>
         {availableThemes.map((theme) => (
            <Command.Item
               key={theme}
               onSelect={() => handleSelect(theme)}
               value={t(`CommandPalette.themes.${theme}`)}
               className={commonItemClass}
            >
               <Palette className="mr-2 h-4 w-4" />
               <span>{t(`CommandPalette.themes.${theme}`)}</span>
            </Command.Item>
         ))}
      </Command.Group>
   );
};



// ############################
// ###   NEW CHARACTER      ###
// ############################
interface NewCharacter_GamePageProps {
   onSelect: (game: GameSystem) => void;
};

export const NewCharacter_GamePage = ({ onSelect }: NewCharacter_GamePageProps) => {
   const { t } = useTranslation();

   return (
      <Command.Group heading={t('CommandPalette.groups.tabs')}>
         {GAME_CARD_OPTIONS.map(({ game, titleKey }) => {
            const { Icon } = GAME_VISUALS[game];
            return (
               <Command.Item
                  key={game}
                  onSelect={() => onSelect(game)}
                  value={t(titleKey)}
                  className={commonItemClass}
               >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{t(titleKey)}</span>
               </Command.Item>
            );
         })}
      </Command.Group>
   );
};
