// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import DesktopOnboardingNav from './DesktopOnboardingNav';

// -- Icon Imports --
import { Check } from 'lucide-react';

// -- Utils --
import { cn } from '@/lib/utils';

// -- Localization Imports --
import { LOCALES } from '@/i18n/locales';



interface DesktopOnboardingLanguageProps {
	onNext: () => void;
	onBack: () => void;
	onSkip: () => void;
}

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
				{LOCALES.map((lang) => (
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
							<p className="font-semibold text-lg">{lang.nativeName}</p>
							<p className="text-sm text-muted-foreground">{lang.englishName}</p>
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
