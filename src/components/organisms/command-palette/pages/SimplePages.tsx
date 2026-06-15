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

// -- Local Imports --
import { commonItemClass } from '../constants';

// -- Type Imports --
import type { ThemeName } from '@/lib/stores/appSettingsStore';



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
