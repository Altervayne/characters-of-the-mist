// -- React Imports --
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';

// -- Icon Imports --
import { Backpack, CheckSquare, CornerDownLeft, Crown, FileText, Leaf, ListTodo, Palette, Swords, Users } from 'lucide-react';
import { CityMythosIcon, CityLogosIcon, OtherscapeMythosIcon, OtherscapeSelfIcon, OtherscapeNoiseIcon } from '@/components/icons/theme-icons';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { legendsThemebooks, legendsThemeTypes } from '@/lib/data/legends-data';
import { cityThemebooks, cityThemeTypes } from '@/lib/data/city-data';
import { otherscapeThemebooks, otherscapeThemeTypes } from '@/lib/data/otherscape-data';

// -- Store and Hook Imports --
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useCharacterActions, useCharacterStore } from '@/lib/stores/characterStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { Variants } from 'framer-motion';
import type { ThemeName } from '@/lib/stores/appSettingsStore';
import type { CommandAction } from '@/hooks/useCommandPaletteActions';
import type { CreateCardOptions, LegendsThemeTypes, ThemeTypeUnion } from '@/lib/types/creation';
import type { CityThemeType, OtherscapeThemeType } from '@/lib/types/character';



//      /#=======================================#\
//      ##          PAGE SUB-COMPONENTS          ##
//      \#=======================================#/

const commonItemClass = "flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground";

// ###### ROOT ######
interface RootPageProps {
   commandGroups: Record<string, CommandAction[]>;
   onSelectCommand: (command: CommandAction) => void;
};

const RootPage = ({ commandGroups, onSelectCommand }: RootPageProps) => {
   return (
      <>
         {Object.entries(commandGroups).map(([groupName, groupCommands], index) => (
            <Command.Group key={groupName} heading={groupName} className={cn("text-xs", index !== 0 && "mt-4")}>
               {groupCommands.map((command) => (
                  <Command.Item 
                     key={command.id} 
                     onSelect={() => onSelectCommand(command)}
                     value={command.label}
                     className={commonItemClass}
                  >
                     <command.icon className="mr-2 h-4 w-4" />
                     <span>{command.label}</span>
                  </Command.Item>
               ))}
            </Command.Group>
         ))}
      </>
   );
};



// ###### RENAME CHARACTER ######
interface RenameCharacterPageProps {
   inputValue: string;
};

const RenameCharacterPage = ({ inputValue }: RenameCharacterPageProps) => {
   const { t: t } = useTranslation();
   const { updateCharacterName } = useCharacterActions();
   const { setCommandPaletteOpen } = useAppGeneralStateActions();
   const text = t('actions.renameTo', { name: inputValue || '...' });

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



// ###### SELECT THEME PALETTE ######
const SetThemePalettePage = () => {
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



// ###### CREATE CARD ######
// --- Step 1: Choose Type ---
interface CreateCard_TypePageProps {
   currentGame?: 'LEGENDS' | 'CITY_OF_MIST' | 'OTHERSCAPE' | 'NEUTRAL';
   onSelect: (type: 'CHARACTER_THEME' | 'GROUP_THEME' | 'LOADOUT_THEME') => void;
}
const CreateCard_TypePage = ({ currentGame, onSelect }: CreateCard_TypePageProps) => {
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

// --- Step 2a: Legends Theme Type ---
interface CreateCard_LegendsThemeTypePageProps { onSelect: (type: LegendsThemeTypes) => void; }
const CreateCard_LegendsThemeTypePage = ({ onSelect }: CreateCard_LegendsThemeTypePageProps) => {
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

// --- Step 2b: City Theme Type ---
interface CreateCard_CityThemeTypePageProps { onSelect: (type: CityThemeType) => void; }
const CreateCard_CityThemeTypePage = ({ onSelect }: CreateCard_CityThemeTypePageProps) => {
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

// --- Step 2c: Otherscape Theme Type ---
interface CreateCard_OtherscapeThemeTypePageProps { onSelect: (type: OtherscapeThemeType) => void; }
const CreateCard_OtherscapeThemeTypePage = ({ onSelect }: CreateCard_OtherscapeThemeTypePageProps) => {
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

// --- Step 3: Choose Themebook ---
interface CreateCard_ThemebookPageProps {
    themeType: ThemeTypeUnion;
    inputValue: string;
    currentGame?: 'LEGENDS' | 'CITY_OF_MIST' | 'OTHERSCAPE' | 'NEUTRAL';
    onSelect: (themebook: string) => void;
}
const CreateCard_ThemebookPage = ({ themeType, inputValue, currentGame, onSelect }: CreateCard_ThemebookPageProps) => {
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

// --- Step 4: Input Text ---
interface CreateCard_InputPageProps { inputValue: string; onSelect: () => void; }
const CreateCard_InputPage = ({ inputValue, onSelect }: CreateCard_InputPageProps) => {
   const { t } = useTranslation();
   const text = t('actions.createWith', { name: inputValue || '...' });

   return (
      <Command.Item value={text} onSelect={onSelect} className={commonItemClass}>
         <CornerDownLeft className="mr-2 h-4 w-4" />
         <span>{text}</span>
      </Command.Item>
   );
};

// --- Step 5: Input Number (Power & Weakness Tags qty.) ---
interface CreateCard_NumberInputPageProps { inputValue: string; labelKey: 'actions.setPowerTags' | 'actions.setWeaknessTags'; onSelect: () => void; }
const CreateCard_NumberInputPage = ({ inputValue, labelKey, onSelect }: CreateCard_NumberInputPageProps) => {
   const { t } = useTranslation();
   const text = t(labelKey, { count: Number(inputValue) || 0 });
   return (
      <Command.Item value={text} onSelect={onSelect} className={commonItemClass}>
         <CornerDownLeft className="mr-2 h-4 w-4" />
         <span>{text}</span>
      </Command.Item>
   );
};



// ###### CREATE TRACKER ######
// --- Step 1: Choose Type ---
interface CreateTracker_TypePageProps {
   onSelect: (type: 'STATUS' | 'STORY_TAG') => void;
}
const CreateTracker_TypePage = ({ onSelect }: CreateTracker_TypePageProps) => {
   const { t } = useTranslation();
   return (
      <Command.Group heading={t('CommandPalette.groups.creation')}>
         <Command.Item value={t('CommandPalette.commands.trackerTypeStatus')} onSelect={() => onSelect('STATUS')} className={commonItemClass}>
            <CheckSquare className="mr-2 h-4 w-4" />{t('CommandPalette.commands.trackerTypeStatus')}
         </Command.Item>
         <Command.Item value={t('CommandPalette.commands.trackerTypeStoryTag')} onSelect={() => onSelect('STORY_TAG')} className={commonItemClass}>
            <ListTodo className="mr-2 h-4 w-4" />{t('CommandPalette.commands.trackerTypeStoryTag')}
         </Command.Item>
      </Command.Group>
   );
};

// --- Step 2: Enter Name ---
interface CreateTracker_NamePageProps {
    inputValue: string;
    onSelect: () => void;
}
const CreateTracker_NamePage = ({ inputValue, onSelect }: CreateTracker_NamePageProps) => {
   const { t } = useTranslation();
   const text = t('actions.createWith', { name: inputValue || '...' });
   return (
      <Command.Item value={text} onSelect={onSelect} className={commonItemClass}>
         <CornerDownLeft className="mr-2 h-4 w-4" />
         <span>{text}</span>
      </Command.Item>
   );
};



//      /#========================================#\
//      ##          FULL COMMAND PALETTE          ##
//      \#========================================#/

interface CommandPaletteProps {
   commands: CommandAction[];
};

const commandVariants: Variants = {
   hidden: { opacity: 0, y: -30, scale: 0.95 },
   visible: { opacity: 1, y: 0, scale: 1 },
};



export function CommandPalette({ commands }: CommandPaletteProps) {
   const { t } = useTranslation();
   const { t: tNotify } = useTranslation();
   const { addCard, addStatus, addStoryTag } = useCharacterActions();
   const character = useCharacterStore((state) => state.character);
   const currentGame = character?.game;
   const isOpen = useAppGeneralStateStore((state) => state.isCommandPaletteOpen);
   const { setCommandPaletteOpen, toggleCommandPalette } = useAppGeneralStateActions();

   const [inputValue, setInputValue] = useState('');
   const [cardOptions, setCardOptions] = useState<Partial<CreateCardOptions>>({});
   const [trackerType, setTrackerType] = useState<'STATUS' | 'STORY_TAG' | null>(null);
   const [placeholder, setPlaceholder] = useState(t('CommandPalette.placeholder_1'));

   const paletteRef = useRef<HTMLDivElement>(null);
   const inputRef = useRef<HTMLInputElement>(null);



   // --- Pagination system ---
   const [pages, setPages] = useState<string[]>(['root']);
   const activePage = pages[pages.length - 1];
   
   const popPage = () => {
      setPages((p) => p.slice(0, -1));
   };

   useEffect(() => {
      if (!isOpen) {
         // Reset command palette state when closed
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setPages(['root']);
         setInputValue('');
         setCardOptions({});
      }
   }, [isOpen]);



   // --- Placeholder randomizer ---
   useEffect(() => {
      if (isOpen) {
         let newPlaceholder = '';
         const randomIndex = Math.floor(Math.random() * 25) + 1;

         switch(activePage) {
            case 'renameCharacter': newPlaceholder = t('CommandPalette.placeholders.renameCharacter'); break;

            case 'createCard_ThemeType': newPlaceholder = t('CommandPalette.placeholders.themeType'); break;
            case 'createCard_Themebook': newPlaceholder = t('CommandPalette.placeholders.themebook'); break;
            case 'createCard_MainTag': newPlaceholder = t('CommandPalette.placeholders.mainTagName'); break;
            case 'createCard_PowerTags': newPlaceholder = t('CommandPalette.placeholders.powerTags'); break;
            case 'createCard_WeaknessTags': newPlaceholder = t('CommandPalette.placeholders.weaknessTags'); break;

            case 'createTracker_Type': newPlaceholder = t('CommandPalette.placeholders.trackerType'); break;
            case 'createTracker_Name': newPlaceholder = t('CommandPalette.placeholders.trackerName'); break;

            default:
               newPlaceholder = t(`CommandPalette.placeholder_${randomIndex}`);
         }

         // Update placeholder based on active page
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setPlaceholder(newPlaceholder);
         inputRef.current?.focus();
      }
   }, [isOpen, t, activePage]);



   // --- Click outside event listener ---
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (paletteRef.current && !paletteRef.current.contains(event.target as Node)) {
            setCommandPaletteOpen(false);
         }
      };
      if (isOpen) {
         document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
      };
   }, [isOpen, setCommandPaletteOpen]);

   // --- Key presses event listener ---
   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            toggleCommandPalette();
         }
      };
      const handleEscape = (e: KeyboardEvent) => {
         if (e.key === 'Escape') {
            setCommandPaletteOpen(false);
         }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', handleEscape);
      return () => {
         document.removeEventListener('keydown', handleKeyDown);
         document.removeEventListener('keydown', handleEscape);
      };
   }, [toggleCommandPalette, setCommandPaletteOpen]);



   // --- Command Handling ---
   const onSelectCommand = (command: CommandAction) => {
      if (command.action) {
         command.action();
         setCommandPaletteOpen(false);
      } else if (command.pageId) {
         setPages(p => [...p, command.pageId!]);
         setInputValue('');
      }
   };

   const commandGroups = commands.reduce((acc, command) => {
      (acc[command.group] = acc[command.group] || []).push(command);
      return acc;
   }, {} as Record<string, CommandAction[]>);

   const inputPages = [
      'renameCharacter',
      'createCard_Themebook',
      'createCard_MainTag',
      'createCard_PowerTags',
      'createCard_WeaknessTags',
   ];



   return (
      <AnimatePresence>
         {isOpen && (
            <motion.div
               ref={paletteRef}
               variants={commandVariants}
               initial="hidden"
               animate="visible"
               exit="hidden"
               transition={{ duration: 0.15, ease: 'easeOut' }}
               className={cn(
                  "fixed top-[15%] left-1/2 w-full max-w-xl -translate-x-1/2",
                  "rounded-lg border-2 bg-background shadow-2xl z-1000"
               )}
            >
               <Command
                  filter={(value, search) => {
                     if (inputPages.includes(activePage)) {
                        return 1;
                     }
                     return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                  }}
                  onKeyDown={(e) => {
                     if (e.key === 'Backspace' && !inputValue && activePage !== 'root') {
                        e.preventDefault();
                        popPage();
                     }
                  }}
                  className={cn(
                     '**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground',
                     '[&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5',
                     '**:[[cmdk-input]]:h-12',
                     '**:[[cmdk-item]]:px-2 **:[[cmdk-item]]:py-3',
                     '[&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5'
                  )}
               >
                  <Command.Input 
                     ref={inputRef}
                     value={inputValue}
                     onValueChange={setInputValue}
                     placeholder={activePage === 'renameCharacter' ? t('CommandPalette.placeholders.renameCharacter') : placeholder}
                     className={cn(
                        "h-12 w-full border-b bg-transparent pl-4 pr-4 text-foreground",
                        "placeholder:text-muted-foreground",
                        "focus:outline-none",
                        "disabled:cursor-not-allowed disabled:opacity-50"
                     )}
                  />
                  <Command.List className="max-h-75 overflow-y-auto overflow-x-hidden p-2 bg-card rounded-b-lg">
                     <Command.Empty className="py-6 text-center text-sm">{t('CommandPalette.empty')}</Command.Empty>
                     {activePage === 'root' && (<RootPage commandGroups={commandGroups} onSelectCommand={onSelectCommand} />)}
                     {activePage === 'renameCharacter' && (<RenameCharacterPage inputValue={inputValue} />)}
                     {activePage === 'setThemePalette' && (<SetThemePalettePage />)}
                     


                     {/* ------------- */}
                     {/* CARD CREATION */}
                     {/* ------------- */}

                     {activePage === 'createCard_Type' && (
                        <CreateCard_TypePage currentGame={currentGame} onSelect={(type) => {
                           if (type === 'LOADOUT_THEME') {
                              // Loadout cards don't have theme types or main tags, create immediately
                              addCard({
                                 cardType: 'LOADOUT_THEME',
                                 powerTagsCount: 2,
                                 weaknessTagsCount: 1
                              });
                              toast.success(tNotify('Notifications.card.created'));
                              setCommandPaletteOpen(false);
                           } else {
                              setCardOptions({ cardType: type });
                              setPages(p => [...p, type === 'CHARACTER_THEME' ? 'createCard_ThemeType' : 'createCard_MainTag']);
                           }
                        }} />
                     )}
                     {activePage === 'createCard_ThemeType' && currentGame === 'LEGENDS' && (
                        <CreateCard_LegendsThemeTypePage onSelect={(type) => {
                            setCardOptions(prev => ({ ...prev, themeType: type }));
                            setPages(p => [...p, 'createCard_Themebook']);
                        }} />
                     )}
                     {activePage === 'createCard_ThemeType' && currentGame === 'CITY_OF_MIST' && (
                        <CreateCard_CityThemeTypePage onSelect={(type) => {
                            setCardOptions(prev => ({ ...prev, themeType: type }));
                            setPages(p => [...p, 'createCard_Themebook']);
                        }} />
                     )}
                     {activePage === 'createCard_ThemeType' && currentGame === 'OTHERSCAPE' && (
                        <CreateCard_OtherscapeThemeTypePage onSelect={(type) => {
                            setCardOptions(prev => ({ ...prev, themeType: type }));
                            setPages(p => [...p, 'createCard_Themebook']);
                        }} />
                     )}
                     {activePage === 'createCard_Themebook' && (
                        <CreateCard_ThemebookPage
                           themeType={cardOptions.themeType!}
                           inputValue={inputValue}
                           currentGame={currentGame}
                           onSelect={(themebook) => {
                              setCardOptions(prev => ({ ...prev, themebook: themebook }));
                              setPages(p => [...p, 'createCard_MainTag']);
                              setInputValue('');
                           }}
                        />
                     )}
                     {activePage === 'createCard_MainTag' && (
                        <CreateCard_InputPage inputValue={inputValue} onSelect={() => {
                           setCardOptions(prev => ({ ...prev, mainTagName: inputValue }));
                           setPages(p => [...p, 'createCard_PowerTags']);
                           setInputValue('2');
                        }} />
                     )}
                     {activePage === 'createCard_PowerTags' && (
                        <CreateCard_NumberInputPage inputValue={inputValue} labelKey='actions.setPowerTags' onSelect={() => {
                           setCardOptions(prev => ({ ...prev, powerTagsCount: Number(inputValue) }));
                           setPages(p => [...p, 'createCard_WeaknessTags']);
                           setInputValue('1');
                        }} />
                     )}
                     {activePage === 'createCard_WeaknessTags' && (
                        <CreateCard_NumberInputPage inputValue={inputValue} labelKey='actions.setWeaknessTags' onSelect={() => {
                           const finalOptions = { ...cardOptions, weaknessTagsCount: Number(inputValue) } as CreateCardOptions;
                           addCard(finalOptions);
                           toast.success(tNotify('Notifications.card.created'));
                           setCommandPaletteOpen(false);
                        }} />
                     )}



                     {/* ---------------- */}
                     {/* TRACKER CREATION */}
                     {/* ---------------- */}
                     
                     {activePage === 'createTracker_Type' && (
                        <CreateTracker_TypePage onSelect={(type) => {
                           setTrackerType(type);
                           setPages(p => [...p, 'createTracker_Name']);
                        }} />
                     )}

                     {activePage === 'createTracker_Name' && (
                        <CreateTracker_NamePage inputValue={inputValue} onSelect={() => {
                           if (trackerType === 'STATUS') addStatus(inputValue);
                           if (trackerType === 'STORY_TAG') addStoryTag(inputValue);
                           toast.success(tNotify('Notifications.tracker.created'));
                           setCommandPaletteOpen(false);
                        }} />
                     )}


                  </Command.List>
               </Command>
            </motion.div>
         )}
      </AnimatePresence>
   );
};