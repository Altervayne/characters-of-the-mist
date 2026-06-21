// -- React Imports --
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// -- Icon Imports --
import {
	Sun,
	Moon,
	BookOpen,
	FlipHorizontal,
	AlertTriangle,
	Trash2,
	OctagonMinus,
	DatabaseBackup,
	PlayCircle,
	Lock,
	UnlockIcon,
	ChevronRight,
	ChevronLeft,
	RotateCcw,
   Hand,
   SquareMenu,
   PanelsRightBottom,
   Eye,
   EyeOff,
   Lightbulb
} from 'lucide-react';

// -- Component Imports --
import { MigrationDialog } from '@/components/organisms/dialogs/MigrationDialog';
import { LegacyDrawerBackupDialog } from '@/components/organisms/dialogs/LegacyDrawerBackupDialog';
import { LegacyCharacterBackupDialog } from '@/components/organisms/dialogs/LegacyCharacterBackupDialog';
import { MobileSettingsConfirmationDialog } from '@/components/mobile/menu/MobileSettingsConfirmationDialog';
import { MobileSettingsToggleGroup } from '@/components/mobile/menu/MobileSettingsToggleGroup';

// -- Store and Hook Imports --
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { clearAllCharacterData } from '@/lib/character/characterRepository';
import { clearAllAssets } from '@/lib/assets/assetRepository';
import { clearWorkspace } from '@/lib/character/workspaceSession';
import { clearAllDrawerData } from '@/lib/drawer/drawerRepository';
import { drawerCommandEngine } from '@/lib/drawer/drawerCommandEngine';
import { getLegacyBlobRemovalState } from '@/lib/drawer/runDrawerMigration';
import { getCharacterLegacyBlobRemovalState } from '@/lib/character/runCharacterMigration';
import { useLegacyBlobRemovable } from '@/hooks/useLegacyBlobRemovable';

// -- Utils Imports --
import { IconButton } from '@/components/ui/icon-button';

const locales = [
	{ code: 'en', name: 'English' },
	{ code: 'fr', name: 'Français' },
	{ code: 'de', name: 'Deutsch' },
];

interface MobileSettingsProps {
	onStartTour?: () => void;
	onRestartOnboarding?: () => void;
	onBack?: () => void;
}

export default function MobileSettings({ onStartTour, onRestartOnboarding, onBack }: MobileSettingsProps) {
	const { t, i18n } = useTranslation();
	const locale = i18n.language?.split('-')[0] || 'en';

	const { resolvedTheme, setTheme: setMode } = useTheme();

	const { theme: colorTheme, isSideBySideView, isTrackersAlwaysEditable, isMobileFABMode, mobileHandedness, areGestureHintsEnabled } = useAppSettingsStore();
	const { setTheme: setColorTheme, setSideBySideView, setTrackersAlwaysEditable, setMobileFABMode, setMobileHandedness, setGestureHintsEnabled, setHasSeenTrackerSelectHint, setHasSeenDrawerMenuHint } = useAppSettingsActions();

	const colorThemeOptions = ['theme-neutral', 'theme-legends', 'theme-otherscape', 'theme-city-of-mist'];

	const [isResetAppDialogOpen, setIsResetAppDialogOpen] = useState(false);
	const [isDeleteDrawerDialogOpen, setIsDeleteDrawerDialogOpen] = useState(false);
	const [isMigrationDialogOpen, setIsMigrationDialogOpen] = useState(false);
	const [isLegacyBackupDialogOpen, setIsLegacyBackupDialogOpen] = useState(false);
	const [isLegacyCharacterBackupDialogOpen, setIsLegacyCharacterBackupDialogOpen] = useState(false);
	const { removable: legacyBlobRemovable, refresh: refreshLegacyBlobRemovable } = useLegacyBlobRemovable(getLegacyBlobRemovalState);
	const { removable: legacyCharacterRemovable, refresh: refreshLegacyCharacterRemovable } = useLegacyBlobRemovable(getCharacterLegacyBlobRemovalState);

	const handleAppReset = async () => {
		await clearAllCharacterData();
		await clearAllAssets();
		clearWorkspace();
		await clearAllDrawerData();
		drawerCommandEngine.clear();
		useAppSettingsStore.persist.clearStorage();
		setTimeout(() => window.location.reload(), 500);
		toast.success(t('Notifications.general.appReset'));
	};

	const handleDeleteDrawer = async () => {
		await clearAllDrawerData();
		drawerCommandEngine.clear();
		setTimeout(() => window.location.reload(), 500);
		toast.success(t('Notifications.drawer.deleted'));
	};

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

	const formatThemeName = (themeName: string) => {
		if (themeName === 'theme-city-of-mist') return "City of Mist";
		return themeName.replace('theme-', '').charAt(0).toUpperCase() + themeName.slice(7);
	};

	return (
		<>
			<div className="h-full flex flex-col overflow-y-auto">
				<div className="p-6">
					<div className="flex items-center gap-3 mb-4">
						{onBack && (
							<IconButton
								variant="ghost"
								size="lg"
								onClick={onBack}
								className="h-10 w-10 p-0"
							>
								<ChevronLeft className="h-8 w-8" />
							</IconButton>
						)}
						<div className="flex-1">
							<h2 className="text-2xl font-bold">{t('SettingsDialog.title')}</h2>
						</div>
					</div>
					<p className="text-sm text-muted-foreground">
						{t('SettingsDialog.description')}
					</p>
				</div>

				<div className="flex-1 px-6 pb-6 space-y-6">
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

					{/* Accent Color */}
					<div className="space-y-2">
						<Label className="text-sm font-semibold">{t('SettingsDialog.accentColor')}</Label>
						<Select value={colorTheme} onValueChange={setColorTheme}>
							<SelectTrigger className="h-12 text-base">
								<SelectValue placeholder={t('SettingsDialog.selectThemePlaceholder')} />
							</SelectTrigger>
							<SelectContent>
								{colorThemeOptions.map(themeName => (
									<SelectItem key={themeName} value={themeName} className="text-base py-3">
										{formatThemeName(themeName)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Appearance (Light/Dark) */}
					<MobileSettingsToggleGroup
						label={t('SettingsDialog.appearance')}
						options={[
							{
								icon: <Sun className="mr-2 h-5 w-5 shrink-0" />,
								label: t('SettingsDialog.light'),
								isActive: resolvedTheme === 'light',
								onSelect: () => setMode('light'),
							},
							{
								icon: <Moon className="mr-2 h-5 w-5 shrink-0" />,
								label: t('SettingsDialog.dark'),
								isActive: resolvedTheme === 'dark',
								onSelect: () => setMode('dark'),
							},
						]}
					/>

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

					{/* Migration */}
					<div className="space-y-2">
						<Label className="text-sm font-semibold">{t('SettingsDialog.migration.label')}</Label>
						<Button
							onClick={() => setIsMigrationDialogOpen(true)}
							variant="default"
							className="w-full h-12 text-base justify-start"
						>
							<DatabaseBackup className="mr-3 h-5 w-5 shrink-0" />
							<span className="flex-1 text-left">{t('SettingsDialog.migration.button')}</span>
							<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
						</Button>
					</div>

					{/* Tutorial */}
					{onStartTour && (
						<div className="space-y-2">
							<Label className="text-sm font-semibold">{t('SettingsDialog.tutorial')}</Label>
							<Button
								onClick={onStartTour}
								variant="default"
								className="w-full h-12 text-base justify-start"
							>
								<PlayCircle className="mr-3 h-5 w-5 shrink-0" />
								<span className="flex-1 text-left">{t('SettingsDialog.tutorialButton')}</span>
								<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
							</Button>
						</div>
					)}

					{/* Restart Onboarding */}
					{onRestartOnboarding && (
						<div className="space-y-2">
							<Label className="text-sm font-semibold">{t('SettingsDialog.onboarding')}</Label>
							<Button
								onClick={onRestartOnboarding}
								variant="default"
								className="w-full h-12 text-base justify-start"
							>
								<RotateCcw className="mr-3 h-5 w-5 shrink-0" />
								<span className="flex-1 text-left">{t('SettingsDialog.onboardingButton')}</span>
								<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
							</Button>
						</div>
					)}

					{/* Danger Zone */}
					<div className="space-y-3 rounded-lg border-2 border-destructive bg-destructive/5 p-4 mt-8">
						<div className="flex items-start gap-3">
							<AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
							<div>
								<h3 className="font-semibold text-base">{t('SettingsDialog.dangerZone.title')}</h3>
								<p className="text-sm text-muted-foreground mt-1">{t('SettingsDialog.dangerZone.description')}</p>
							</div>
						</div>

						<div className="space-y-2 mt-4">
							<Button
								variant="destructive"
								className="w-full h-12 text-base justify-start"
								onClick={() => setIsDeleteDrawerDialogOpen(true)}
							>
								<Trash2 className="mr-3 h-5 w-5 shrink-0" />
								<span>{t('SettingsDialog.dangerZone.deleteDrawerButton')}</span>
							</Button>
							<Button
								variant="destructive"
								className="w-full h-12 text-base justify-start"
								onClick={() => setIsResetAppDialogOpen(true)}
							>
								<OctagonMinus className="mr-3 h-5 w-5 shrink-0" />
								<span>{t('SettingsDialog.dangerZone.resetButton')}</span>
							</Button>
							{/* Legacy backup cleanup - shown only when the migration is
							    verified and the blob is still present; removal is gated on a
							    backup export + explicit confirm inside the dialog. */}
							{legacyBlobRemovable && (
								<Button
									variant="outline"
									className="w-full h-12 text-base justify-start"
									onClick={() => setIsLegacyBackupDialogOpen(true)}
								>
									<span className="truncate">{t('SettingsDialog.legacyBackup.actionLabel')}</span>
								</Button>
							)}
							{legacyCharacterRemovable && (
								<Button
									variant="outline"
									className="w-full h-12 text-base justify-start"
									onClick={() => setIsLegacyCharacterBackupDialogOpen(true)}
								>
									<span className="truncate">{t('SettingsDialog.legacyCharacterBackup.actionLabel')}</span>
								</Button>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Dialogs */}
			<MigrationDialog
				isOpen={isMigrationDialogOpen}
				onOpenChange={setIsMigrationDialogOpen}
			/>

			<MobileSettingsConfirmationDialog
				open={isDeleteDrawerDialogOpen}
				onOpenChange={setIsDeleteDrawerDialogOpen}
				onConfirm={handleDeleteDrawer}
				title={t('SettingsDialog.dangerZone.deleteDrawerDialog.title')}
				description={t('SettingsDialog.dangerZone.deleteDrawerDialog.description')}
				confirmationText="DELETE DRAWER"
				confirmButtonText={t('SettingsDialog.dangerZone.deleteDrawerDialog.confirm')}
			/>

			<MobileSettingsConfirmationDialog
				open={isResetAppDialogOpen}
				onOpenChange={setIsResetAppDialogOpen}
				onConfirm={handleAppReset}
				title={t('SettingsDialog.dangerZone.resetDialog.title')}
				description={t('SettingsDialog.dangerZone.resetDialog.description')}
				confirmationText="DELETE ALL MY APP DATA"
				confirmButtonText={t('SettingsDialog.dangerZone.resetDialog.confirm')}
			/>

			<LegacyDrawerBackupDialog
				isOpen={isLegacyBackupDialogOpen}
				onOpenChange={setIsLegacyBackupDialogOpen}
				onRemoved={refreshLegacyBlobRemovable}
			/>

			<LegacyCharacterBackupDialog
				isOpen={isLegacyCharacterBackupDialogOpen}
				onOpenChange={setIsLegacyCharacterBackupDialogOpen}
				onRemoved={refreshLegacyCharacterRemovable}
			/>
		</>
	);
}
