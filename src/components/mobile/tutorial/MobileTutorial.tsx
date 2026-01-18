// Mobile Tutorial
// Main controller component for the mobile tutorial experience

// -- React Imports --
import { useState, useEffect, useCallback } from 'react';

// -- Component Imports --
import TutorialOverlay from './TutorialOverlay';
import TutorialTooltip from './TutorialTooltip';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Utils --
import { getMobileTutorialSteps, type TutorialActions } from '@/lib/mobile-tutorial-steps';



interface MobileTutorialProps {
	isOpen: boolean;
	onComplete: () => void;
	actions: TutorialActions;
}

export default function MobileTutorial({ isOpen, onComplete, actions }: MobileTutorialProps) {
	const [currentStep, setCurrentStep] = useState(0);
	const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
	const [isReady, setIsReady] = useState(false);

	const isFABMode = useAppSettingsStore((state) => state.isMobileFABMode);

	const steps = getMobileTutorialSteps(actions, isFABMode);
	const step = steps[currentStep];
	const totalSteps = steps.length;

	// Update target rect when step changes
	const updateTargetRect = useCallback(() => {
		if (!step?.selector) {
			setTargetRect(null);
			return;
		}

		const element = document.querySelector(step.selector);
		if (element) {
			setTargetRect(element.getBoundingClientRect());
		} else {
			setTargetRect(null);
		}
	}, [step?.selector]);

	// Initial setup when tutorial opens
	useEffect(() => {
		if (isOpen) {
			setCurrentStep(0);
			setIsReady(false);
			// Small delay to ensure component is mounted
			const timer = setTimeout(() => {
				setIsReady(true);
			}, 50);
			return () => clearTimeout(timer);
		} else {
			setIsReady(false);
		}
	}, [isOpen]);

	// Run step entry action and update target when step changes
	useEffect(() => {
		if (!isOpen || !isReady) return;

		// Execute onEnter action for this step
		if (step?.onEnter) {
			step.onEnter();
		}

		// Small delay to allow any navigation/state changes to complete
		const timer = setTimeout(() => {
			updateTargetRect();
		}, 150);

		return () => clearTimeout(timer);
	}, [currentStep, isOpen, isReady, step, updateTargetRect]);

	// Update rect on resize or scroll
	useEffect(() => {
		if (!isOpen || !isReady) return;

		const handleUpdate = () => {
			updateTargetRect();
		};

		window.addEventListener('resize', handleUpdate);
		window.addEventListener('scroll', handleUpdate, true);

		return () => {
			window.removeEventListener('resize', handleUpdate);
			window.removeEventListener('scroll', handleUpdate, true);
		};
	}, [isOpen, isReady, updateTargetRect]);

	const handleNext = () => {
		if (currentStep < totalSteps - 1) {
			setCurrentStep(prev => prev + 1);
		} else {
			onComplete();
		}
	};

	const handleBack = () => {
		if (currentStep > 0) {
			setCurrentStep(prev => prev - 1);
		}
	};

	const handleSkip = () => {
		onComplete();
	};

	// Prevent interaction with elements behind overlay (except highlighted element)
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	}, [isOpen]);

	if (!isOpen) return null;

	return (
		<>
			<TutorialOverlay
				targetRect={targetRect}
				padding={step?.highlightPadding ?? 8}
				isVisible={isReady}
			/>
			<TutorialTooltip
				step={step}
				targetRect={targetRect}
				currentStep={currentStep}
				totalSteps={totalSteps}
				onNext={handleNext}
				onBack={handleBack}
				onSkip={handleSkip}
				isVisible={isReady}
			/>
		</>
	);
}
