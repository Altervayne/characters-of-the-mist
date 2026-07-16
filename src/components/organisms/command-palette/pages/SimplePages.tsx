// -- React Imports --
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { Command } from 'cmdk';
import toast from 'react-hot-toast';

// -- Icon Imports --
import { CornerDownLeft, Palette, Dices, NotebookText, ListTree, GraduationCap } from 'lucide-react';

// -- Hook Imports --
import { useDeviceType } from '@/hooks/useDeviceType';

// -- Tutorial Imports --
import { getTutorialsForPlatform } from '@/lib/tutorial/definitions';

// -- Store Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useActiveNoteInstance } from '@/lib/notes/ActiveNoteStoreContext';

// -- Data Imports --
import { listSavedNotes } from '@/lib/drawer/drawerRepository';
import { extractHeadings } from '@/lib/notes/noteOutline';

// -- Theme Imports --
import { customThemeClass } from '@/lib/theme/themeTokens';
import { parseDiceCommand } from '@/lib/dice/diceCommand';

// -- Constants --
import { GAME_VISUALS, GAME_CARD_OPTIONS } from '@/lib/constants/gameVisuals';

// -- Local Imports --
import { commonItemClass } from '../constants';

// -- Type Imports --
import type { ThemeName } from '@/lib/stores/appSettingsStore';
import type { GameSystem } from '@/lib/types/drawer';
import type { SavedNoteRef } from '@/lib/drawer/drawerRepository';
import type { NoteHeading } from '@/lib/notes/noteOutline';



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
   const customThemes = useAppSettingsStore((state) => state.customThemes);

   const presetThemes: ThemeName[] = ['theme-neutral', 'theme-legends', 'theme-otherscape', 'theme-city-of-mist'];

   const handleSelect = (theme: string) => {
      setTheme(theme as ThemeName);
      setCommandPaletteOpen(false);
   };

   return (
      <>
         <Command.Group heading={t('SettingsDialog.themes.presetsHeading')}>
            {presetThemes.map((theme) => (
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

         {/* Custom themes: applied by their class, labeled by the user's name (not an i18n key). */}
         {customThemes.length > 0 && (
            <Command.Group heading={t('SettingsDialog.themes.customsHeading')}>
               {customThemes.map((custom) => (
                  <Command.Item
                     key={custom.id}
                     onSelect={() => handleSelect(customThemeClass(custom.id))}
                     value={custom.name}
                     className={commonItemClass}
                  >
                     <Palette className="mr-2 h-4 w-4" />
                     <span>{custom.name}</span>
                  </Command.Item>
               ))}
            </Command.Group>
         )}
      </>
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



// ####################
// ###   EMBED NOTE  ###
// ####################
interface EmbedNote_PickPageProps {
   onSelect: (note: SavedNoteRef) => void;
};

/**
 * Lists every saved note (drawer `NOTE` items) so a GM can embed one on the board as a live reference tile.
 * The list loads async from the drawer; the palette's own filter narrows it by title as the GM types (the
 * note id rides the value so untitled notes never collide). Selecting a note hands its ref to the board.
 */
export const EmbedNote_PickPage = ({ onSelect }: EmbedNote_PickPageProps) => {
   const { t } = useTranslation();
   const [notes, setNotes] = useState<SavedNoteRef[]>([]);

   useEffect(() => {
      let alive = true;
      void listSavedNotes().then((list) => { if (alive) setNotes(list); });
      return () => { alive = false; };
   }, []);

   return (
      <Command.Group heading={t('CommandPalette.commands.embedNote')}>
         {notes.map((note) => {
            const label = note.title.trim() || t('Tabs.untitled');
            return (
               <Command.Item
                  key={note.drawerItemId}
                  value={`${label} ${note.noteId}`}
                  onSelect={() => onSelect(note)}
                  className={commonItemClass}
               >
                  <NotebookText className="mr-2 h-4 w-4" />
                  <span>{label}</span>
               </Command.Item>
            );
         })}
      </Command.Group>
   );
};

interface JumpToSection_PickPageProps {
   onSelect: (heading: NoteHeading) => void;
}

/**
 * Lists the ACTIVE note's headings (via the shared `extractHeadings`) as jump targets, indented by level. The
 * palette filter narrows by title; the slug rides the value so repeated titles never collide. Selecting one
 * jumps the note surface to that section (the surface routes Live/Source scroll vs Reading `#slug`).
 */
export const JumpToSection_PickPage = ({ onSelect }: JumpToSection_PickPageProps) => {
   const { t } = useTranslation();
   const store = useActiveNoteInstance();
   const headings = useMemo(() => extractHeadings(store?.getState().note?.body ?? ''), [store]);

   if (headings.length === 0) {
      return <div className="px-2 py-6 text-center text-sm text-muted-foreground">{t('CommandPalette.jumpToSection.empty')}</div>;
   }

   return (
      <Command.Group heading={t('CommandPalette.commands.jumpToSection')}>
         {headings.map((heading, index) => (
            <Command.Item
               key={`${heading.slug}-${index}`}
               value={`${heading.text} ${heading.slug}`}
               onSelect={() => onSelect(heading)}
               className={commonItemClass}
            >
               <ListTree className="mr-2 h-4 w-4 shrink-0" />
               <span style={{ paddingLeft: `${(heading.level - 1) * 0.75}rem` }} className="truncate">{heading.text}</span>
            </Command.Item>
         ))}
      </Command.Group>
   );
};



// ########################
// ###   START TUTORIAL  ###
// ########################
interface StartTutorial_PickPageProps {
   onSelect: (id: string) => void;
};

/**
 * Lists the current platform's tutorials as a jump-to picker (a shortcut past the Learn list). The palette
 * filter narrows by name; selecting one starts it from step 1. The `dev.` scenarios show only in dev.
 */
export const StartTutorial_PickPage = ({ onSelect }: StartTutorial_PickPageProps) => {
   const { t } = useTranslation();
   const { deviceType } = useDeviceType();
   const tutorials = getTutorialsForPlatform(deviceType);

   return (
      <Command.Group heading={t('CommandPalette.startTutorial.title')}>
         {tutorials.map((definition) => {
            const Glyph = definition.icon ?? GraduationCap;
            return (
               <Command.Item
                  key={definition.id}
                  value={t(definition.titleKey)}
                  onSelect={() => onSelect(definition.id)}
                  className={commonItemClass}
               >
                  <Glyph className="mr-2 h-4 w-4" />
                  <span>{t(definition.titleKey)}</span>
               </Command.Item>
            );
         })}
      </Command.Group>
   );
};



// ####################
// ###   ROLL DICE  ###
// ####################
interface RollDicePageProps {
   inputValue: string;
};

export const RollDicePage = ({ inputValue }: RollDicePageProps) => {
   const { t } = useTranslation();
   const content = useAppSettingsStore((state) => state.diceTray.content);
   const { startDiceTrayRoll } = useAppSettingsActions();
   const { setCommandPaletteOpen } = useAppGeneralStateActions();
   const text = t('CommandPalette.actions.rollFormula', { formula: inputValue || '...' });

   // A formula is a full setup: it REPLACES the tray's dice + modifiers, keeps its history + title, then the
   // app tray rolls it with its own animation. A bad parse stays on the page (a toast, never a half-set tray).
   const handleSelect = () => {
      const result = parseDiceCommand(inputValue);
      if ('error' in result) {
         toast.error(t('BoardView.diceCommandError'));
         return;
      }
      startDiceTrayRoll({ ...content, dice: result.dice, modifiers: result.modifiers });
      setCommandPaletteOpen(false);
   };

   return (
      <Command.Item onSelect={handleSelect} value={text} className={commonItemClass}>
         <Dices className="mr-2 h-4 w-4" />
         <span>{text}</span>
      </Command.Item>
   );
};
