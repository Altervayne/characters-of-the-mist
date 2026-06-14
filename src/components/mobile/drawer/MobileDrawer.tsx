// -- React Imports --
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

// -- Component Imports --
import MobileBreadcrumbs from '@/components/mobile/drawer/MobileBreadcrumbs';
import MobileFolderItem from '@/components/mobile/drawer/MobileFolderItem';
import MobileDrawerItem from '@/components/mobile/drawer/MobileDrawerItem';
import MobileDrawerContextMenu from '@/components/mobile/drawer/MobileDrawerContextMenu';
import MobileAddFolderSheet from '@/components/mobile/drawer/MobileAddFolderSheet';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { FolderPlus, List, Grid3x3, Download } from 'lucide-react';

// -- Store Imports --
import { useDrawerActions } from '@/lib/stores/drawerStore';
import { useAppSettingsStore, useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Hook Imports --
import { useDrawerNavigation } from '@/hooks/drawer/useDrawerNavigation';
import { useDrawerFileImport } from '@/hooks/drawer/useDrawerFileImport';
import { useMobileDragSensors } from '@/hooks/mobile/useMobileDragSensors';
import { useMobileDrawerDragReorder } from '@/hooks/mobile/useMobileDrawerDragReorder';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { DrawerItem } from '@/lib/types/drawer';



interface MobileDrawerProps {
	onAddToCharacter?: (item: DrawerItem) => void;
}

export default function MobileDrawer({ onAddToCharacter }: MobileDrawerProps) {
	const { t } = useTranslation();

	// Drawer state
	const { addFolder } = useDrawerActions();

	// Folder navigation (current folder, contents, breadcrumb) via the shared hook
	const { currentFolderId, navigateToFolder, currentItems, currentFolders, breadcrumbPath } = useDrawerNavigation();

	// File import via the shared hook (button-triggered file-input path only; no drag zone)
	const { handleFileSelected, fileInputRef, formRef } = useDrawerFileImport(currentFolderId);

	// UI state
	const [isCompactView, setIsCompactView] = useState(true);
	const [showContextMenu, setShowContextMenu] = useState(false);
	const [contextMenuTarget, setContextMenuTarget] = useState<{
      type: 'item' | 'folder';
		id: string;
		name: string;
	} | null>(null);
	const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
	const [showAddFolderSheet, setShowAddFolderSheet] = useState(false);

   // Mobile Handedness
   const mobileHandedness = useAppSettingsStore((state) => state.mobileHandedness);
   const isLeftHanded = (mobileHandedness === 'left')

   // One-time long-press hint: shown once when gesture tips are enabled, then
   // remembered so it never repeats. Gated on the setting (never shown when off).
   // The overflow (⋮) button on each row is the always-present fallback.
   const areGestureHintsEnabled = useAppSettingsStore((state) => state.areGestureHintsEnabled);
   const hasSeenDrawerMenuHint = useAppSettingsStore((state) => state.hasSeenDrawerMenuHint);
   const { setHasSeenDrawerMenuHint } = useAppSettingsActions();

   useEffect(() => {
      if (areGestureHintsEnabled && !hasSeenDrawerMenuHint) {
         toast(t('MobileGestureHints.drawerLongPress', { defaultValue: 'Tip: press and hold an item (or tap its ⋮ button) for more options.' }));
         setHasSeenDrawerMenuHint(true);
      }
   }, [areGestureHintsEnabled, hasSeenDrawerMenuHint, setHasSeenDrawerMenuHint, t]);

   // Drag-to-reorder (folders and items within the current folder)
   const sensors = useMobileDragSensors();
   const { handleDragEnd } = useMobileDrawerDragReorder(currentFolderId, currentFolders, currentItems);
   const folderIds = useMemo(() => currentFolders.map((folder) => folder.id), [currentFolders]);
   const itemIds = useMemo(() => currentItems.map((item) => item.id), [currentItems]);

	// Handlers
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
		setShowAddFolderSheet(true);
	};

	const handleAddFolderConfirm = (folderName: string) => {
		addFolder(folderName, currentFolderId ?? undefined);
		toast.success(t('Notifications.drawer.folderCreated'));
	};

	const hasContent = currentFolders.length > 0 || currentItems.length > 0;

	return (
		<div className="h-full flex flex-col bg-background" data-tutorial="drawer-content">
			{/* Content */}
			<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
					<SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
						{currentFolders.map((folder) => (
							<MobileFolderItem
								key={folder.id}
								folder={folder}
								onNavigate={navigateToFolder}
								onLongPress={handleFolderLongPress}
								isLeftHanded={isLeftHanded}
							/>
						))}
					</SortableContext>

					{/* Separator if both folders and items exist */}
					{currentFolders.length > 0 && currentItems.length > 0 && (
						<div className="border-t border-border my-4" />
					)}

					{/* Items */}
					<SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
						{currentItems.map((item) => (
							<MobileDrawerItem
								key={item.id}
								item={item}
								isCompact={isCompactView}
								onLongPress={handleItemLongPress}
								isLeftHanded={isLeftHanded}
							/>
						))}
					</SortableContext>
				</div>
			</DndContext>

			{/* Breadcrumbs navigation at bottom */}
			<div className="border-t border-border">
            <MobileBreadcrumbs
               breadcrumbPath={breadcrumbPath}
               onNavigate={navigateToFolder}
			   />
         </div>

			{/* Toolbar at bottom for thumb accessibility */}
			<div
				data-tutorial="drawer-toolbar"
				className={cn(
					"flex items-center justify-between px-4 py-4 border-t border-border bg-card pb-safe",
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
					<form ref={formRef} className="hidden">
						<input
							ref={fileInputRef}
							type="file"
							accept=".cotm,.json"
							onChange={handleFileSelected}
						/>
					</form>
					<IconButton
						variant="outline"
						size="default"
						onClick={() => fileInputRef.current?.click()}
						title={t('Drawer.Actions.import')}
						className="cursor-pointer"
					>
						<Download className="w-5 h-5" />
					</IconButton>

               {/* View toggle */}
               <IconButton
                  variant="outline"
                  size="default"
                  onClick={() => setIsCompactView(!isCompactView)}
                  title={isCompactView ? t('Drawer.toggleView') : t('Drawer.compactView')}
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

			{/* Add Folder Sheet */}
			<MobileAddFolderSheet
				isOpen={showAddFolderSheet}
				onClose={() => setShowAddFolderSheet(false)}
				onConfirm={handleAddFolderConfirm}
			/>
		</div>
	);
}
