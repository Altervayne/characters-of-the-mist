// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// -- Icon Imports --
import {
	FlipHorizontal,
	BookOpen,
	UnlockIcon,
	Lock,
	PanelsRightBottom,
	SquareMenu,
	Hand,
	Eye,
	EyeOff,
	Lightbulb,
	ChevronRight,
} from 'lucide-react';

// -- Component Imports --
import { MobileSettingsSubScreen } from '@/components/mobile/menu/MobileSettingsSubScreen';
import { MobileSettingsToggleGroup } from '@/components/mobile/menu/MobileSettingsToggleGroup';

// -- Store Imports --
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';

const locales = [
	{ code: 'en', name: 'English' },
	{ code: 'fr', name: 'Français' },
	{ code: 'de', name: 'Deutsch' },
];

interface MobileSettingsGeneralProps {
	onBack?: () => void;
}

/** General settings: language, card view, tracker editing, and the mobile-only interaction preferences. */
export default function MobileSettingsGeneral({ onBack }: MobileSettingsGeneralProps) {
	const { t, i18n } = useTranslation();
	const locale = i18n.language?.split('-')[0] || 'en';

	const { isSideBySideView, isTrackersAlwaysEditable, isMobileFABMode, mobileHandedness, areGestureHintsEnabled } = useAppSettingsStore();
	const { setSideBySideView, setTrackersAlwaysEditable, setMobileFABMode, setMobileHandedness, setGestureHintsEnabled, setHasSeenTrackerSelectHint, setHasSeenDrawerMenuHint } = useAppSettingsActions();

	const handleLocaleChange = (newLocale: string) => {
		i18n.changeLanguage(newLocale);
	};

	// Re-arm the one-time gesture tips: turn them back on and clear the
	// "already seen" flags so each hint shows again the next time its surface
	// (trackers / drawer) is opened. For users who dismissed or missed them.
	const handleReplayGestureTips = () => {
		setGestureHintsEnabled(true);
		setHasSeenTrackerSelectHint(false);
		setHasSeenDrawerMenuHint(false);
		toast.success(t('Notifications.general.gestureTipsReset'));
	};

	return (
		<MobileSettingsSubScreen title={t('SettingsShell.sections.general')} onBack={onBack}>
			{/* Language */}
			<div className="space-y-2">
				<Label className="text-sm font-semibold">{t('SettingsDialog.language')}</Label>
				<Select value={locale} onValueChange={handleLocaleChange}>
					<SelectTrigger className="h-12 text-base">
						<SelectValue placeholder={t('SettingsDialog.selectLanguagePlaceholder')} />
					</SelectTrigger>
					<SelectContent>
						{locales.map((loc) => (
							<SelectItem key={loc.code} value={loc.code} className="text-base py-3">
								{loc.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Card View Mode */}
			<MobileSettingsToggleGroup
				label={t('SettingsDialog.cardView.title')}
				options={[
					{
						icon: <FlipHorizontal className="mr-2 h-5 w-5 shrink-0" />,
						label: t('SettingsDialog.cardView.flipping'),
						isActive: !isSideBySideView,
						onSelect: () => setSideBySideView(false),
					},
					{
						icon: <BookOpen className="mr-2 h-5 w-5 shrink-0" />,
						label: t('SettingsDialog.cardView.sideBySide'),
						isActive: isSideBySideView,
						onSelect: () => setSideBySideView(true),
					},
				]}
			/>

			{/* Tracker Editing Mode */}
			<MobileSettingsToggleGroup
				label={t('SettingsDialog.trackerEdit.title')}
				options={[
					{
						icon: <UnlockIcon className="mr-2 h-5 w-5 shrink-0" />,
						label: t('SettingsDialog.trackerEdit.unlocked'),
						isActive: !isTrackersAlwaysEditable,
						onSelect: () => setTrackersAlwaysEditable(false),
					},
					{
						icon: <Lock className="mr-2 h-5 w-5 shrink-0" />,
						label: t('SettingsDialog.trackerEdit.locked'),
						isActive: isTrackersAlwaysEditable,
						onSelect: () => setTrackersAlwaysEditable(true),
					},
				]}
			/>

			{/* Mobile UI Mode */}
			<MobileSettingsToggleGroup
				label={t('SettingsDialog.mobileFABMode.title')}
				options={[
					{
						icon: <PanelsRightBottom className="mr-2 h-5 w-5 shrink-0" />,
						label: t('SettingsDialog.mobileFABMode.bottomTabs'),
						isActive: !isMobileFABMode,
						onSelect: () => setMobileFABMode(false),
					},
					{
						icon: <SquareMenu className="mr-2 h-5 w-5 shrink-0" />,
						label: t('SettingsDialog.mobileFABMode.fab'),
						isActive: isMobileFABMode,
						onSelect: () => setMobileFABMode(true),
					},
				]}
			/>

			{/* Mobile Handedness */}
			<MobileSettingsToggleGroup
				label={t('SettingsDialog.mobileHandedness.title')}
				options={[
					{
						icon: <Hand className="w-8 h-8 -scale-x-100" />,
						label: t('SettingsDialog.mobileHandedness.left'),
						isActive: mobileHandedness === 'left',
						onSelect: () => setMobileHandedness('left'),
					},
					{
						icon: <Hand className="w-8 h-8" />,
						label: t('SettingsDialog.mobileHandedness.right'),
						isActive: mobileHandedness === 'right',
						onSelect: () => setMobileHandedness('right'),
					},
				]}
			/>

			{/* Gesture Tips */}
			<MobileSettingsToggleGroup
				label={t('SettingsDialog.gestureHints.title')}
				options={[
					{
						icon: <Eye className="mr-2 h-5 w-5 shrink-0" />,
						label: t('SettingsDialog.gestureHints.shown'),
						isActive: areGestureHintsEnabled,
						onSelect: () => setGestureHintsEnabled(true),
					},
					{
						icon: <EyeOff className="mr-2 h-5 w-5 shrink-0" />,
						label: t('SettingsDialog.gestureHints.hidden'),
						isActive: !areGestureHintsEnabled,
						onSelect: () => setGestureHintsEnabled(false),
					},
				]}
			/>

			{/* Replay gesture tips (re-arm the one-time hints) */}
			<div className="space-y-2">
				<Label className="text-sm font-semibold">{t('SettingsDialog.gestureHints.replayLabel')}</Label>
				<Button
					onClick={handleReplayGestureTips}
					variant="default"
					className="w-full h-12 text-base justify-start"
				>
					<Lightbulb className="mr-3 h-5 w-5 shrink-0" />
					<span className="flex-1 text-left">{t('SettingsDialog.gestureHints.replayButton')}</span>
					<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
				</Button>
			</div>
		</MobileSettingsSubScreen>
	);
}
