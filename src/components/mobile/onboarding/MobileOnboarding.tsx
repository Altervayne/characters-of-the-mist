// -- React Imports --
import { useState } from 'react';

// -- Other Library Imports --
import { motion, AnimatePresence } from 'framer-motion';

// -- Step Components --
import OnboardingWelcome from './OnboardingWelcome';
import OnboardingLanguage from './OnboardingLanguage';
import OnboardingAppearance from './OnboardingAppearance';
import OnboardingInterface from './OnboardingInterface';
import OnboardingTips from './OnboardingTips';
import OnboardingReady from './OnboardingReady';



interface MobileOnboardingProps {
	isOpen: boolean;
	onComplete: (startTutorial: boolean) => void;
}

type OnboardingStep = 'welcome' | 'language' | 'appearance' | 'interface' | 'tips' | 'ready';

const STEPS: OnboardingStep[] = ['welcome', 'language', 'appearance', 'interface', 'tips', 'ready'];

export default function MobileOnboarding({ isOpen, onComplete }: MobileOnboardingProps) {
	const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
	const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

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

	const handleSkip = () => {
		// Skip to completion with default settings
		onComplete(false);
	};

	const handleComplete = (startTutorial: boolean) => {
		onComplete(startTutorial);
	};

	// Animation variants for step transitions
	const slideVariants = {
		enter: (dir: 'forward' | 'backward') => ({
			x: dir === 'forward' ? '100%' : '-100%',
			opacity: 0,
		}),
		center: {
			x: 0,
			opacity: 1,
		},
		exit: (dir: 'forward' | 'backward') => ({
			x: dir === 'forward' ? '-100%' : '100%',
			opacity: 0,
		}),
	};

	const renderStep = () => {
		switch (currentStep) {
			case 'welcome':
				return (
					<OnboardingWelcome
						onNext={handleNext}
						onSkip={handleSkip}
					/>
				);
			case 'language':
				return (
					<OnboardingLanguage
						onNext={handleNext}
						onBack={handleBack}
						onSkip={handleSkip}
					/>
				);
			case 'appearance':
				return (
					<OnboardingAppearance
						onNext={handleNext}
						onBack={handleBack}
						onSkip={handleSkip}
					/>
				);
			case 'interface':
				return (
					<OnboardingInterface
						onNext={handleNext}
						onBack={handleBack}
						onSkip={handleSkip}
					/>
				);
			case 'tips':
				return (
					<OnboardingTips
						onNext={handleNext}
						onBack={handleBack}
						onSkip={handleSkip}
					/>
				);
			case 'ready':
				return (
					<OnboardingReady
						onComplete={handleComplete}
						onBack={handleBack}
					/>
				);
			default:
				return null;
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-100 bg-background">
			{/* Progress Dots */}
			<div className="absolute top-6 left-0 right-0 flex justify-center gap-2 z-10">
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
					className="absolute inset-0 flex flex-col overflow-y-auto"
				>
					{renderStep()}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
