// Onboarding Ready Step
// Final step with completion and tutorial offer

// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { ChevronLeft, Rocket, BookOpen, ThumbsUp } from 'lucide-react';



interface OnboardingReadyProps {
	onComplete: (startTutorial: boolean) => void;
	onBack: () => void;
}

export default function OnboardingReady({ onComplete, onBack }: OnboardingReadyProps) {
	const { t } = useTranslation();

	return (
		<div className="flex-1 flex flex-col items-center justify-center p-6 pt-16">
			{/* Icon */}
			<div className="mb-8">
				<div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
					<ThumbsUp className="w-12 h-12 text-primary" />
				</div>
			</div>

			{/* Title */}
			<h1 className="text-2xl font-bold text-center mb-4">
				{t('MobileOnboarding.ready.title')}
			</h1>

			{/* Description */}
			<p className="text-muted-foreground text-center mb-8 max-w-sm">
				{t('MobileOnboarding.ready.description')}
			</p>

			{/* Actions */}
			<div className="w-full max-w-xs space-y-3 mt-auto">
				<Button
					onClick={() => onComplete(false)}
					className="w-full h-12 text-base cursor-pointer"
				>
					<Rocket className="w-5 h-5 mr-2" />
					{t('MobileOnboarding.ready.startApp')}
				</Button>

				<Button
					variant="outline"
					onClick={() => onComplete(true)}
					className="w-full h-12 text-base cursor-pointer"
				>
					<BookOpen className="w-5 h-5 mr-2" />
					{t('MobileOnboarding.ready.takeTour')}
				</Button>

				{/* Tutorial reminder */}
				<p className="text-xs text-muted-foreground text-center pt-2">
					{t('MobileOnboarding.ready.tutorialReminder')}
				</p>
			</div>

			{/* Back button */}
			<div className="mt-8 mb-4">
				<Button
					variant="ghost"
					onClick={onBack}
					className="cursor-pointer"
				>
					<ChevronLeft className="w-4 h-4 mr-1" />
					{t('MobileOnboarding.navigation.back')}
				</Button>
			</div>
		</div>
	);
}
