// -- React Imports --
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store and Hook Imports --
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useCharacterActions, useCharacterStore } from '@/lib/stores/characterStore';
import { useCommandPaletteNavigation } from '@/hooks/command-palette/useCommandPaletteNavigation';
import { useCommandPaletteWizard } from '@/hooks/command-palette/useCommandPaletteWizard';

// -- Local Imports --
import { commandVariants } from './constants';
import { RootPage } from './pages/RootPage';
import { RenameCharacterPage, SetThemePalettePage } from './pages/SimplePages';
import {
   CreateCard_TypePage,
   CreateCard_LegendsThemeTypePage,
   CreateCard_CityThemeTypePage,
   CreateCard_OtherscapeThemeTypePage,
   CreateCard_ThemebookPage,
   CreateCard_InputPage,
   CreateCard_NumberInputPage,
} from './pages/CreateCardPages';
import { CreateTracker_TypePage, CreateTracker_NamePage } from './pages/CreateTrackerPages';

// -- Type Imports --
import type { CommandAction } from '@/hooks/useCommandPaletteActions';
import type { CreateCardOptions } from '@/lib/types/creation';



interface CommandPaletteProps {
   commands: CommandAction[];
};



export function CommandPalette({ commands }: CommandPaletteProps) {
   const { t } = useTranslation();
   const { t: tNotify } = useTranslation();
   const { addCard, addStatus, addStoryTag } = useCharacterActions();
   const character = useCharacterStore((state) => state.character);
   const currentGame = character?.game;
   const isOpen = useAppGeneralStateStore((state) => state.isCommandPaletteOpen);
   const { setCommandPaletteOpen, toggleCommandPalette } = useAppGeneralStateActions();

   const { activePage, pushPage, popPage } = useCommandPaletteNavigation(isOpen);
   const {
      inputValue,
      setInputValue,
      cardOptions,
      setCardOptions,
      trackerType,
      setTrackerType,
      placeholder,
      inputRef,
   } = useCommandPaletteWizard(isOpen, activePage);

   const paletteRef = useRef<HTMLDivElement>(null);



   // ==================
   //  Click outside event listener
   // ==================
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

   // ==================
   //  Key presses event listener
   // ==================
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



   // ==================
   //  Command Handling
   // ==================
   const onSelectCommand = (command: CommandAction) => {
      if (command.action) {
         command.action();
         setCommandPaletteOpen(false);
      } else if (command.pageId) {
         pushPage(command.pageId);
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



                     {/* ================== */}
                     {/*  CARD CREATION */}
                     {/* ================== */}

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
                              pushPage(type === 'CHARACTER_THEME' ? 'createCard_ThemeType' : 'createCard_MainTag');
                           }
                        }} />
                     )}
                     {activePage === 'createCard_ThemeType' && currentGame === 'LEGENDS' && (
                        <CreateCard_LegendsThemeTypePage onSelect={(type) => {
                            setCardOptions(prev => ({ ...prev, themeType: type }));
                            pushPage('createCard_Themebook');
                        }} />
                     )}
                     {activePage === 'createCard_ThemeType' && currentGame === 'CITY_OF_MIST' && (
                        <CreateCard_CityThemeTypePage onSelect={(type) => {
                            setCardOptions(prev => ({ ...prev, themeType: type }));
                            pushPage('createCard_Themebook');
                        }} />
                     )}
                     {activePage === 'createCard_ThemeType' && currentGame === 'OTHERSCAPE' && (
                        <CreateCard_OtherscapeThemeTypePage onSelect={(type) => {
                            setCardOptions(prev => ({ ...prev, themeType: type }));
                            pushPage('createCard_Themebook');
                        }} />
                     )}
                     {activePage === 'createCard_Themebook' && (
                        <CreateCard_ThemebookPage
                           themeType={cardOptions.themeType!}
                           inputValue={inputValue}
                           currentGame={currentGame}
                           onSelect={(themebook) => {
                              setCardOptions(prev => ({ ...prev, themebook: themebook }));
                              pushPage('createCard_MainTag');
                              setInputValue('');
                           }}
                        />
                     )}
                     {activePage === 'createCard_MainTag' && (
                        <CreateCard_InputPage inputValue={inputValue} onSelect={() => {
                           setCardOptions(prev => ({ ...prev, mainTagName: inputValue }));
                           pushPage('createCard_PowerTags');
                           setInputValue('2');
                        }} />
                     )}
                     {activePage === 'createCard_PowerTags' && (
                        <CreateCard_NumberInputPage inputValue={inputValue} labelKey='actions.setPowerTags' onSelect={() => {
                           setCardOptions(prev => ({ ...prev, powerTagsCount: Number(inputValue) }));
                           pushPage('createCard_WeaknessTags');
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



                     {/* ================== */}
                     {/*  TRACKER CREATION */}
                     {/* ================== */}

                     {activePage === 'createTracker_Type' && (
                        <CreateTracker_TypePage onSelect={(type) => {
                           setTrackerType(type);
                           pushPage('createTracker_Name');
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
