// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// -- Type Imports --
import type { ThemeTypeUnion } from '@/lib/types/creation';



interface MobileAddCardThemeTypeSelectorProps {
	themeTypes: string[];
	themeType: ThemeTypeUnion;
	onChange: (value: string) => void;
}

/**
 * The theme-type selector shown for a CHARACTER_THEME: a vertical button group of
 * the game's theme types (Origin/Adventure/Greatness, Mythos/Logos, etc.). Purely
 * presentational - the parent supplies the available `themeTypes`, the selected
 * `themeType`, and an `onChange` invoked with the picked type. The list of types
 * is the parent's game-derived list, passed in unchanged.
 */
export function MobileAddCardThemeTypeSelector({ themeTypes, themeType, onChange }: MobileAddCardThemeTypeSelectorProps) {
	const { t } = useTranslation();
	const { t: tTypes } = useTranslation();

	return (
		<div className="space-y-2">
			<Label className="text-sm font-semibold">{t('CreateCardDialog.themeTypeLabel')}</Label>
			<div className="grid grid-cols-1 gap-2">
				{themeTypes.map(type => (
					<Button
						key={type}
						variant={themeType === type ? 'default' : 'outline'}
						onClick={() => onChange(type)}
						className="h-auto min-h-12 text-base justify-start"
					>
						{tTypes(type)}
					</Button>
				))}
			</div>
		</div>
	);
}
