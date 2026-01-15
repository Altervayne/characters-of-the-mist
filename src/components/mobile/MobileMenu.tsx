// -- React Imports --
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Icon Imports --
import { Settings, Info, FileDown, FileUp, Save, FileText, LogOut, FolderDown, FolderUp, SaveAll } from 'lucide-react';

// -- Store Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useDrawerStore, useDrawerActions } from '@/lib/stores/drawerStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/lib/config';
import { exportDrawer, importFromFile, exportCharacterSheet } from '@/lib/utils/export-import';
import { harmonizeData } from '@/lib/harmonization';



interface MobileMenuProps {
	onOpenSettings: () => void;
	onOpenAbout: () => void;
	onOpenPatchNotes: () => void;
}

export default function MobileMenu({ onOpenSettings, onOpenAbout, onOpenPatchNotes }: MobileMenuProps) {
	const { t } = useTranslation();
	const character = useCharacterStore((state) => state.character);
	const { unloadCharacter, loadCharacter } = useCharacterActions();
	const drawer = useDrawerStore((state) => state.drawer);
	const { importFullDrawer } = useDrawerActions();
	const isMobileFABMode = useAppSettingsStore((state) => state.isMobileFABMode);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const characterImportRef = useRef<HTMLInputElement>(null);

	const handleCharacterImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		try {
			const file = files[0];
			const importedData = await importFromFile(file);

			if (importedData.fileType === 'FULL_CHARACTER_SHEET') {
				const harmonized = harmonizeData(importedData.content, importedData.fileType);
				loadCharacter(harmonized as import('@/lib/types/character').Character);
				toast.success(t('Notifications.character.imported'));
			} else {
				toast.error(t('Notifications.character.importError'));
			}

			if (characterImportRef.current) {
				characterImportRef.current.value = '';
			}
		} catch (error) {
			console.error('Import error:', error);
			toast.error(t('Notifications.general.importError'));
		}
	};

	const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		try {
			const file = files[0];
			const importedData = await importFromFile(file);

			if (importedData.fileType === 'FULL_DRAWER') {
				importFullDrawer(importedData.content as import('@/lib/types/drawer').Drawer, undefined);
				toast.success(t('Notifications.drawer.imported'));
			} else {
				toast.error(t('Notifications.drawer.importError'));
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



	// Menu item definitions - onClick is resolved at click time to avoid ref-during-render issues
	const menuItems = [
		{
			id: 'settings',
			label: t('MobileMenu.settings'),
			icon: Settings,
			destructive: false,
		},
		{
			id: 'about',
			label: t('MobileMenu.info'),
			icon: Info,
			destructive: false,
		},
		{
			id: 'patchNotes',
			label: t('MobileMenu.patchNotes'),
			icon: FileText,
			destructive: false,
		},
		{
			id: 'save',
			label: t('MobileMenu.save'),
			icon: Save,
			show: !!character,
			destructive: false,
		},
      {
			id: 'saveCharacterAs',
			label: t('MobileMenu.saveCharacterAs'),
			icon: SaveAll,
			show: !!character,
			destructive: false,
		},
		{
			id: 'export',
			label: t('MobileMenu.export'),
			icon: FileUp,
			show: !!character,
			destructive: false,
		},
		{
			id: 'import',
			label: t('MobileMenu.import'),
			icon: FileDown,
			destructive: false,
		},
		{
			id: 'exportDrawer',
			label: t('Drawer.Actions.exportFull'),
			icon: FolderUp,
			destructive: false,
		},
		{
			id: 'importDrawer',
			label: t('Drawer.Actions.import'),
			icon: FolderDown,
			destructive: false,
		},
		{
			id: 'unload',
			label: t('MobileMenu.unload'),
			icon: LogOut,
			show: !!character,
			destructive: true,
		},
	].filter(item => item.show !== false);


   
	const handleMenuClick = (id: string) => {
		switch (id) {
			case 'settings':
				onOpenSettings();
				break;
			case 'about':
				onOpenAbout();
				break;
			case 'patchNotes':
				onOpenPatchNotes();
				break;
			case 'save':
				// Characters auto-save, so just show confirmation
				toast.success(t('Notifications.character.saved'));
				break;
			case 'export':
				if (character) {
					exportCharacterSheet(character);
					toast.success(t('Notifications.character.exported'));
				}
				break;
			case 'saveCharacterAs':
				if (character) {
					exportCharacterSheet(character);
					toast.success(t('Notifications.character.exported'));
				}
				break;
			case 'import':
				characterImportRef.current?.click();
				break;
			case 'exportDrawer':
				exportDrawer(drawer);
				toast.success(t('Notifications.drawer.exported'));
				break;
			case 'importDrawer':
				fileInputRef.current?.click();
				break;
			case 'unload':
				unloadCharacter();
				break;
		}
	};



	return (
		<div className="h-full w-full flex flex-col">
			{/* Hidden file input for drawer import */}
			<input
				ref={fileInputRef}
				type="file"
				accept=".cotm"
				onChange={handleFileImport}
				className="hidden"
			/>

			{/* Hidden file input for character import */}
			<input
				ref={characterImportRef}
				type="file"
				accept=".cotm"
				onChange={handleCharacterImport}
				className="hidden"
			/>

			{/* Header - fixed at top */}
			<div className="p-6 pb-2 shrink-0">
				<h2 className="text-2xl font-bold mb-2">{t('MobileMenu.title')}</h2>
				<p className="text-sm text-muted-foreground">
					{t('MobileMenu.description')}
				</p>
			</div>

			{/* Scrollable menu items */}
			<div className={cn(
				"flex-1 overflow-y-auto px-6 py-4",
				isMobileFABMode && "pb-10"
			)}>
				<div className="w-full flex flex-col items-center gap-3">
					{menuItems.map((item) => {
						const Icon = item.icon;
						return (
							<button
								key={item.id}
								onClick={() => handleMenuClick(item.id)}
								className={cn(
									"inline-flex px-4 items-center gap-2 rounded-md transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
									"w-68 max-w-full min-h-12 py-2 justify-start text-left",
									item.destructive ? "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60" : "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
									"hover:bg-primary/10 transition-colors"
								)}
							>
								<Icon className="h-6 w-6 mr-4 shrink-0" />
								<span className="text-md text-left">{item.label}</span>
							</button>
						);
					})}

					{/* Version info at bottom of scroll area */}
					<div className="text-xs text-center text-muted-foreground pt-4">
						<p>Characters of the Mist</p>
						<p>Version {APP_VERSION || '1.0.0'}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
