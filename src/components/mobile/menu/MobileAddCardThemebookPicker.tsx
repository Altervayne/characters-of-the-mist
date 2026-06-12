// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// -- Icon Imports --
import { Check } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { ThemeTypeUnion } from '@/lib/types/creation';



interface MobileAddCardThemebookOption {
	value: string;
	key: string;
}

interface MobileAddCardThemebookPickerProps {
	searchQuery: string;
	setSearchQuery: (value: string) => void;
	filteredThemebooks: MobileAddCardThemebookOption[];
	themeType: ThemeTypeUnion;
	themebook: string;
	onSelect: (book: MobileAddCardThemebookOption) => void;
}

/**
 * The themebook picker for a CHARACTER_THEME: a search input plus a scrollable
 * list of the (already-filtered) themebooks, with a check mark and highlight on
 * the currently-selected one. Purely presentational - the parent owns the search
 * query and the selection and does the filtering; this renders the supplied
 * `filteredThemebooks` and reports a pick via `onSelect`. The list only shows once
 * a `themeType` is chosen, and the empty result shows a "not found" message.
 */
export function MobileAddCardThemebookPicker({ searchQuery, setSearchQuery, filteredThemebooks, themeType, themebook, onSelect }: MobileAddCardThemebookPickerProps) {
	const { t } = useTranslation();
	const { t: tTheme } = useTranslation();

	return (
		<div className="space-y-2">
			<Label className="text-sm font-semibold">{t('CreateCardDialog.themebookLabel')}</Label>

			{/* Search Input */}
			<Input
				type="text"
				placeholder={t('CreateCardDialog.searchThemebookPlaceholder')}
				value={searchQuery}
				onChange={(e) => setSearchQuery(e.target.value)}
				disabled={!themeType}
				className="text-base"
			/>

			{/* Themebook List */}
			{themeType && (
				<div className="max-h-64 overflow-y-auto border border-border rounded-md">
					{filteredThemebooks.length > 0 ? (
						filteredThemebooks.map((book) => (
							<button
								key={book.value}
								onClick={() => onSelect(book)}
								className={cn(
									"w-full px-4 py-3 text-left text-base transition-colors flex items-center gap-3",
									themebook.toLowerCase() === book.value.toLowerCase()
										? "bg-primary text-primary-foreground"
										: "hover:bg-muted"
								)}
							>
								<Check
									className={cn(
										"h-5 w-5 shrink-0",
										themebook.toLowerCase() === book.value.toLowerCase() ? "opacity-100" : "opacity-0"
									)}
								/>
								<span>{tTheme(book.key as string)}</span>
							</button>
						))
					) : (
						<div className="px-4 py-8 text-center text-muted-foreground">
							{t('CreateCardDialog.noThemebookFound')}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
