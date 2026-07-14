// -- React Imports --
import { useEffect, useState } from 'react';

// -- Other Library Imports --
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// -- Step Components --
import DesktopOnboardingWelcome from './DesktopOnboardingWelcome';
import DesktopOnboardingLanguage from './DesktopOnboardingLanguage';
import DesktopOnboardingAppearance from './DesktopOnboardingAppearance';
import DesktopOnboardingInterface from './DesktopOnboardingInterface';
import DesktopOnboardingReady from './DesktopOnboardingReady';



interface DesktopOnboardingProps {
	isOpen: boolean;
	onComplete: () => void;
}

// The desktop first-run flow, mirroring the mobile onboarding as a centered column on a full-screen
// wash rather than a full-bleed surface. Shared copy reuses the `MobileOnboarding.*` keys; only the
// desktop interface tour carries its own `DesktopOnboarding.*` strings.
type OnboardingStep = 'welcome' | 'language' | 'appearance' | 'interface' | 'ready';

const STEPS: OnboardingStep[] = ['welcome', 'language', 'appearance', 'interface', 'ready'];

export default function DesktopOnboarding({ isOpen, onComplete }: DesktopOnboardingProps) {
	const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
	const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
	const shouldReduceMotion = useReducedMotion();

	// The flow stays mounted between opens, so a replay from Settings must rewind to the first step.
	useEffect(() => {
		if (isOpen) {
			setCurrentStep('welcome');
			setDirection('forward');
		}
	}, [isOpen]);

	const currentIndex = STEPS.indexOf(currentStep);
	const isFirstStep = currentIndex === 0;
	const isLastStep = currentIndex === STEPS.length - 1;

	const handleNext = () => {
		if (!isLastStep) {
			setDirection('forward');
			setCurrentStep(STEPS[currentIndex + 1]);
		}
	};

	const handleBack = () => {
		if (!isFirstStep) {
			setDirection('backward');
			setCurrentStep(STEPS[currentIndex - 1]);
		}
	};

	// Skip and finish both complete first-run; the trigger records the flag either way.
	const handleSkip = () => onComplete();
	const handleComplete = () => onComplete();

	// A modest horizontal offset (not a full-width slide) reads better on the centered column; reduced
	// motion drops the x-travel and keeps a plain crossfade.
	const slideVariants = {
		enter: (dir: 'forward' | 'backward') => ({
			x: shouldReduceMotion ? 0 : dir === 'forward' ? 40 : -40,
			opacity: 0,
		}),
		center: {
			x: 0,
			opacity: 1,
		},
		exit: (dir: 'forward' | 'backward') => ({
			x: shouldReduceMotion ? 0 : dir === 'forward' ? -40 : 40,
			opacity: 0,
		}),
	};

	const renderStep = () => {
		switch (currentStep) {
			case 'welcome':
				return <DesktopOnboardingWelcome onNext={handleNext} onSkip={handleSkip} />;
			case 'language':
				return <DesktopOnboardingLanguage onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />;
			case 'appearance':
				return <DesktopOnboardingAppearance onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />;
			case 'interface':
				return <DesktopOnboardingInterface onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />;
			case 'ready':
				return <DesktopOnboardingReady onComplete={handleComplete} onBack={handleBack} />;
			default:
				return null;
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-100 bg-background flex flex-col">
			{/* Progress Dots */}
			<div className="flex justify-center gap-2 pt-6">
				{STEPS.map((step, index) => (
					<div
						key={step}
						className={`w-2 h-2 rounded-full transition-colors duration-300 ${
							index === currentIndex
								? 'bg-primary'
								: index < currentIndex
									? 'bg-primary/50'
									: 'bg-muted-foreground/30'
						}`}
					/>
				))}
			</div>

			{/* Step Content */}
			<div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
				<AnimatePresence mode="wait" custom={direction}>
					<motion.div
						key={currentStep}
						custom={direction}
						variants={slideVariants}
						initial="enter"
						animate="center"
						exit="exit"
						transition={{
							x: { type: 'spring', stiffness: 300, damping: 30 },
							opacity: { duration: 0.2 },
						}}
						className="w-full max-w-md"
					>
						{renderStep()}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}
