// -- Other Library Imports --
import { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';



interface TourActions {
   setIsEditing: (isEditing: boolean) => void;
   setDrawerOpen: (isOpen: boolean) => void;
}



export const getTourSteps = (t: (key: string) => string, actions: TourActions): DriveStep[] => {
   const { setIsEditing, setDrawerOpen } = actions;

   return [
      {
         popover: {
            title: t('welcome_title'),
            description: t('welcome_content'),
         },
      },
      {
         element: '[data-tour="sidebar-menu"]',
         popover: {
            title: t('sidebar_title'),
            description: t('sidebar_content'),
            side: 'right',
         },
      },
      {
         element: '[data-tour="menu-collapse-button"]',
         popover: {
            title: t('menuCollapse_title'),
            description: t('menuCollapse_content'),
            side: 'right',
         },
      },
      {
         element: '[data-tour="menu-undo-redo-buttons"]',
         popover: {
            title: t('menuUndoRedo_title'),
            description: t('menuUndoRedo_content'),
            side: 'right',
         },
      },
      {
         element: '[data-tour="menu-edit-drawer-buttons"]',
         popover: {
            title: t('menuEditDrawer_title'),
            description: t('menuEditDrawer_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="save-character-button"]',
         popover: {
            title: t('saveCharacter_title'),
            description: t('saveCharacter_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="export-character-button"]',
         popover: {
            title: t('exportCharacter_title'),
            description: t('exportCharacter_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="import-character-button"]',
         popover: {
            title: t('importCharacter_title'),
            description: t('importCharacter_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="import-component-button"]',
         popover: {
            title: t('importComponent_title'),
            description: t('importComponent_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="reset-character-button"]',
         popover: {
            title: t('resetCharacter_title'),
            description: t('resetCharacter_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="unload-character-button"]',
         popover: {
            title: t('unloadCharacter_title'),
            description: t('unloadCharacter_content'),
            side: 'right',
            align: 'center',
         },
      },
      {
         element: '[data-tour="settings-button"]',
         popover: {
            title: t('settings_title'),
            description: t('settings_content'),
            side: 'right',
            align: 'end',
         },
      },
      {
         element: '[data-tour="app-info-button"]',
         popover: {
            title: t('appInfo_title'),
            description: t('appInfo_content'),
            side: 'right',
            align: 'end',
         },
      },
      {
         element: '[data-tour="patch-notes-button"]',
         popover: {
            title: t('patchNotes_title'),
            description: t('patchNotes_content'),
            side: 'right',
            align: 'end',
         },
      },
      {
         element: '[data-tour="character-sheet"]',
         popover: {
            title: t('playArea_title'),
            description: t('playArea_content'),
         },
      },
      {
         element: '[data-tour="character-name-input"]',
         popover: {
            title: t('characterName_title'),
            description: t('characterName_content'),
            side: 'bottom',
         },
      },
      {
         element: '[data-tour="trackers-section"]',
         popover: {
            title: t('trackers_title'),
            description: t('trackers_content'),
            side: 'bottom',
            align: 'center',
         },
      },
      {
         element: '[data-tour="cards-section"]',
         popover: {
            title: t('cards_title'),
            description: t('cards_content'),
            side: 'top',
            align: 'center',
         },
      },
      {
         element: '[data-tour="edit-mode-toggle"]',
         popover: {
            title: t('editMode_title'),
            description: t('editMode_content'),
            side: 'right',
            onNextClick: (element, step, { driver }) => {
               setIsEditing(true);
               driver.moveNext();
            },
         },
      },
      {
         element: '[data-tour="edit-mode-toggle"]',
         popover: {
            title: t('playMode_title'),
            description: t('playMode_content'),
            side: 'right',
            onPrevClick: (element, step, { driver }) => {
               setIsEditing(false);
               driver.movePrevious();
            },
         },
      },
      {
         element: '[data-tour="add-status-button"]',
         popover: {
            title: t('addStatus_title'),
            description: t('addStatus_content'),
            side: 'bottom',
            align: 'center',
         },
      },
      {
         element: '[data-tour="add-story-tag-button"]',
         popover: {
            title: t('addStoryTag_title'),
            description: t('addStoryTag_content'),
            side: 'bottom',
            align: 'center',
         },
      },
      {
         element: '[data-tour="add-card-button"]',
         popover: {
            title: t('addCard_title'),
            description: t('addCard_content'),
            side: 'left',
            align: 'center',
            onNextClick: (element, step, { driver }) => {
               setDrawerOpen(true);
               driver.moveNext();
            },
         },
      },
      {
         element: '[data-tour="drawer-toggle"]',
         popover: {
            title: t('menuDrawer_title'),
            description: t('menuDrawer_content'),
            side: 'right',
            onPrevClick: (element, step, { driver }) => {
               setDrawerOpen(false);
               driver.movePrevious();
            },
            onNextClick: (element, step, { driver }) => {
               setIsEditing(false);
               setDrawerOpen(true);
               driver.moveNext();
            },
         },
      },
      {
         element: '[data-tour="drawer"]',
         popover: {
            title: t('drawer_title'),
            description: t('drawer_content'),
            side: 'left',
            align: 'center',
            onPrevClick: (element, step, { driver }) => {
               setIsEditing(true);
               driver.movePrevious();
            },
         },
      },
      {
         element: '[data-tour="drawer-undo-redo-buttons"]',
         popover: {
            title: t('drawerUndoRedo_title'),
            description: t('drawerUndoRedo_content'),
            side: 'left',
         },
      },
      {
         element: '[data-tour="drawer-rich-view-toggle"]',
         popover: {
            title: t('drawerRichView_title'),
            description: t('drawerRichView_content'),
            side: 'left',
         },
      },
      {
         element: '[data-tour="drawer-folders"]',
         popover: {
            title: t('drawerFolders_title'),
            description: t('drawerFolders_content'),
            side: 'left',
            align: 'center',
         },
      },
      {
         element: '[data-tour="drawer-items"]',
         popover: {
            title: t('drawerItems_title'),
            description: t('drawerItems_content'),
            side: 'left',
            align: 'center',
         },
      },
      {
         element: '[data-tour="drawer-import"]',
         popover: {
            title: t('drawerImport_title'),
            description: t('drawerImport_content'),
            side: 'left',
            align: 'end',
         },
      },
      {
         element: '[data-tour="drawer-export"]',
         popover: {
            title: t('drawerExport_title'),
            description: t('drawerExport_content'),
            side: 'left',
            align: 'end',
         },
      },
      {
         popover: {
            title: t('commandPalette_title'),
            description: t('commandPalette_content'),
         },
      },
      {
         popover: {
            title: t('closingWords_title'),
            description: t('closingWords_content'),
         },
      },
   ];
};