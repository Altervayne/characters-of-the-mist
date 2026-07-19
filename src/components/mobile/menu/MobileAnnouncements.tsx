// -- React Imports --
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

// -- Icon Imports --
import { ChevronLeft, RotateCcw } from 'lucide-react';

// -- Component Imports --
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import MarkdownContent from '@/components/molecules/MarkdownContent';

// -- Store and Utils Imports --
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { announcements, rewindWatermarkFor } from '@/lib/announcements';

interface MobileAnnouncementsProps {
	onBack?: () => void;
}

/**
 * The mobile Announcements history: every past notice, newest-first, to re-read. Read-only - it never touches
 * the watermark (the banner is the sole acknowledgment path), so the New! dot persists until the banner is dismissed.
 */
export default function MobileAnnouncements({ onBack }: MobileAnnouncementsProps) {
	const { t } = useTranslation();
	const { setLastSeenAnnouncementId } = useAppSettingsActions();

	const rewind = (id: string) => {
		setLastSeenAnnouncementId(rewindWatermarkFor(id));
		toast.success(t('AnnouncementsSettings.rewound'));
	};

	return (
		<div className="h-full flex flex-col overflow-y-auto pt-safe">
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
						<h2 className="text-2xl font-bold">{t('SettingsShell.sections.announcements')}</h2>
					</div>
				</div>
				<p className="text-sm text-muted-foreground">
					{t('AnnouncementsSettings.description')}
				</p>
			</div>

			<div className="flex-1 px-6 pb-[calc(2rem_+_env(safe-area-inset-bottom))] overflow-y-auto">
				{announcements.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t('AnnouncementsSettings.empty')}</p>
				) : (
					<ul className="flex flex-col gap-3">
						{announcements.map((announcement) => (
							<li key={announcement.id} className="rounded-lg border border-border bg-card p-4">
								<div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{announcement.date}</div>
								<h3 className="text-base font-semibold text-foreground">{announcement.title}</h3>
								<div className="mt-1 [&_p]:mb-0">
									<MarkdownContent content={announcement.body} />
								</div>
								<Button variant="outline" size="sm" onClick={() => rewind(announcement.id)} className="mt-3 cursor-pointer">
									<RotateCcw className="mr-1 h-3.5 w-3.5" />
									{t('AnnouncementsSettings.rewind')}
								</Button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
