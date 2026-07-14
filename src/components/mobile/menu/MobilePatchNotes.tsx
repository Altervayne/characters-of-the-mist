// -- React Imports --
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { ChevronLeft, ChevronRight } from 'lucide-react';

// -- Component Imports --
import { IconButton } from '@/components/ui/icon-button';
import MarkdownContent from '@/components/molecules/MarkdownContent';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// -- Utils Imports --
import { patchNotes, latestPatchNotesVersion } from '@/lib/patch-notes';

// -- Store Imports --
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';

interface MobilePatchNotesProps {
	onBack?: () => void;
}

export default function MobilePatchNotes({ onBack }: MobilePatchNotesProps) {
	const { t } = useTranslation();
	const [currentIndex, setCurrentIndex] = useState(0);
	const { setLastReadPatchNotesVersion } = useAppSettingsActions();

	const selectedNote = patchNotes[currentIndex];
	const totalNotes = patchNotes.length;

	// Opening this screen IS reading the notes: clear the New! dot by marking the newest release read.
	useEffect(() => {
		setLastReadPatchNotesVersion(latestPatchNotesVersion);
	}, [setLastReadPatchNotesVersion]);

	const goToPrevious = () => {
		setCurrentIndex(current => (current < totalNotes - 1 ? current + 1 : current));
	};

	const goToNext = () => {
		setCurrentIndex(current => (current > 0 ? current - 1 : current));
	};

	const handleVersionSelect = (version: string) => {
		const index = patchNotes.findIndex(note => note.version === version);
		if (index !== -1) {
			setCurrentIndex(index);
		}
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
						<h2 className="text-2xl font-bold">{t('PatchNotesDialog.title')}</h2>
					</div>
				</div>
				<p className="text-sm text-muted-foreground mb-4">
					{t('PatchNotesDialog.description')}
				</p>

				{/* Version Selector */}
				<Select value={selectedNote?.version || ''} onValueChange={handleVersionSelect}>
					<SelectTrigger className="h-12 text-base">
						<SelectValue placeholder={t('PatchNotesDialog.selectVersion')} />
					</SelectTrigger>
					<SelectContent>
						{patchNotes.map(note => (
							<SelectItem key={note.version} value={note.version} className="text-base py-3">
								{t('PatchNotesDialog.versionLabel')} {note.version}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Content */}
			<div className="flex-1 px-6 overflow-y-auto">
				<div className="prose prose-sm max-w-none dark:prose-invert">
					{selectedNote?.content && <MarkdownContent content={selectedNote.content} />}
				</div>
			</div>

			{/* Navigation Footer */}
			<div className="p-6 border-t border-border bg-background">
				<div className="flex items-center justify-between gap-4">
					<IconButton
						onClick={goToPrevious}
						disabled={currentIndex === totalNotes - 1}
						size="lg"
						variant="outline"
						className="h-12 w-12"
					>
						<ChevronLeft className="h-6 w-6" />
					</IconButton>

					<div className="text-sm text-muted-foreground text-center">
						{t('PatchNotesDialog.pageCounterLabel')} {`${totalNotes - currentIndex}/${totalNotes}`}
					</div>

					<IconButton
						onClick={goToNext}
						disabled={currentIndex === 0}
						size="lg"
						variant="outline"
						className="h-12 w-12"
					>
						<ChevronRight className="h-6 w-6" />
					</IconButton>
				</div>
			</div>
		</div>
	);
}
