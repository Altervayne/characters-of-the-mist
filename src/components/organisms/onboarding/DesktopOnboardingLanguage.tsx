// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import DesktopOnboardingNav from './DesktopOnboardingNav';

// -- Icon Imports --
import { Check } from 'lucide-react';

// -- Utils --
import { cn } from '@/lib/utils';



interface DesktopOnboardingLanguageProps {
	onNext: () => void;
	onBack: () => void;
	onSkip: () => void;
}

const LANGUAGES = [
	{ code: 'en', name: 'English', native: 'English' },
	{ code: 'fr', name: 'French', native: 'Français' },
	{ code: 'de', name: 'German', native: 'Deutsch' },
];

export default function DesktopOnboardingLanguage({ onNext, onBack, onSkip }: DesktopOnboardingLanguageProps) {
	const { t, i18n } = useTranslation();
	const currentLocale = i18n.language;

	return (
		<div className="flex flex-col">
			<div className="text-center mb-8">
				<h1 className="text-2xl font-bold mb-2">
					{t('MobileOnboarding.language.title')}
				</h1>
				<p className="text-muted-foreground">
					{t('MobileOnboarding.language.description')}
				</p>
			</div>

			<div className="flex flex-col gap-3">
				{LANGUAGES.map((lang) => (
					<button
						key={lang.code}
						onClick={() => i18n.changeLanguage(lang.code)}
						className={cn(
							"w-full p-4 rounded-xl border-2 transition-all cursor-pointer",
							"flex items-center justify-between",
							currentLocale === lang.code
								? "border-primary bg-primary/5"
								: "border-border bg-card hover:border-primary/50"
						)}
					>
						<div className="text-left">
							<p className="font-semibold text-lg">{lang.native}</p>
							<p className="text-sm text-muted-foreground">{lang.name}</p>
						</div>
						{currentLocale === lang.code && (
							<Check className="w-6 h-6 text-primary" />
						)}
					</button>
				))}
			</div>

			<DesktopOnboardingNav onNext={onNext} onBack={onBack} onSkip={onSkip} />
		</div>
	);
}
