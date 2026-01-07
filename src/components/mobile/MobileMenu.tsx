// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Settings, Info, FileDown, FileUp, Save } from 'lucide-react';

// -- Component Imports --
import { Button } from '@/components/ui/button';

// -- Store Imports --
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useCharacterStore } from '@/lib/stores/characterStore';

// -- Utils Imports --
import { cn } from '@/lib/utils';

interface MobileMenuProps {
	onOpenSettings: () => void;
}

export default function MobileMenu({ onOpenSettings }: MobileMenuProps) {
	const { t } = useTranslation();
	const { setInfoOpen } = useAppGeneralStateActions();
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
			id: 'info',
			label: t('MobileMenu.info') || 'About',
			icon: Info,
			onClick: () => setInfoOpen(true),
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
		<div className="h-full flex flex-col p-6 gap-4">
			<div className="mb-4">
				<h2 className="text-2xl font-bold mb-2">{t('MobileMenu.title') || 'Menu'}</h2>
				<p className="text-sm text-muted-foreground">
					{t('MobileMenu.description') || 'Access app settings and actions'}
				</p>
			</div>

			<div className="flex-1 space-y-3">
				{menuItems.map((item) => {
					const Icon = item.icon;
					return (
						<Button
							key={item.id}
							onClick={item.onClick}
							variant="outline"
							className={cn(
								"w-full h-16 justify-start text-left",
								"hover:bg-primary/10 transition-colors"
							)}
						>
							<Icon className="h-6 w-6 mr-4 shrink-0" />
							<span className="text-lg">{item.label}</span>
						</Button>
					);
				})}
			</div>

			<div className="text-xs text-center text-muted-foreground mt-auto">
				<p>Characters of the Mist</p>
				<p>Version {import.meta.env.VITE_APP_VERSION || '1.0.0'}</p>
			</div>
		</div>
	);
}
