import { APP_VERSION } from "./config";
import { compare } from 'semver';
import type { GeneralItemType, Drawer, DrawerItem, Folder } from './types/drawer';
import type { Character } from './types/character';



function isDrawer(data: unknown): data is Drawer {
  return !!data && typeof data === 'object' && 'rootItems' in data && 'folders' in data && !('content' in data);
}
function isFolder(data: unknown): data is Folder {
  return !!data && typeof data === 'object' && 'items' in data && 'folders' in data && !('rootItems' in data);
}
function isDrawerItem(data: unknown): data is DrawerItem {
  return !!data && typeof data === 'object' && 'content' in data && 'type' in data && 'id' in data;
}
function isCharacter(data: unknown): data is Character {
  return !!data && typeof data === 'object' && 'cards' in data && 'trackers' in data;
}
function isVersionable(data: unknown): data is { version?: string } {
    return !!data && typeof data === 'object' && 'version' in data;
}



type MigrationFunction = (data: unknown) => unknown;

const MIGRATIONS: Record<string, Partial<Record<GeneralItemType, MigrationFunction>>> = {
   '1.0.2': {
      FULL_CHARACTER_SHEET: (data: unknown): unknown => {
         if (isCharacter(data)) {
            if (data.trackers && !data.trackers.storyThemes) {
               data.trackers.storyThemes = [];
            }
         }
         return data;
      },
   },
};

const MIGRATION_VERSIONS = Object.keys(MIGRATIONS).sort(compare);



export function harmonizeData<T extends object>(data: T, dataType: GeneralItemType): T {
   if (!data || typeof data !== 'object') {
      return data;
   }

   let harmonizedData: unknown = data;

   // --- STEP 1: Harmonize the current object based on its specific type ---
   if (isVersionable(harmonizedData) || isCharacter(harmonizedData) || isDrawer(harmonizedData)) {
      let currentVersion = harmonizedData.version || '1.0.0';

      for (const targetVersion of MIGRATION_VERSIONS) {
         if (compare(targetVersion, currentVersion) > 0) {
            const versionMigrations = MIGRATIONS[targetVersion];
            const migrate = versionMigrations[dataType];

            if (migrate) {
               harmonizedData = migrate(data);
            }

            if (isVersionable(harmonizedData)) {
                harmonizedData.version = targetVersion;
            }
            currentVersion = targetVersion;
         }
      }

      if (!isVersionable(harmonizedData) || !harmonizedData.version || compare(APP_VERSION, harmonizedData.version) > 0) {
         if(isVersionable(harmonizedData)) {
            harmonizedData.version = APP_VERSION;
         }
      }
   }

   // --- STEP 2: Check for container properties and RECURSE ---
   if (isDrawer(harmonizedData)) {
      harmonizedData.rootItems = harmonizedData.rootItems.map(item => harmonizeData(item, item.type));
      harmonizedData.folders = harmonizedData.folders.map(folder => harmonizeData(folder, 'FOLDER'));
   } else if (isFolder(harmonizedData)) {
      harmonizedData.items = harmonizedData.items.map(item => harmonizeData(item, item.type));
      harmonizedData.folders = harmonizedData.folders.map(subFolder => harmonizeData(subFolder, 'FOLDER'));
   } else if (isDrawerItem(harmonizedData)) {
      harmonizedData.content = harmonizeData(harmonizedData.content, harmonizedData.type);
   }

   return harmonizedData as T;
}