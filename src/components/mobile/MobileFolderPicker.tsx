// Mobile Folder Picker Component
// Full-screen bottom sheet for selecting destination folder when moving items/folders

// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

// -- Component Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { Folder, Home, ChevronRight } from 'lucide-react';

// -- Store Imports --
import { useDrawerStore } from '@/lib/stores/drawerStore';

// -- Utils Imports --
import { findFolder, buildBreadcrumb } from '@/lib/utils/drawer';
import { cn } from '@/lib/utils';



interface MobileFolderPickerProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (folderId: string | null) => void;
	excludeFolderId?: string; // Can't move folder into itself or its children
}

export default function MobileFolderPicker({
	isOpen,
	onClose,
	onSelect,
	excludeFolderId
}: MobileFolderPickerProps) {
	const { t } = useTranslation();
	const drawer = useDrawerStore((state) => state.drawer);

	// State for navigating within the picker
	const [pickerFolderId, setPickerFolderId] = useState<string | null>(null);

	// Get current folder and its subfolders
	const currentFolderInPicker = pickerFolderId
		? findFolder(drawer.folders, pickerFolderId)
		: null;

	const foldersInPicker = currentFolderInPicker?.folders ?? drawer.folders;

	// Build breadcrumb path for current location in picker
	const breadcrumbPath = pickerFolderId
		? buildBreadcrumb(drawer.folders, pickerFolderId)
		: [];

	// Check if a folder is the excluded folder or a descendant of it
	const isFolderExcluded = (folderId: string): boolean => {
		if (!excludeFolderId) return false;
		if (folderId === excludeFolderId) return true;

		// Check if this folder is a descendant of the excluded folder
		const excludedFolder = findFolder(drawer.folders, excludeFolderId);
		if (!excludedFolder) return false;

		return !!findFolder([excludedFolder], folderId);
	};

	// Filter out excluded folders
	const availableFolders = foldersInPicker.filter(
		folder => !isFolderExcluded(folder.id)
	);

	const handleNavigate = (folderId: string | null) => {
		setPickerFolderId(folderId);
	};

	const handleSelectCurrent = () => {
		onSelect(pickerFolderId);
		// Reset picker state immediately, onClose will be called by parent after animation
		setPickerFolderId(null);
		onClose();
	};

	const handleCancel = () => {
		// Reset picker state immediately, onClose will be called by parent after animation
		setPickerFolderId(null);
		onClose();
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 bg-black/50 z-60"
						onClick={handleCancel}
					/>

					{/* Bottom Sheet */}
					<motion.div
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ type: 'spring', damping: 30, stiffness: 300 }}
						className="fixed border-t border-border bottom-0 left-0 right-0 top-20 z-60 bg-background rounded-t-2xl shadow-2xl flex flex-col"
					>
                  <div className="p-4 pb-3 border-b border-border shrink-0">
                     <h2 className="text-lg font-semibold">
                        {t('Drawer.Actions.selectFolder')}
                     </h2>
                  </div>

                  {/* Folder list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                     {availableFolders.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                           {t('Drawer.noSubfolders')}
                        </div>
                     )}

                     {availableFolders.map((folder) => (
                        <button
                           key={folder.id}
                           onClick={() => handleNavigate(folder.id)}
                           className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
                        >
                           <Folder className="w-5 h-5 text-primary shrink-0" />
                           <div className="flex-1 min-w-0 text-left">
                              <p className="font-medium text-foreground truncate">
                                 {folder.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                 {folder.folders.length > 0 && t('Drawer.folderCount', { count: folder.folders.length })}
                                 {folder.folders.length > 0 && folder.items.length > 0 && ', '}
                                 {folder.items.length > 0 && t('Drawer.itemCount', { count: folder.items.length })}
                                 {folder.folders.length === 0 && folder.items.length === 0 && t('Drawer.empty')}
                              </p>
                           </div>
                        </button>
                     ))}
                  </div>

                  {/* Breadcrumbs */}
                  <div className="flex items-center gap-1 overflow-x-auto py-2 px-4 border-t border-border scrollbar-hide shrink-0">
                     <button
                        onClick={() => handleNavigate(null)}
                        className={cn(
                           "flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0",
                           pickerFolderId === null
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                     >
                        <Home className="w-4 h-4" />
                        <span>{t('Drawer.root')}</span>
                     </button>

                     {breadcrumbPath.map((folder, index) => {
                        const isLast = index === breadcrumbPath.length - 1;

                        return (
                           <div key={folder.id} className="flex items-center gap-1 shrink-0">
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              <button
                                 onClick={() => handleNavigate(folder.id)}
                                 className={cn(
                                    "px-2 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                                    isLast
                                       ? "bg-primary text-primary-foreground"
                                       : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                 )}
                              >
                                 {folder.name}
                              </button>
                           </div>
                        );
                     })}
                  </div>

                  {/* Action buttons */}
                  <div className="p-4 border-t border-border flex gap-2 shrink-0 pb-safe">
                     <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="flex-1 cursor-pointer h-11"
                     >
                        {t('Drawer.Actions.cancel')}
                     </Button>
                     <Button
                        onClick={handleSelectCurrent}
                        className="flex-1 cursor-pointer h-11"
                     >
                        {pickerFolderId
                           ? t('Drawer.selectThisFolder')
                           : t('Drawer.Actions.selectRoot')}
                     </Button>
                  </div>
               </motion.div>
            </>
			)}
		</AnimatePresence>
	);
}
