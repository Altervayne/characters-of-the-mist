'use client';

// -- React Imports --
import React, { useEffect, useRef, useState } from 'react';

// -- Next Imports --
import { useTranslations } from 'next-intl';

// -- Other Library Imports --
import { Command } from 'cmdk';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import toast from 'react-hot-toast';

// -- Icon Imports --
import { CheckSquare, CornerDownLeft, Crown, FileText, Leaf, ListTodo, Palette, Swords, Users } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { legendsThemebooks, legendsThemeTypes } from '@/lib/data/legends-data';

// -- Store and Hook Imports --
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useCharacterActions } from '@/lib/stores/characterStore';
import { ThemeName, useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { CommandAction } from '@/hooks/useCommandPaletteActions';

// -- Type Imports --
import { CreateCardOptions, LegendsThemeTypes } from '@/lib/types/creation';



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
   const t = useTranslations('CommandPalette');
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
   const t = useTranslations('CommandPalette');
   const { setTheme } = useAppSettingsActions();
   const { setCommandPaletteOpen } = useAppGeneralStateActions();
   
   const availableThemes: ThemeName[] = ['theme-neutral', 'theme-legends'];

   const handleSelect = (theme: ThemeName) => {
      setTheme(theme);
      setCommandPaletteOpen(false);
   };

   return (
      <Command.Group heading={t('groups.themePalette')}>
         {availableThemes.map((theme) => (
            <Command.Item
               key={theme}
               onSelect={() => handleSelect(theme)}
               value={t(`themes.${theme}`)}
               className={commonItemClass}
            >
               <Palette className="mr-2 h-4 w-4" />
               <span>{t(`themes.${theme}`)}</span>
            </Command.Item>
         ))}
      </Command.Group>
   );
};



// ###### CREATE CARD ######
// --- Step 1: Choose Type ---
interface CreateCard_TypePageProps {
   onSelect: (type: 'CHARACTER_THEME' | 'GROUP_THEME') => void;
}
const CreateCard_TypePage = ({ onSelect }: CreateCard_TypePageProps) => {
   const t = useTranslations('CommandPalette');
   return (
      <Command.Group heading={t('groups.creation')}>
         <Command.Item value={t('commands.cardTypeCharacter')} onSelect={() => onSelect('CHARACTER_THEME')} className={commonItemClass}>
            <FileText className="mr-2 h-4 w-4" />{t('commands.cardTypeCharacter')}
         </Command.Item>
         <Command.Item value={t('commands.cardTypeFellowship')} onSelect={() => onSelect('GROUP_THEME')} className={commonItemClass}>
            <Users className="mr-2 h-4 w-4" />{t('commands.cardTypeFellowship')}
         </Command.Item>
      </Command.Group>
   );
};

// --- Step 2: Input Text ---
interface CreateCard_ThemeTypePageProps { onSelect: (type: LegendsThemeTypes) => void; }
const CreateCard_ThemeTypePage = ({ onSelect }: CreateCard_ThemeTypePageProps) => {
      const t = useTranslations('CommandPalette');
      const tTypes = useTranslations('ThemeTypes');
      const themeTypeIcons: { [key in LegendsThemeTypes]: React.ElementType } = { Origin: Leaf, Adventure: Swords, Greatness: Crown };
      return (
         <Command.Group heading={t('groups.chooseThemeType')}>
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

// --- Step 3: Choose Themebook ---
interface CreateCard_ThemebookPageProps {
    themeType: LegendsThemeTypes;
    inputValue: string;
    onSelect: (themebook: string) => void;
}
const CreateCard_ThemebookPage = ({ themeType, inputValue, onSelect }: CreateCard_ThemebookPageProps) => {
   const t = useTranslations('CommandPalette');
   const tData = useTranslations();
   const availableThemebooks = legendsThemebooks[themeType] || [];
   const text = t('actions.createWith', { name: inputValue || '...' });

   return (
      <Command.Group heading={t('groups.chooseThemebook')}>
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
   const t = useTranslations('CommandPalette');
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
   const t = useTranslations('CommandPalette');
   const text = t(labelKey, { count: inputValue || '0' });
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
   const t = useTranslations('CommandPalette');
   return (
      <Command.Group heading={t('groups.creation')}>
         <Command.Item value={t('commands.trackerTypeStatus')} onSelect={() => onSelect('STATUS')} className={commonItemClass}>
            <CheckSquare className="mr-2 h-4 w-4" />{t('commands.trackerTypeStatus')}
         </Command.Item>
         <Command.Item value={t('commands.trackerTypeStoryTag')} onSelect={() => onSelect('STORY_TAG')} className={commonItemClass}>
            <ListTodo className="mr-2 h-4 w-4" />{t('commands.trackerTypeStoryTag')}
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
   const t = useTranslations('CommandPalette');
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

type PlaceholderKey = `placeholder_${
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 
  | 21 | 22 | 23 | 24 | 25
}`;

interface CommandPaletteProps {
   commands: CommandAction[];
};

const commandVariants: Variants = {
   hidden: { opacity: 0, y: -30, scale: 0.95 },
   visible: { opacity: 1, y: 0, scale: 1 },
};



export function CommandPalette({ commands }: CommandPaletteProps) {
   const t = useTranslations('CommandPalette');
   const tNotify = useTranslations('Notifications');
   const { addCard, addStatus, addStoryTag } = useCharacterActions();
   const isOpen = useAppGeneralStateStore((state) => state.isCommandPaletteOpen);
   const { setCommandPaletteOpen, toggleCommandPalette } = useAppGeneralStateActions();

   const [inputValue, setInputValue] = useState('');
   const [cardOptions, setCardOptions] = useState<Partial<CreateCardOptions>>({});
   const [trackerType, setTrackerType] = useState<'STATUS' | 'STORY_TAG' | null>(null);
   const [placeholder, setPlaceholder] = useState(t('placeholder_1'));
   
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
         setPages(['root']);
         setInputValue('');
         setCardOptions({});
      }
   }, [isOpen]);



   // --- Placeholder randomizer ---
   useEffect(() => {
      if (isOpen) {
         let newPlaceholder = '';
         switch(activePage) {
            case 'renameCharacter': newPlaceholder = t('placeholders.renameCharacter'); break;

            case 'createCard_ThemeType': newPlaceholder = t('placeholders.themeType'); break;
            case 'createCard_Themebook': newPlaceholder = t('placeholders.themebook'); break;
            case 'createCard_MainTag': newPlaceholder = t('placeholders.mainTagName'); break;
            case 'createCard_PowerTags': newPlaceholder = t('placeholders.powerTags'); break;
            case 'createCard_WeaknessTags': newPlaceholder = t('placeholders.weaknessTags'); break;

            case 'createTracker_Type': newPlaceholder = t('placeholders.trackerType'); break;
            case 'createTracker_Name': newPlaceholder = t('placeholders.trackerName'); break;
            
            default:
               const randomIndex = Math.floor(Math.random() * 25) + 1;
               newPlaceholder = t(`placeholder_${randomIndex}` as PlaceholderKey);
         }
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
                     '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
                     '[&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5',
                     '[&_[cmdk-input]]:h-12',
                     '[&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3',
                     '[&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5'
                  )}
               >
                  <Command.Input 
                     ref={inputRef}
                     value={inputValue}
                     onValueChange={setInputValue}
                     placeholder={activePage === 'renameCharacter' ? t('placeholders.renameCharacter') : placeholder}
                     className={cn(
                        "h-12 w-full border-b bg-transparent pl-4 pr-4 text-foreground",
                        "placeholder:text-muted-foreground",
                        "focus:outline-none",
                        "disabled:cursor-not-allowed disabled:opacity-50"
                     )}
                  />
                  <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2 bg-card rounded-b-lg">
                     <Command.Empty className="py-6 text-center text-sm">{t('empty')}</Command.Empty>
                     {activePage === 'root' && (<RootPage commandGroups={commandGroups} onSelectCommand={onSelectCommand} />)}
                     {activePage === 'renameCharacter' && (<RenameCharacterPage inputValue={inputValue} />)}
                     {activePage === 'setThemePalette' && (<SetThemePalettePage />)}
                     


                     {/* ------------- */}
                     {/* CARD CREATION */}
                     {/* ------------- */}

                     {activePage === 'createCard_Type' && (
                        <CreateCard_TypePage onSelect={(type) => {
                           setCardOptions({ cardType: type });
                           setPages(p => [...p, type === 'CHARACTER_THEME' ? 'createCard_ThemeType' : 'createCard_MainTag']);
                        }} />
                     )}
                     {activePage === 'createCard_ThemeType' && (
                        <CreateCard_ThemeTypePage onSelect={(type) => {
                            setCardOptions(prev => ({ ...prev, themeType: type }));
                            setPages(p => [...p, 'createCard_Themebook']);
                        }} />
                     )}
                     {activePage === 'createCard_Themebook' && (
                        <CreateCard_ThemebookPage themeType={cardOptions.themeType!} inputValue={inputValue} onSelect={(themebook) => {
                           setCardOptions(prev => ({ ...prev, themebook: themebook }));
                           setPages(p => [...p, 'createCard_MainTag']);
                           setInputValue('');
                        }} />
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
                           toast.success(tNotify('card.created'));
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
                           toast.success(tNotify('tracker.created'));
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