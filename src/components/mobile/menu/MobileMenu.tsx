// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Icon Imports --
import { Settings, Info, FileDown, FileUp, Save, FileText, LogOut, FolderDown, FolderUp, SaveAll } from 'lucide-react';

// -- Component Imports --
import { MobileMenuItemButton } from '@/components/mobile/menu/MobileMenuItemButton';

// -- Store Imports --
import { useCharacterStore } from '@/lib/stores/characterStore';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';
import { exportEntireDrawerAsNestedTree } from '@/lib/drawer/drawerRepository';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Hook Imports --
import { useMobileMenuFileImport } from '@/hooks/mobile/useMobileMenuFileImport';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/lib/config';
import { exportDrawer, exportCharacterSheet } from '@/lib/utils/export-import';



interface MobileMenuProps {
	onOpenSettings: () => void;
	onOpenAbout: () => void;
	onOpenPatchNotes: () => void;
}

export default function MobileMenu({ onOpenSettings, onOpenAbout, onOpenPatchNotes }: MobileMenuProps) {
	const { t } = useTranslation();
	const character = useCharacterStore((state) => state.character);
	const { closeActiveTab } = useTabManagerActions();
	const isMobileFABMode = useAppSettingsStore((state) => state.isMobileFABMode);

	const {
		characterImportInputRef,
		drawerImportInputRef,
		handleCharacterImportFileSelected,
		handleDrawerImportFileSelected,
		triggerCharacterImport,
		triggerDrawerImport,
	} = useMobileMenuFileImport();



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
				triggerCharacterImport();
				break;
			case 'exportDrawer':
				void (async () => {
					try {
						const drawer = await exportEntireDrawerAsNestedTree();
						exportDrawer(drawer);
						toast.success(t('Notifications.drawer.exported'));
					} catch {
						toast.error(t('Notifications.drawer.actionFailed'));
					}
				})();
				break;
			case 'importDrawer':
				triggerDrawerImport();
				break;
			case 'unload':
				closeActiveTab();
				break;
		}
	};



	return (
		<div className="h-full w-full flex flex-col" data-tutorial="menu-content">
			{/* Hidden file input for drawer import */}
			<input
				ref={drawerImportInputRef}
				type="file"
				accept=".cotm"
				onChange={handleDrawerImportFileSelected}
				className="hidden"
			/>

			{/* Hidden file input for character import */}
			<input
				ref={characterImportInputRef}
				type="file"
				accept=".cotm"
				onChange={handleCharacterImportFileSelected}
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
					{menuItems.map((item) => (
						<MobileMenuItemButton
							key={item.id}
							label={item.label}
							icon={item.icon}
							destructive={item.destructive}
							onClick={() => handleMenuClick(item.id)}
						/>
					))}

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
