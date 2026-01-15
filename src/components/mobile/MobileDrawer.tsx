// Mobile Drawer Component
// Main drawer interface for mobile with folder navigation and item management

// -- React Imports --
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Component Imports --
import MobileBreadcrumbs from './MobileBreadcrumbs';
import MobileFolderItem from './MobileFolderItem';
import MobileDrawerItem from './MobileDrawerItem';
import MobileDrawerContextMenu from './MobileDrawerContextMenu';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { FolderPlus, List, Grid3x3, Download } from 'lucide-react';

// -- Store Imports --
import { useDrawerStore, useDrawerActions } from '@/lib/stores/drawerStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Utils Imports --
import { findFolder } from '@/lib/utils/drawer';
import { importFromFile } from '@/lib/utils/export-import';
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { DrawerItem, DrawerItemContent } from '@/lib/types/drawer';



interface MobileDrawerProps {
	onAddToCharacter?: (item: DrawerItem) => void;
}

export default function MobileDrawer({ onAddToCharacter }: MobileDrawerProps) {
	const { t } = useTranslation();

	// Drawer state
	const drawer = useDrawerStore((state) => state.drawer);
	const { addFolder, addImportedItem, addImportedFolder, importFullDrawer } = useDrawerActions();

	// UI state
	const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
	const [isCompactView, setIsCompactView] = useState(true);
	const [showContextMenu, setShowContextMenu] = useState(false);
	const [contextMenuTarget, setContextMenuTarget] = useState<{
      type: 'item' | 'folder';
		id: string;
		name: string;
	} | null>(null);
	const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

   // Mobile Handedness
   const mobileHandedness = useAppSettingsStore((state) => state.mobileHandedness);
   const isLeftHanded = (mobileHandedness === 'left')

	// File import ref
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Get current folder contents
	const currentFolder = currentFolderId ? findFolder(drawer.folders, currentFolderId) : null;
	const folders = currentFolder?.folders ?? drawer.folders;
	const items = currentFolder?.items ?? drawer.rootItems;

	// Handlers
	const handleNavigate = (folderId: string | null) => {
		setCurrentFolderId(folderId);
	};

	const handleFolderLongPress = (folderId: string, folderName: string, position: { x: number; y: number }) => {
		setContextMenuTarget({ type: 'folder', id: folderId, name: folderName });
		setContextMenuPosition(position);
		setShowContextMenu(true);
	};

	const handleItemLongPress = (itemId: string, itemName: string, position: { x: number; y: number }) => {
		setContextMenuTarget({ type: 'item', id: itemId, name: itemName });
		setContextMenuPosition(position);
		setShowContextMenu(true);
	};

	const handleAddFolder = () => {
		// Prompt for folder name
		const folderName = prompt(t('Drawer.addFolder.prompt'));
		if (folderName && folderName.trim()) {
			addFolder(folderName.trim(), currentFolderId ?? undefined);
			toast.success(t('Notifications.folder.created'));
		}
	};

	const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		try {
			const file = files[0];
			const importedData = await importFromFile(file);

			// Route based on fileType
			switch (importedData.fileType) {
				case 'FULL_DRAWER':
					importFullDrawer(importedData.content as import('@/lib/types/drawer').Drawer, currentFolderId ?? undefined);
					toast.success(t('Notifications.drawer.imported'));
					break;

				case 'FOLDER':
					addImportedFolder(importedData.content as import('@/lib/types/drawer').Folder, currentFolderId ?? undefined);
					toast.success(t('Notifications.folder.imported'));
					break;

				default:
					// Individual item (card or tracker)
					addImportedItem(
						importedData.content as DrawerItemContent,
						importedData.fileType,
						importedData.game,
						currentFolderId ?? undefined
					);
					toast.success(t('Notifications.general.imported'));
					break;
			}

			// Reset file input
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		} catch (error) {
			console.error('Import error:', error);
			toast.error(t('Notifications.general.importError'));
		}
	};

	const hasContent = folders.length > 0 || items.length > 0;

	return (
		<div className="h-full flex flex-col bg-background">
			{/* Content */}
			<div className="flex-1 overflow-y-auto p-4 space-y-2">
				{!hasContent && (
					<div className="h-full flex items-center justify-center text-center p-8">
						<div>
							<p className="text-muted-foreground mb-4">
								{currentFolderId
									? t('Drawer.emptyFolder')
									: t('Drawer.emptyDrawer')}
							</p>
						</div>
					</div>
				)}

				{/* Folders */}
				{folders.map((folder) => (
					<MobileFolderItem
						key={folder.id}
						folder={folder}
						onNavigate={handleNavigate}
						onLongPress={handleFolderLongPress}
					/>
				))}

				{/* Separator if both folders and items exist */}
				{folders.length > 0 && items.length > 0 && (
					<div className="border-t border-border my-4" />
				)}

				{/* Items */}
				{items.map((item) => (
					<MobileDrawerItem
						key={item.id}
						item={item}
						isCompact={isCompactView}
						onLongPress={handleItemLongPress}
					/>
				))}
			</div>

			{/* Breadcrumbs navigation at bottom */}
			<div className="border-t border-border">
            <MobileBreadcrumbs
               folders={drawer.folders}
               currentFolderId={currentFolderId}
               onNavigate={handleNavigate}
			   />
         </div>

			{/* Toolbar at bottom for thumb accessibility */}
			<div
				className={cn(
					"flex items-center justify-between px-4 py-4 border-t border-border bg-card safe-area-inset-bottom",
					isLeftHanded ? "flex-row-reverse" : ""
				)}
			>
				<div className={cn(
               "flex items-center gap-2",
               isLeftHanded ? "flex-row-reverse" : ""
            )}>
					{/* Add Folder */}
               <Button
						variant="outline"
						size="default"
						onClick={handleAddFolder}
						className="cursor-pointer"
					>
						<FolderPlus className="w-4 h-4 mr-2" />
						{t('Drawer.addFolder')}
					</Button>

               {/* Import */}
					<input
						ref={fileInputRef}
						type="file"
						accept=".cotm"
						onChange={handleFileImport}
						className="hidden"
					/>
					<IconButton
						variant="outline"
						size="default"
						onClick={() => fileInputRef.current?.click()}
						title={t('Drawer.import')}
						className="cursor-pointer"
					>
						<Download className="w-5 h-5" />
					</IconButton>

               {/* View toggle */}
               <IconButton
                  variant="outline"
                  size="default"
                  onClick={() => setIsCompactView(!isCompactView)}
                  title={isCompactView ? t('Drawer.richView') : t('Drawer.compactView')}
                  className="cursor-pointer"
               >
                  {isCompactView ? <Grid3x3 className="w-5 h-5" /> : <List className="w-5 h-5" />}
               </IconButton>
				</div>
			</div>

			{/* Context Menu */}
			<MobileDrawerContextMenu
				isOpen={showContextMenu}
				onClose={() => {
					setShowContextMenu(false);
					setContextMenuTarget(null);
					setContextMenuPosition(null);
				}}
				target={contextMenuTarget}
				position={contextMenuPosition}
				onAddToCharacter={onAddToCharacter}
			/>
		</div>
	);
}
