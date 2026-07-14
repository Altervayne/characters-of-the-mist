// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Hook Imports --
import { useThemeMode } from '@/hooks/useThemeMode';

// -- Component Imports --
import DesktopOnboardingNav from './DesktopOnboardingNav';
import { ThemeSwatch } from '@/components/molecules/theme/ThemeSwatch';

// -- Icon Imports --
import { Sun, Moon, Check, FlipHorizontal, BookOpen } from 'lucide-react';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Theme Imports --
import { PRESET_THEMES, resolveThemeTokens } from '@/lib/theme/themeTokens';

// -- Utils --
import { cn } from '@/lib/utils';



interface DesktopOnboardingAppearanceProps {
	onNext: () => void;
	onBack: () => void;
	onSkip: () => void;
}

const COLOR_PALETTES = [
	{ id: 'theme-neutral', name: 'Neutral' },
	{ id: 'theme-legends', name: 'Legend' },
	{ id: 'theme-city-of-mist', name: 'City of Mist' },
	{ id: 'theme-otherscape', name: 'Otherscape' },
];

export default function DesktopOnboardingAppearance({ onNext, onBack, onSkip }: DesktopOnboardingAppearanceProps) {
	const { t } = useTranslation();
	const { resolvedMode, setMode } = useThemeMode();
	const colorTheme = useAppSettingsStore((state) => state.theme);
	const setColorTheme = useAppSettingsStore((state) => state.actions.setTheme);
	const isSideBySideView = useAppSettingsStore((state) => state.isSideBySideView);
	const setSideBySideView = useAppSettingsStore((state) => state.actions.setSideBySideView);

	return (
		<div className="flex flex-col">
			<div className="text-center mb-6">
				<h1 className="text-2xl font-bold mb-2">
					{t('MobileOnboarding.appearance.title')}
				</h1>
				<p className="text-muted-foreground">
					{t('MobileOnboarding.appearance.description')}
				</p>
			</div>

			{/* Display Mode */}
			<div className="mb-6">
				<p className="text-sm font-medium mb-3 text-center">
					{t('MobileOnboarding.appearance.mode')}
				</p>
				<div className="grid grid-cols-2 gap-3">
					<button
						onClick={() => setMode('light')}
						className={cn(
							"p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center gap-2",
							resolvedMode === 'light'
								? "border-primary bg-primary/5"
								: "border-border bg-card hover:border-primary/50"
						)}
					>
						<Sun className="w-8 h-8" />
						<span className="font-medium">{t('SettingsDialog.light')}</span>
					</button>
					<button
						onClick={() => setMode('dark')}
						className={cn(
							"p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center gap-2",
							resolvedMode === 'dark'
								? "border-primary bg-primary/5"
								: "border-border bg-card hover:border-primary/50"
						)}
					>
						<Moon className="w-8 h-8" />
						<span className="font-medium">{t('SettingsDialog.dark')}</span>
					</button>
				</div>
			</div>

			{/* Color Palette */}
			<div className="mb-6">
				<p className="text-sm font-medium mb-3 text-center">
					{t('MobileOnboarding.appearance.palette')}
				</p>
				<div className="grid grid-cols-2 gap-3">
					{COLOR_PALETTES.map((palette) => (
						<button
							key={palette.id}
							onClick={() => setColorTheme(palette.id as typeof colorTheme)}
							className={cn(
								"p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3",
								colorTheme === palette.id
									? "border-primary bg-primary/5"
									: "border-border bg-card hover:border-primary/50"
							)}
						>
							<ThemeSwatch tokens={resolveThemeTokens(PRESET_THEMES[palette.id], resolvedMode)} />
							<span className="font-medium text-sm truncate">{palette.name}</span>
							{colorTheme === palette.id && (
								<Check className="w-4 h-4 text-primary ml-auto shrink-0" />
							)}
						</button>
					))}
				</div>
			</div>

			{/* Card View - desktop-specific */}
			<div>
				<p className="text-sm font-medium mb-3 text-center">
					{t('SettingsDialog.cardView.title')}
				</p>
				<div className="grid grid-cols-2 gap-3">
					<button
						onClick={() => setSideBySideView(false)}
						className={cn(
							"p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center gap-2",
							!isSideBySideView
								? "border-primary bg-primary/5"
								: "border-border bg-card hover:border-primary/50"
						)}
					>
						<FlipHorizontal className="w-8 h-8" />
						<span className="font-medium text-sm text-center">{t('SettingsDialog.cardView.flipping')}</span>
					</button>
					<button
						onClick={() => setSideBySideView(true)}
						className={cn(
							"p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center gap-2",
							isSideBySideView
								? "border-primary bg-primary/5"
								: "border-border bg-card hover:border-primary/50"
						)}
					>
						<BookOpen className="w-8 h-8" />
						<span className="font-medium text-sm text-center">{t('SettingsDialog.cardView.sideBySide')}</span>
					</button>
				</div>
			</div>

			<DesktopOnboardingNav onNext={onNext} onBack={onBack} onSkip={onSkip} />
		</div>
	);
}
