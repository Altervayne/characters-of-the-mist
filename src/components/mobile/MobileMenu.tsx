// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Settings, Info, FileDown, FileUp, Save, FileText } from 'lucide-react';

// -- Store Imports --
import { useCharacterStore } from '@/lib/stores/characterStore';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/lib/config';



interface MobileMenuProps {
	onOpenSettings: () => void;
	onOpenAbout: () => void;
	onOpenPatchNotes: () => void;
}

export default function MobileMenu({ onOpenSettings, onOpenAbout, onOpenPatchNotes }: MobileMenuProps) {
	const { t } = useTranslation();
	const character = useCharacterStore((state) => state.character);

	const menuItems = [
		{
			id: 'settings',
			label: t('MobileMenu.settings') || 'Settings',
			icon: Settings,
			onClick: onOpenSettings,
			show: true,
		},
		{
			id: 'about',
			label: t('MobileMenu.info') || 'About',
			icon: Info,
			onClick: onOpenAbout,
			show: true,
		},
		{
			id: 'patchNotes',
			label: t('MobileMenu.patchNotes') || 'Patch Notes',
			icon: FileText,
			onClick: onOpenPatchNotes,
			show: true,
		},
		{
			id: 'save',
			label: t('MobileMenu.save') || 'Save Character',
			icon: Save,
			onClick: () => {
				// TODO: Implement save in Phase 6
			},
			show: !!character,
		},
		{
			id: 'export',
			label: t('MobileMenu.export') || 'Export Character',
			icon: FileDown,
			onClick: () => {
				// TODO: Implement export in Phase 6
			},
			show: !!character,
		},
		{
			id: 'import',
			label: t('MobileMenu.import') || 'Import',
			icon: FileUp,
			onClick: () => {
				// TODO: Implement import in Phase 6
			},
			show: true,
		},
	].filter(item => item.show);

	return (
		<div className="h-full w-full flex flex-col p-6 gap-4">
			<div className="mb-4">
				<h2 className="text-2xl font-bold mb-2">{t('MobileMenu.title') || 'Menu'}</h2>
				<p className="text-sm text-muted-foreground">
					{t('MobileMenu.description') || 'Access app settings and actions'}
				</p>
			</div>

			<div className="w-full flex flex-1 flex-col items-center gap-2 space-y-3">
				{menuItems.map((item) => {
					const Icon = item.icon;
					return (
						<button
							key={item.id}
							onClick={item.onClick}
							className={cn(
                        "inline-flex px-4 items-center justify-center gap-2 whitespace-nowrap rounded-md transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
								"w-68 max-w-full h-12 justify-start text-left",
								"bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
                        "hover:bg-primary/10 transition-colors"
							)}
						>
							<Icon className="h-6 w-6 mr-4 shrink-0" />
							<span className="text-md">{item.label}</span>
						</button>
					);
				})}
			</div>

			<div className="text-xs text-center text-muted-foreground mt-auto">
				<p>Characters of the Mist</p>
				<p>Version {APP_VERSION || '1.0.0'}</p>
			</div>
		</div>
	);
}
