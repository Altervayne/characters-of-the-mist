// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { ChevronLeft, Rocket, ThumbsUp } from 'lucide-react';



interface DesktopOnboardingReadyProps {
	onComplete: () => void;
	onBack: () => void;
}

export default function DesktopOnboardingReady({ onComplete, onBack }: DesktopOnboardingReadyProps) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col items-center text-center">
			{/* Badge */}
			<div className="mb-8 w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
				<ThumbsUp className="w-12 h-12 text-primary" />
			</div>

			<h1 className="text-2xl font-bold mb-4">
				{t('MobileOnboarding.ready.title')}
			</h1>

			<p className="text-muted-foreground mb-8 max-w-sm">
				{t('MobileOnboarding.ready.description')}
			</p>

			<div className="w-full max-w-xs space-y-3">
				<Button
					onClick={onComplete}
					className="w-full h-12 text-base cursor-pointer"
				>
					<Rocket className="w-5 h-5 mr-2" />
					{t('MobileOnboarding.ready.startApp')}
				</Button>

				{/*
				 * Tour offer seam: once the tutorial engine and the `desktop.navigation` tutorial land, add a
				 * second "Take the tour" button here that finishes onboarding and starts that tutorial, mirroring
				 * the mobile Ready step's two-button pattern. Deliberately a single finish action for now.
				 */}
			</div>

			<div className="mt-8">
				<Button variant="ghost" onClick={onBack} className="cursor-pointer">
					<ChevronLeft className="w-4 h-4 mr-1" />
					{t('MobileOnboarding.navigation.back')}
				</Button>
			</div>
		</div>
	);
}
