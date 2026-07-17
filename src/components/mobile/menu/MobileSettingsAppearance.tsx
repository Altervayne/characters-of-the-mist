// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Hook Imports --
import { useThemeMode } from '@/hooks/useThemeMode';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// -- Icon Imports --
import { Sun, Moon, Palette, ChevronRight } from 'lucide-react';

// -- Component Imports --
import { MobileSettingsSubScreen } from '@/components/mobile/menu/MobileSettingsSubScreen';
import { MobileSettingsToggleGroup } from '@/components/mobile/menu/MobileSettingsToggleGroup';

// -- Store and Util Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { PRESET_LABELS, customThemeClass, customThemeIdFromClass } from '@/lib/theme/themeTokens';

interface MobileSettingsAppearanceProps {
	onBack?: () => void;
	onOpenThemes?: () => void;
}

/** Appearance settings: the theme picker (drills to the Themes screen) and the light/dark mode toggle. */
export default function MobileSettingsAppearance({ onBack, onOpenThemes }: MobileSettingsAppearanceProps) {
	const { t } = useTranslation();
	const { resolvedMode, setMode } = useThemeMode();
	const { theme: colorTheme, customThemes } = useAppSettingsStore();

	// The active theme's display name: a preset label, or the custom's own name.
	const activeThemeName = customThemeIdFromClass(colorTheme)
		? (customThemes.find((theme) => customThemeClass(theme.id) === colorTheme)?.name ?? colorTheme)
		: (PRESET_LABELS[colorTheme] ?? colorTheme);

	return (
		<MobileSettingsSubScreen title={t('SettingsShell.sections.appearance')} onBack={onBack}>
			{/* Theme: opens the dedicated Themes screen (select presets/customs, import, manage). */}
			<div className="space-y-2">
				<Label className="text-sm font-semibold">{t('SettingsDialog.themes.windowTitle')}</Label>
				<Button
					onClick={onOpenThemes}
					variant="default"
					className="w-full h-12 text-base justify-start"
				>
					<Palette className="mr-3 h-5 w-5 shrink-0" />
					<span className="flex-1 text-left truncate">{activeThemeName}</span>
					<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
				</Button>
			</div>

			{/* Appearance (Light/Dark) */}
			<MobileSettingsToggleGroup
				label={t('SettingsDialog.appearance')}
				options={[
					{
						icon: <Sun className="mr-2 h-5 w-5 shrink-0" />,
						label: t('SettingsDialog.light'),
						isActive: resolvedMode === 'light',
						onSelect: () => setMode('light'),
					},
					{
						icon: <Moon className="mr-2 h-5 w-5 shrink-0" />,
						label: t('SettingsDialog.dark'),
						isActive: resolvedMode === 'dark',
						onSelect: () => setMode('dark'),
					},
				]}
			/>
		</MobileSettingsSubScreen>
	);
}
