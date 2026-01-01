// -- Other Library Imports --
import type { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';



interface TourActions {
   setIsEditing: (isEditing: boolean) => void;
   setDrawerOpen: (isOpen: boolean) => void;
   setContextualGame: (game: 'LEGENDS' | 'CITY_OF_MIST' | 'OTHERSCAPE' | 'NEUTRAL') => void;
   createCharacter: (game: 'LEGENDS' | 'CITY_OF_MIST' | 'OTHERSCAPE' | 'NEUTRAL') => void;
}



export const getTourSteps = (t: (key: string) => string, actions: TourActions): DriveStep[] => {
   const { setIsEditing, setDrawerOpen, setContextualGame, createCharacter } = actions;

   return [
      {
         popover: {
            title: t('Tutorial.welcome_title'),
            description: t('Tutorial.welcome_content'),
         },
      },
      {
         element: '[data-tour="main-menu-game-selection"]',
         popover: {
            title: t('Tutorial.mainMenuGames_title'),
            description: t('Tutorial.mainMenuGames_content'),
            side: 'bottom',
         },
      },
      {
         element: '[data-tour="main-menu-legends-card"]',
         popover: {
            title: t('Tutorial.mainMenuLegends_title'),
            description: t('Tutorial.mainMenuLegends_content'),
            side: 'bottom',
            onNextClick: (_element, _step, { driver }) => {
               setContextualGame('LEGENDS');
               driver.moveNext();
            },
         },
      },
      {
         element: '[data-tour="main-menu-create-button"]',
         popover: {
            title: t('Tutorial.mainMenuCreate_title'),
            description: t('Tutorial.mainMenuCreate_content'),
            side: 'bottom',
            onNextClick: (_element, _step, { driver }) => {
               createCharacter('LEGENDS');
               driver.moveNext();
            },
         },
      },
      {
         element: '[data-tour="sidebar-menu"]',
         popover: {
            title: t('Tutorial.sidebar_title'),
            description: t('Tutorial.sidebar_content'),
            side: 'right',
         },
      },
      {
         element: '[data-tour="menu-collapse-button"]',
         popover: {
            title: t('Tutorial.menuCollapse_title'),
            description: t('Tutorial.menuCollapse_content'),
            side: 'right',
         },
      },
      {
         element: '[data-tour="menu-undo-redo-buttons"]',
         popover: {
            title: t('Tutorial.menuUndoRedo_title'),
            description: t('Tutorial.menuUndoRedo_content'),
            side: 'right',
         },
      },
      {
         element: '[data-tour="menu-edit-drawer-buttons"]',
         popover: {
            title: t('Tutorial.menuEditDrawer_title'),
            description: t('Tutorial.menuEditDrawer_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="save-character-button"]',
         popover: {
            title: t('Tutorial.saveCharacter_title'),
            description: t('Tutorial.saveCharacter_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="export-character-button"]',
         popover: {
            title: t('Tutorial.exportCharacter_title'),
            description: t('Tutorial.exportCharacter_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="import-character-button"]',
         popover: {
            title: t('Tutorial.importCharacter_title'),
            description: t('Tutorial.importCharacter_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="import-component-button"]',
         popover: {
            title: t('Tutorial.importComponent_title'),
            description: t('Tutorial.importComponent_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="reset-character-button"]',
         popover: {
            title: t('Tutorial.resetCharacter_title'),
            description: t('Tutorial.resetCharacter_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="unload-character-button"]',
         popover: {
            title: t('Tutorial.unloadCharacter_title'),
            description: t('Tutorial.unloadCharacter_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="settings-button"]',
         popover: {
            title: t('Tutorial.settings_title'),
            description: t('Tutorial.settings_content'),
            side: 'right',
            align: 'end',
         },
      },
      {
         element: '[data-tour="app-info-button"]',
         popover: {
            title: t('Tutorial.appInfo_title'),
            description: t('Tutorial.appInfo_content'),
            side: 'right',
            align: 'end',
         },
      },
      {
         element: '[data-tour="patch-notes-button"]',
         popover: {
            title: t('Tutorial.patchNotes_title'),
            description: t('Tutorial.patchNotes_content'),
            side: 'right',
            align: 'end',
         },
      },
      {
         element: '[data-tour="character-sheet"]',
         popover: {
            title: t('Tutorial.playArea_title'),
            description: t('Tutorial.playArea_content'),
         },
      },
      {
         element: '[data-tour="character-name-input"]',
         popover: {
            title: t('Tutorial.characterName_title'),
            description: t('Tutorial.characterName_content'),
            side: 'bottom',
         },
      },
      {
         element: '[data-tour="trackers-section"]',
         popover: {
            title: t('Tutorial.trackers_title'),
            description: t('Tutorial.trackers_content'),
            side: 'bottom',
            align: 'center',
         },
      },
      {
         element: '[data-tour="cards-section"]',
         popover: {
            title: t('Tutorial.cards_title'),
            description: t('Tutorial.cards_content'),
            side: 'top',
            align: 'center',
         },
      },
      {
         element: '[data-tour="edit-mode-toggle"]',
         popover: {
            title: t('Tutorial.editMode_title'),
            description: t('Tutorial.editMode_content'),
            side: 'right',
            onNextClick: (_element, _step, { driver }) => {
               setIsEditing(true);
               driver.moveNext();
            },
         },
      },
      {
         element: '[data-tour="edit-mode-toggle"]',
         popover: {
            title: t('Tutorial.playMode_title'),
            description: t('Tutorial.playMode_content'),
            side: 'right',
            onPrevClick: (_element, _step, { driver }) => {
               setIsEditing(false);
               driver.movePrevious();
            },
         },
      },
      {
         element: '[data-tour="add-status-button"]',
         popover: {
            title: t('Tutorial.addStatus_title'),
            description: t('Tutorial.addStatus_content'),
            side: 'bottom',
            align: 'center',
         },
      },
      {
         element: '[data-tour="add-story-tag-button"]',
         popover: {
            title: t('Tutorial.addStoryTag_title'),
            description: t('Tutorial.addStoryTag_content'),
            side: 'bottom',
            align: 'center',
         },
      },
      {
         element: '[data-tour="add-card-button"]',
         popover: {
            title: t('Tutorial.addCard_title'),
            description: t('Tutorial.addCard_content'),
            side: 'left',
            align: 'center',
            onNextClick: (_element, _step, { driver }) => {
               setDrawerOpen(true);
               driver.moveNext();
            },
         },
      },
      {
         element: '[data-tour="drawer-toggle"]',
         popover: {
            title: t('Tutorial.menuDrawer_title'),
            description: t('Tutorial.menuDrawer_content'),
            side: 'right',
            onPrevClick: (_element, _step, { driver }) => {
               setDrawerOpen(false);
               driver.movePrevious();
            },
            onNextClick: (_element, _step, { driver }) => {
               setIsEditing(false);
               setDrawerOpen(true);
               driver.moveNext();
            },
         },
      },
      {
         element: '[data-tour="drawer"]',
         popover: {
            title: t('Tutorial.drawer_title'),
            description: t('Tutorial.drawer_content'),
            side: 'left',
            align: 'center',
            onPrevClick: (_element, _step, { driver }) => {
               setIsEditing(true);
               driver.movePrevious();
            },
         },
      },
      {
         element: '[data-tour="drawer-undo-redo-buttons"]',
         popover: {
            title: t('Tutorial.drawerUndoRedo_title'),
            description: t('Tutorial.drawerUndoRedo_content'),
            side: 'left',
         },
      },
      {
         element: '[data-tour="drawer-rich-view-toggle"]',
         popover: {
            title: t('Tutorial.drawerRichView_title'),
            description: t('Tutorial.drawerRichView_content'),
            side: 'left',
         },
      },
      {
         element: '[data-tour="drawer-folders"]',
         popover: {
            title: t('Tutorial.drawerFolders_title'),
            description: t('Tutorial.drawerFolders_content'),
            side: 'left',
            align: 'center',
         },
      },
      {
         element: '[data-tour="drawer-items"]',
         popover: {
            title: t('Tutorial.drawerItems_title'),
            description: t('Tutorial.drawerItems_content'),
            side: 'left',
            align: 'center',
         },
      },
      {
         element: '[data-tour="drawer-import"]',
         popover: {
            title: t('Tutorial.drawerImport_title'),
            description: t('Tutorial.drawerImport_content'),
            side: 'left',
            align: 'end',
         },
      },
      {
         element: '[data-tour="drawer-export"]',
         popover: {
            title: t('Tutorial.drawerExport_title'),
            description: t('Tutorial.drawerExport_content'),
            side: 'left',
            align: 'end',
         },
      },
      {
         popover: {
            title: t('Tutorial.commandPalette_title'),
            description: t('Tutorial.commandPalette_content'),
         },
      },
      {
         popover: {
            title: t('Tutorial.closingWords_title'),
            description: t('Tutorial.closingWords_content'),
         },
      },
   ];
};