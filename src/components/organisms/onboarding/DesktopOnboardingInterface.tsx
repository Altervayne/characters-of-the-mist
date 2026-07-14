// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import DesktopOnboardingNav from './DesktopOnboardingNav';

// -- Icon Imports --
import { PanelsTopLeft, FolderTree, LayoutDashboard, NotebookText, Command, type LucideIcon } from 'lucide-react';



interface DesktopOnboardingInterfaceProps {
	onNext: () => void;
	onBack: () => void;
	onSkip: () => void;
}

const FEATURES: { key: string; icon: LucideIcon }[] = [
	{ key: 'tabs', icon: PanelsTopLeft },
	{ key: 'drawer', icon: FolderTree },
	{ key: 'board', icon: LayoutDashboard },
	{ key: 'notes', icon: NotebookText },
	{ key: 'commandPalette', icon: Command },
];

export default function DesktopOnboardingInterface({ onNext, onBack, onSkip }: DesktopOnboardingInterfaceProps) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col">
			<div className="text-center mb-6">
				<h1 className="text-2xl font-bold mb-2">
					{t('DesktopOnboarding.interface.title')}
				</h1>
				<p className="text-muted-foreground">
					{t('DesktopOnboarding.interface.description')}
				</p>
			</div>

			<div className="flex flex-col gap-3">
				{FEATURES.map(({ key, icon: Icon }) => (
					<div
						key={key}
						className="flex items-start gap-4 p-4 rounded-xl border-2 border-border bg-card"
					>
						<div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
							<Icon className="w-5 h-5 text-primary" />
						</div>
						<div className="text-left">
							<p className="font-semibold">{t(`DesktopOnboarding.interface.${key}.title`)}</p>
							<p className="text-sm text-muted-foreground">{t(`DesktopOnboarding.interface.${key}.description`)}</p>
						</div>
					</div>
				))}
			</div>

			<DesktopOnboardingNav onNext={onNext} onBack={onBack} onSkip={onSkip} />
		</div>
	);
}
