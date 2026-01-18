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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';

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
	Navigation,
	Menu,
	ChevronRight,
	ChevronLeft,
	MoveLeft,
	MoveRight,
	RotateCcw
} from 'lucide-react';

// -- Component Imports --
import { MigrationDialog } from '../organisms/MigrationDialog';

// -- Store and Hook Imports --
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useCharacterStore } from '@/lib/stores/characterStore';
import { useDrawerStore } from '@/lib/stores/drawerStore';

// -- Utils Imports --
import { IconButton } from '../ui/icon-button';

const locales = [
	{ code: 'en', name: 'English' },
	{ code: 'fr', name: 'Français' },
	{ code: 'de', name: 'Deutsch' },
];

interface ConfirmationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	title: string;
	description: string;
	confirmationText: string;
	confirmButtonText: string;
}

function ConfirmationDialog({ open, onOpenChange, onConfirm, title, description, confirmationText, confirmButtonText }: ConfirmationDialogProps) {
	const { t } = useTranslation();
	const [input, setInput] = useState("");

	const handleOpenChange = (isOpen: boolean) => {
		onOpenChange(isOpen);
		if (!isOpen) {
			setInput("");
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent className="border-2 border-dashed border-destructive">
				<AlertDialogHeader>
					<div className="flex items-center gap-2">
						<AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
						<AlertDialogTitle>{title}</AlertDialogTitle>
					</div>
					<AlertDialogDescription>
						{description}
						<p className="mt-2 text-foreground">
							{t('SettingsDialog.dangerZone.resetDialog.confirmationPrompt')}
						</p>
						<p className="w-full mt-1 text-center text-sm font-bold text-destructive">{confirmationText}</p>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<Input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder={confirmationText}
					className="border-foreground/50"
				/>
				<AlertDialogFooter>
					<AlertDialogCancel className="cursor-pointer">{t('SettingsDialog.dangerZone.resetDialog.cancel')}</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						disabled={input !== confirmationText}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
					>
						{confirmButtonText}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

interface MobileSettingsProps {
	onStartTour?: () => void;
	onRestartOnboarding?: () => void;
	onBack?: () => void;
}

export default function MobileSettings({ onStartTour, onRestartOnboarding, onBack }: MobileSettingsProps) {
	const { t, i18n } = useTranslation();
	const locale = i18n.language?.split('-')[0] || 'en';

	const { resolvedTheme, setTheme: setMode } = useTheme();

	const { theme: colorTheme, isSideBySideView, isTrackersAlwaysEditable, isMobileFABMode, mobileHandedness } = useAppSettingsStore();
	const { setTheme: setColorTheme, setSideBySideView, setTrackersAlwaysEditable, setMobileFABMode, setMobileHandedness } = useAppSettingsActions();

	const colorThemeOptions = ['theme-neutral', 'theme-legends', 'theme-otherscape', 'theme-city-of-mist'];

	const [isResetAppDialogOpen, setIsResetAppDialogOpen] = useState(false);
	const [isDeleteDrawerDialogOpen, setIsDeleteDrawerDialogOpen] = useState(false);
	const [isMigrationDialogOpen, setIsMigrationDialogOpen] = useState(false);

	const handleAppReset = () => {
		useCharacterStore.persist.clearStorage();
		useDrawerStore.persist.clearStorage();
		useAppSettingsStore.persist.clearStorage();
		setTimeout(() => window.location.reload(), 500);
		toast.success(t('Notifications.general.appReset'));
	};

	const handleDeleteDrawer = () => {
		useDrawerStore.persist.clearStorage();
		setTimeout(() => window.location.reload(), 500);
		toast.success(t('Notifications.drawer.deleted'));
	};

	const handleLocaleChange = (newLocale: string) => {
		i18n.changeLanguage(newLocale);
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

				<div className="flex-1 px-6 space-y-6">
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
					<div className="space-y-2">
						<Label className="text-sm font-semibold">{t('SettingsDialog.appearance')}</Label>
						<div className="grid grid-cols-2 gap-3">
							<Button
								variant={resolvedTheme === 'light' ? 'default' : 'outline'}
								onClick={() => setMode('light')}
								className="h-auto min-h-12 text-base whitespace-normal py-3"
							>
								<Sun className="mr-2 h-5 w-5 shrink-0" />
								<span className="text-center leading-tight">{t('SettingsDialog.light')}</span>
							</Button>
							<Button
								variant={resolvedTheme === 'dark' ? 'default' : 'outline'}
								onClick={() => setMode('dark')}
								className="h-auto min-h-12 text-base whitespace-normal py-3"
							>
								<Moon className="mr-2 h-5 w-5 shrink-0" />
								<span className="text-center leading-tight">{t('SettingsDialog.dark')}</span>
							</Button>
						</div>
					</div>

					{/* Card View Mode */}
					<div className="space-y-2">
						<Label className="text-sm font-semibold">{t('SettingsDialog.cardView.title')}</Label>
						<div className="grid grid-cols-2 gap-3">
							<Button
								variant={!isSideBySideView ? 'default' : 'outline'}
								onClick={() => setSideBySideView(false)}
								className="h-auto min-h-12 text-base whitespace-normal py-3"
							>
								<FlipHorizontal className="mr-2 h-5 w-5 shrink-0" />
								<span className="text-center leading-tight">{t('SettingsDialog.cardView.flipping')}</span>
							</Button>
							<Button
								variant={isSideBySideView ? 'default' : 'outline'}
								onClick={() => setSideBySideView(true)}
								className="h-auto min-h-12 text-base whitespace-normal py-3"
							>
								<BookOpen className="mr-2 h-5 w-5 shrink-0" />
								<span className="text-center leading-tight">{t('SettingsDialog.cardView.sideBySide')}</span>
							</Button>
						</div>
					</div>

					{/* Tracker Editing Mode */}
					<div className="space-y-2">
						<Label className="text-sm font-semibold">{t('SettingsDialog.trackerEdit.title')}</Label>
						<div className="grid grid-cols-2 gap-3">
							<Button
								variant={!isTrackersAlwaysEditable ? 'default' : 'outline'}
								onClick={() => setTrackersAlwaysEditable(false)}
								className="h-auto min-h-12 text-base whitespace-normal py-3"
							>
								<UnlockIcon className="mr-2 h-5 w-5 shrink-0" />
								<span className="text-center leading-tight">{t('SettingsDialog.trackerEdit.unlocked')}</span>
							</Button>
							<Button
								variant={isTrackersAlwaysEditable ? 'default' : 'outline'}
								onClick={() => setTrackersAlwaysEditable(true)}
								className="h-auto min-h-12 text-base whitespace-normal py-3"
							>
								<Lock className="mr-2 h-5 w-5 shrink-0" />
								<span className="text-center leading-tight">{t('SettingsDialog.trackerEdit.locked')}</span>
							</Button>
						</div>
					</div>

					{/* Mobile UI Mode */}
					<div className="space-y-2">
						<Label className="text-sm font-semibold">{t('SettingsDialog.mobileFABMode.title')}</Label>
						<div className="grid grid-cols-2 gap-3">
							<Button
								variant={!isMobileFABMode ? 'default' : 'outline'}
								onClick={() => setMobileFABMode(false)}
								className="h-auto min-h-12 text-base whitespace-normal py-3"
							>
								<Navigation className="mr-2 h-5 w-5 shrink-0" />
								<span className="text-center leading-tight">{t('SettingsDialog.mobileFABMode.bottomTabs')}</span>
							</Button>
							<Button
								variant={isMobileFABMode ? 'default' : 'outline'}
								onClick={() => setMobileFABMode(true)}
								className="h-auto min-h-12 text-base whitespace-normal py-3"
							>
								<Menu className="mr-2 h-5 w-5 shrink-0" />
								<span className="text-center leading-tight">{t('SettingsDialog.mobileFABMode.fab')}</span>
							</Button>
						</div>
					</div>

					{/* Mobile Handedness */}
					<div className="space-y-2">
						<Label className="text-sm font-semibold">{t('SettingsDialog.mobileHandedness.title')}</Label>
						<div className="grid grid-cols-2 gap-3">
							<Button
								variant={mobileHandedness === 'left' ? 'default' : 'outline'}
								onClick={() => setMobileHandedness('left')}
								className="h-auto min-h-12 text-base whitespace-normal py-3"
							>
								<MoveLeft className="mr-2 h-5 w-5 shrink-0" />
								<span className="text-center leading-tight">{t('SettingsDialog.mobileHandedness.left')}</span>
							</Button>
							<Button
								variant={mobileHandedness === 'right' ? 'default' : 'outline'}
								onClick={() => setMobileHandedness('right')}
								className="h-auto min-h-12 text-base whitespace-normal py-3"
							>
								<MoveRight className="mr-2 h-5 w-5 shrink-0" />
								<span className="text-center leading-tight">{t('SettingsDialog.mobileHandedness.right')}</span>
							</Button>
						</div>
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
								variant="outline"
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
						</div>
					</div>
				</div>
			</div>

			{/* Dialogs */}
			<MigrationDialog
				isOpen={isMigrationDialogOpen}
				onOpenChange={setIsMigrationDialogOpen}
			/>

			<ConfirmationDialog
				open={isDeleteDrawerDialogOpen}
				onOpenChange={setIsDeleteDrawerDialogOpen}
				onConfirm={handleDeleteDrawer}
				title={t('SettingsDialog.dangerZone.deleteDrawerDialog.title')}
				description={t('SettingsDialog.dangerZone.deleteDrawerDialog.description')}
				confirmationText="DELETE DRAWER"
				confirmButtonText={t('SettingsDialog.dangerZone.deleteDrawerDialog.confirm')}
			/>

			<ConfirmationDialog
				open={isResetAppDialogOpen}
				onOpenChange={setIsResetAppDialogOpen}
				onConfirm={handleAppReset}
				title={t('SettingsDialog.dangerZone.resetDialog.title')}
				description={t('SettingsDialog.dangerZone.resetDialog.description')}
				confirmationText="DELETE ALL MY APP DATA"
				confirmButtonText={t('SettingsDialog.dangerZone.resetDialog.confirm')}
			/>
		</>
	);
}
