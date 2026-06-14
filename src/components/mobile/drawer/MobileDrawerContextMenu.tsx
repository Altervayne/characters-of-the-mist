// -- React Imports --
import { useState, useRef, useLayoutEffect } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Component Imports --
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import MobileFolderPicker from '@/components/mobile/drawer/MobileFolderPicker';
import { MobileBottomSheet } from '@/components/mobile/shared/MobileBottomSheet';

// -- Icon Imports --
import {
	Edit3,
	FolderInput,
	Download,
	Trash2,
	PlusCircle
} from 'lucide-react';

// -- Store Imports --
import { useDrawerStore, useDrawerActions } from '@/lib/stores/drawerStore';
import { useCharacterStore } from '@/lib/stores/characterStore';

// -- Utils Imports --
import { findFolder, findAndRemoveItem } from '@/lib/utils/drawer';
import { deriveExportHandle, exportToFile, generateExportFilename } from '@/lib/utils/export-import';

// -- Type Imports --
import type { DrawerItem } from '@/lib/types/drawer';



interface MobileDrawerContextMenuProps {
	isOpen: boolean;
	onClose: () => void;
	target: { type: 'item' | 'folder'; id: string; name: string } | null;
	position?: { x: number; y: number } | null;
	onAddToCharacter?: (item: DrawerItem) => void;
}

/**
 * Reads the bottom safe-area inset (the home-indicator gutter) in CSS pixels.
 *
 * `env(safe-area-inset-bottom)` cannot be read directly from JavaScript, so this
 * applies it to a throwaway off-screen element's padding and reads back the
 * resolved computed length. Returns 0 on devices/browsers without an inset (or
 * when the document does not set `viewport-fit=cover`).
 *
 * @returns The bottom safe-area inset in pixels (0 when none applies).
 */
function readSafeAreaInsetBottom(): number {
	const probe = document.createElement('div');
	probe.style.position = 'absolute';
	probe.style.visibility = 'hidden';
	probe.style.paddingBottom = 'env(safe-area-inset-bottom)';
	document.body.appendChild(probe);
	const inset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
	document.body.removeChild(probe);
	return inset;
}

export default function MobileDrawerContextMenu({
	isOpen,
	onClose,
	target,
	position,
	onAddToCharacter
}: MobileDrawerContextMenuProps) {
	const { t } = useTranslation();
	const drawer = useDrawerStore((state) => state.drawer);
	const character = useCharacterStore((state) => state.character);
	const {
		renameFolder,
		renameItem,
		moveFolder,
		moveItem,
		deleteFolder,
		deleteItem
	} = useDrawerActions();

	const [showRenameDialog, setShowRenameDialog] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showFolderPicker, setShowFolderPicker] = useState(false);
	const [newName, setNewName] = useState('');

	// Finger-anchored menu position, clamped to the menu's real rendered rect.
	const menuRef = useRef<HTMLDivElement>(null);
	const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);

	// Measure the rendered menu and clamp it on-screen. The menu is min-w-55 with
	// variable height, so we read its actual rect rather than guessing a size.
	// Runs before paint so the menu never flashes at an unclamped position.
	useLayoutEffect(() => {
		if (!isOpen || !position || !menuRef.current) {
			return;
		}
		const rect = menuRef.current.getBoundingClientRect();
		const safeAreaBottom = readSafeAreaInsetBottom();
		const maxLeft = window.innerWidth - rect.width;
		const maxTop = window.innerHeight - rect.height - safeAreaBottom;
		const left = Math.max(0, Math.min(position.x, maxLeft));
		const top = Math.max(0, Math.min(position.y, maxTop));
		setMenuPosition({ left, top });
	}, [isOpen, position]);

	if (!target) return null;

	// Find the actual item or folder
	const isFolder = target.type === 'folder';
	const folder = isFolder ? findFolder(drawer.folders, target.id) : null;
	const item = !isFolder ? (drawer.rootItems.find(i => i.id === target.id) || findAndRemoveItem(drawer.folders, target.id).item) : null;

	const handleRename = () => {
		setNewName(target.name);
		setShowRenameDialog(true);
	};

	const confirmRename = () => {
		if (newName.trim()) {
			if (isFolder) {
				renameFolder(target.id, newName.trim());
				toast.success(t('Notifications.drawer.folderRenamed'));
			} else {
				renameItem(target.id, newName.trim());
				toast.success(t('Notifications.drawer.itemRenamed'));
			}
		}
		// Delay closing to allow exit animation
		setShowRenameDialog(false);
		setTimeout(onClose, 300);
	};

	const handleMove = () => {
		setShowFolderPicker(true);
	};

	const handleMoveConfirm = (destinationFolderId: string | null) => {
		if (isFolder) {
			// Prevent moving folder into itself or its children
			moveFolder(target.id, destinationFolderId ?? undefined);
			toast.success(t('Notifications.drawer.folderMoved'));
		} else {
			moveItem(target.id, destinationFolderId ?? undefined);
			toast.success(t('Notifications.drawer.itemMoved'));
		}
		setShowFolderPicker(false);
		onClose();
	};

	const handleExport = () => {
		try {
			if (isFolder && folder) {
				const fileName = generateExportFilename('NEUTRAL', 'FOLDER', folder.name);
				exportToFile(folder, 'FOLDER', 'NEUTRAL', fileName);
				toast.success(t('Notifications.drawer.folderExported'));
			} else if (item) {
				const { content, type, game, name } = item;
				const handle = deriveExportHandle(content, name);
				const fileName = generateExportFilename(game, type, handle);
				exportToFile(content, type, game, fileName);
				toast.success(t('Notifications.drawer.itemExported'));
			}
		} catch (error) {
			console.error('Export error:', error);
			toast.error(t('Notifications.general.exportError'));
		}
		onClose();
	};

	const handleDelete = () => {
		setShowDeleteConfirm(true);
	};

	const confirmDelete = () => {
		if (isFolder) {
			deleteFolder(target.id);
			toast.success(t('Notifications.drawer.folderDeleted'));
		} else {
			deleteItem(target.id);
			toast.success(t('Notifications.drawer.itemDeleted'));
		}
		// Delay closing to allow exit animation
		setShowDeleteConfirm(false);
		setTimeout(onClose, 300);
	};

	const handleAddToCharacter = () => {
		if (item && onAddToCharacter) {
			onAddToCharacter(item);
			onClose();
		}
	};

	// Can only add items to character if a character is loaded
	const canAddToCharacter = !isFolder && !!character && !!onAddToCharacter;

	// Position the menu at the clamped coordinates once measured; before the
	// layout effect runs, anchor at the raw finger position (size is unaffected
	// by position, so the pre-clamp measurement is still accurate).
	// The stacking level comes from the `layer-panel` class on the element; only
	// positioning is set inline here.
	const menuStyle: CSSProperties | undefined = position ? {
		position: 'fixed',
		left: `${menuPosition ? menuPosition.left : position.x}px`,
		top: `${menuPosition ? menuPosition.top : position.y}px`,
	} : undefined;

	if (!isOpen) return null;

	return (
		<>
         {/* Backdrop */}
         <div
            className="fixed inset-0 bg-black/20 layer-backdrop"
            onClick={onClose}
         />

         {/* Floating Context Menu */}
         <div
            ref={menuRef}
            style={menuStyle}
            className="bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-55 layer-panel"
         >
            <div className="p-2 border-b border-border bg-muted/50">
               <p className="text-sm font-medium truncate px-2">{target?.name}</p>
            </div>

            <div className="flex flex-col p-1">
               {/* Add to Character (items only, if character loaded) */}
               {canAddToCharacter && (
                  <Button
                     variant="ghost"
                     className="w-full justify-start cursor-pointer"
                     onClick={handleAddToCharacter}
                  >
                     <PlusCircle className="w-4 h-4 mr-3" />
                     {t('Drawer.Actions.addToCharacter')}
                  </Button>
               )}

               {/* Rename */}
               <Button
                  variant="ghost"
                  className="w-full justify-start cursor-pointer"
                  onClick={handleRename}
               >
                  <Edit3 className="w-4 h-4 mr-3" />
                  {t('Drawer.Actions.rename')}
               </Button>

               {/* Move to */}
               <Button
                  variant="ghost"
                  className="w-full justify-start cursor-pointer"
                  onClick={handleMove}
               >
                  <FolderInput className="w-4 h-4 mr-3" />
                  {t('Drawer.Actions.move')}
               </Button>

               {/* Export */}
               <Button
                  variant="ghost"
                  className="w-full justify-start cursor-pointer"
                  onClick={handleExport}
               >
                  <Download className="w-4 h-4 mr-3" />
                  {t('Drawer.Actions.export')}
               </Button>

               {/* Delete */}
               <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  onClick={handleDelete}
               >
                  <Trash2 className="w-4 h-4 mr-3" />
                  {t('Drawer.Actions.delete')}
               </Button>
            </div>
         </div>

         {/* Rename Bottom Sheet */}
         <MobileBottomSheet
            isOpen={showRenameDialog}
            onClose={() => {
               setShowRenameDialog(false);
               setTimeout(onClose, 300);
            }}
         >
                  <div className="p-4 pb-3 border-b border-border">
                     <h2 className="text-lg font-semibold">
                        {isFolder
                           ? t('Drawer.Actions.rename')
                           : t('Drawer.Actions.rename')}
                     </h2>
                  </div>

                  <div className="p-4 space-y-4">
                     <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={t('Drawer.namePlaceholder')}
                        onKeyDown={(e) => {
                           if (e.key === 'Enter') {
                              confirmRename();
                           }
                        }}
                        autoFocus
                        className="text-base"
                     />

                     <div className="flex gap-2 pb-safe">
                        <Button
                           variant="outline"
                           onClick={() => {
                              setShowRenameDialog(false);
                              setTimeout(onClose, 300);
                           }}
                           className="flex-1 cursor-pointer h-11"
                        >
                           {t('Drawer.Actions.cancel')}
                        </Button>
                        <Button
                           onClick={confirmRename}
                           disabled={!newName.trim()}
                           className="flex-1 cursor-pointer h-11"
                        >
                           {t('Drawer.Actions.confirm')}
                        </Button>
                     </div>
                  </div>
         </MobileBottomSheet>

         {/* Folder Picker for Move */}
         <MobileFolderPicker
            isOpen={showFolderPicker}
            onClose={() => {
               setShowFolderPicker(false);
               setTimeout(onClose, 300);
            }}
            onSelect={handleMoveConfirm}
            excludeFolderId={isFolder ? target.id : undefined}
         />

         {/* Delete Confirmation Bottom Sheet */}
         <MobileBottomSheet
            isOpen={showDeleteConfirm}
            onClose={() => {
               setShowDeleteConfirm(false);
               setTimeout(onClose, 300);
            }}
         >
                     <div className="p-4 pb-3 border-b border-border">
                        <h2 className="text-lg font-semibold">
                           {isFolder
                              ? t('Drawer.Actions.deleteFolderTitle')
                              : t('Drawer.Actions.deleteItemTitle')}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-2">
                           {isFolder
                              ? t('Drawer.Actions.deleteFolderMessage')
                              : t('Drawer.Actions.deleteItemMessage')}
                        </p>
                     </div>

                     <div className="p-4">
                        <div className="flex gap-2 pb-safe">
                           <Button
                              variant="outline"
                              onClick={() => {
                                 setShowDeleteConfirm(false);
                                 setTimeout(onClose, 300);
                              }}
                              className="flex-1 cursor-pointer h-11"
                           >
                              {t('Drawer.Actions.cancel')}
                           </Button>
                           <Button
                              onClick={confirmDelete}
                              variant="destructive"
                              className="flex-1 cursor-pointer h-11"
                           >
                              {t('Drawer.Actions.confirmDelete')}
                           </Button>
                        </div>
                     </div>
         </MobileBottomSheet>
		</>
	);
}
