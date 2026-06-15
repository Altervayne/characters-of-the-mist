// -- React Imports --
import React from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { Command } from 'cmdk';

// -- Icon Imports --
import { Backpack, Crown, FileText, Leaf, Swords, Users, CornerDownLeft } from 'lucide-react';
import { CityMythosIcon, CityLogosIcon, OtherscapeMythosIcon, OtherscapeSelfIcon, OtherscapeNoiseIcon } from '@/components/icons/ThemeIcons';

// -- Data Imports --
import { legendsThemebooks, legendsThemeTypes } from '@/lib/data/legendsData';
import { cityThemebooks, cityThemeTypes } from '@/lib/data/cityData';
import { otherscapeThemebooks, otherscapeThemeTypes } from '@/lib/data/otherscapeData';

// -- Local Imports --
import { commonItemClass } from '../constants';

// -- Type Imports --
import type { LegendsThemeTypes, ThemeTypeUnion } from '@/lib/types/creation';
import type { CityThemeType, OtherscapeThemeType } from '@/lib/types/character';



// ==================
//  Step 1: Choose Type
// ==================
interface CreateCard_TypePageProps {
   currentGame?: 'LEGENDS' | 'CITY_OF_MIST' | 'OTHERSCAPE' | 'NEUTRAL';
   onSelect: (type: 'CHARACTER_THEME' | 'GROUP_THEME' | 'LOADOUT_THEME') => void;
}
export const CreateCard_TypePage = ({ currentGame, onSelect }: CreateCard_TypePageProps) => {
   const { t } = useTranslation();
   return (
      <Command.Group heading={t('CommandPalette.groups.creation')}>
         <Command.Item value={t('CommandPalette.commands.cardTypeCharacter')} onSelect={() => onSelect('CHARACTER_THEME')} className={commonItemClass}>
            <FileText className="mr-2 h-4 w-4" />{t('CommandPalette.commands.cardTypeCharacter')}
         </Command.Item>
         {currentGame === 'LEGENDS' && (
            <Command.Item value={t('CommandPalette.commands.cardTypeFellowship')} onSelect={() => onSelect('GROUP_THEME')} className={commonItemClass}>
               <Users className="mr-2 h-4 w-4" />{t('CommandPalette.commands.cardTypeFellowship')}
            </Command.Item>
         )}
         {currentGame === 'CITY_OF_MIST' && (
            <Command.Item value={t('CommandPalette.commands.cardTypeCrew')} onSelect={() => onSelect('GROUP_THEME')} className={commonItemClass}>
               <Users className="mr-2 h-4 w-4" />{t('CommandPalette.commands.cardTypeCrew')}
            </Command.Item>
         )}
         {currentGame === 'OTHERSCAPE' && (
            <>
               <Command.Item value={t('CommandPalette.commands.cardTypeCrew')} onSelect={() => onSelect('GROUP_THEME')} className={commonItemClass}>
                  <Users className="mr-2 h-4 w-4" />{t('CommandPalette.commands.cardTypeCrew')}
               </Command.Item>
               <Command.Item value={t('CommandPalette.commands.cardTypeLoadout')} onSelect={() => onSelect('LOADOUT_THEME')} className={commonItemClass}>
                  <Backpack className="mr-2 h-4 w-4" />{t('CommandPalette.commands.cardTypeLoadout')}
               </Command.Item>
            </>
         )}
      </Command.Group>
   );
};

// ==================
//  Step 2a: Legend Theme Type
// ==================
interface CreateCard_LegendsThemeTypePageProps { onSelect: (type: LegendsThemeTypes) => void; }
export const CreateCard_LegendsThemeTypePage = ({ onSelect }: CreateCard_LegendsThemeTypePageProps) => {
      const { t } = useTranslation();
      const { t: tTypes } = useTranslation();
      const themeTypeIcons: { [key in LegendsThemeTypes]: React.ElementType } = { Origin: Leaf, Adventure: Swords, Greatness: Crown };
      return (
         <Command.Group heading={t('CommandPalette.groups.chooseThemeType')}>
            {legendsThemeTypes.map(type => {
                const IconComponent = themeTypeIcons[type as LegendsThemeTypes];
                return (
                    <Command.Item key={type} value={type} onSelect={() => onSelect(type as LegendsThemeTypes)} className={commonItemClass}>
                        <IconComponent className="mr-2 h-4 w-4" />
                        {tTypes(type)}
                    </Command.Item>
                );
            })}
         </Command.Group>
      );
};

// ==================
//  Step 2b: City Theme Type
// ==================
interface CreateCard_CityThemeTypePageProps { onSelect: (type: CityThemeType) => void; }
export const CreateCard_CityThemeTypePage = ({ onSelect }: CreateCard_CityThemeTypePageProps) => {
      const { t } = useTranslation();
      const { t: tTypes } = useTranslation();
      const themeTypeIcons: { [key in CityThemeType]: React.ElementType } = { Mythos: CityMythosIcon, Logos: CityLogosIcon };
      return (
         <Command.Group heading={t('CommandPalette.groups.chooseThemeType')}>
            {cityThemeTypes.map(type => {
                const IconComponent = themeTypeIcons[type as CityThemeType];
                return (
                    <Command.Item key={type} value={type} onSelect={() => onSelect(type as CityThemeType)} className={commonItemClass}>
                        <IconComponent className="mr-2 h-4 w-4" />
                        {tTypes(type)}
                    </Command.Item>
                );
            })}
         </Command.Group>
      );
};

// ==================
//  Step 2c: Otherscape Theme Type
// ==================
interface CreateCard_OtherscapeThemeTypePageProps { onSelect: (type: OtherscapeThemeType) => void; }
export const CreateCard_OtherscapeThemeTypePage = ({ onSelect }: CreateCard_OtherscapeThemeTypePageProps) => {
      const { t } = useTranslation();
      const { t: tTypes } = useTranslation();
      const themeTypeIcons: { [key in OtherscapeThemeType]: React.ElementType } = { Mythos: OtherscapeMythosIcon, Self: OtherscapeSelfIcon, Noise: OtherscapeNoiseIcon };
      return (
         <Command.Group heading={t('CommandPalette.groups.chooseThemeType')}>
            {otherscapeThemeTypes.map(type => {
                const IconComponent = themeTypeIcons[type as OtherscapeThemeType];
                return (
                    <Command.Item key={type} value={type} onSelect={() => onSelect(type as OtherscapeThemeType)} className={commonItemClass}>
                        <IconComponent className="mr-2 h-4 w-4" />
                        {tTypes(type)}
                    </Command.Item>
                );
            })}
         </Command.Group>
      );
};

// ==================
//  Step 3: Choose Themebook
// ==================
interface CreateCard_ThemebookPageProps {
    themeType: ThemeTypeUnion;
    inputValue: string;
    currentGame?: 'LEGENDS' | 'CITY_OF_MIST' | 'OTHERSCAPE' | 'NEUTRAL';
    onSelect: (themebook: string) => void;
}
export const CreateCard_ThemebookPage = ({ themeType, inputValue, currentGame, onSelect }: CreateCard_ThemebookPageProps) => {
   const { t } = useTranslation();
   const { t: tData } = useTranslation();

   // Determine which themebook list to use based on theme type and current game
   let availableThemebooks: { value: string; key: string; }[] = [];
   if (themeType === 'Origin' || themeType === 'Adventure' || themeType === 'Greatness') {
      availableThemebooks = legendsThemebooks[themeType] || [];
   } else if (currentGame === 'CITY_OF_MIST' && (themeType === 'Mythos' || themeType === 'Logos')) {
      availableThemebooks = cityThemebooks[themeType] || [];
   } else if (currentGame === 'OTHERSCAPE' && (themeType === 'Mythos' || themeType === 'Self' || themeType === 'Noise')) {
      availableThemebooks = otherscapeThemebooks[themeType] || [];
   }

   const text = t('CommandPalette.actions.createWith', { name: inputValue || '...' });

   return (
      <Command.Group heading={t('CommandPalette.groups.chooseThemebook')}>
         <Command.Item value={text} onSelect={() => onSelect(inputValue)} className={commonItemClass}>
            <CornerDownLeft className="mr-2 h-4 w-4" />
            <span>{text}</span>
         </Command.Item>
         {availableThemebooks.map(book => (
            <Command.Item key={book.value} value={book.value} onSelect={() => onSelect(book.value)} className={commonItemClass}>
               {tData(book.key as string)}
            </Command.Item>
         ))}
      </Command.Group>
   );
};

// ==================
//  Step 4: Input Text
// ==================
interface CreateCard_InputPageProps { inputValue: string; onSelect: () => void; }
export const CreateCard_InputPage = ({ inputValue, onSelect }: CreateCard_InputPageProps) => {
   const { t } = useTranslation();
   const text = t('CommandPalette.actions.createWith', { name: inputValue || '...' });

   return (
      <Command.Item value={text} onSelect={onSelect} className={commonItemClass}>
         <CornerDownLeft className="mr-2 h-4 w-4" />
         <span>{text}</span>
      </Command.Item>
   );
};

// ==================
//  Step 5: Input Number (Power & Weakness Tags qty.)
// ==================
interface CreateCard_NumberInputPageProps { inputValue: string; labelKey: 'CommandPalette.actions.setPowerTags' | 'CommandPalette.actions.setWeaknessTags'; onSelect: () => void; }
export const CreateCard_NumberInputPage = ({ inputValue, labelKey, onSelect }: CreateCard_NumberInputPageProps) => {
   const { t } = useTranslation();
   const text = t(labelKey, { count: Number(inputValue) || 0 });
   return (
      <Command.Item value={text} onSelect={onSelect} className={commonItemClass}>
         <CornerDownLeft className="mr-2 h-4 w-4" />
         <span>{text}</span>
      </Command.Item>
   );
};
