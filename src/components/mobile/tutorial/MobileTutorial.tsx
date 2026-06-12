// -- React Imports --
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

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

	// Memoize so the steps array keeps a stable identity across this component's own
	// re-renders (e.g. rect updates); it only rebuilds when the parent passes a new
	// actions object or the mode changes.
	const steps = useMemo(() => getMobileTutorialSteps(actions, isFABMode), [actions, isFABMode]);
	const step = steps[currentStep];
	const totalSteps = steps.length;

	// Keep the latest steps reachable from the step-lifecycle effect without making
	// them one of its dependencies (the actions object - and therefore the steps -
	// is rebuilt whenever the parent re-renders).
	const stepsRef = useRef(steps);
	useEffect(() => {
		stepsRef.current = steps;
	});

	// Index of the step whose onEnter has run (and whose onExit is still pending),
	// so onEnter/onExit fire exactly once per step transition regardless of how
	// often this component re-renders.
	const enteredStepIndexRef = useRef<number | null>(null);

	// Update target rect when step changes
	const updateTargetRect = useCallback(() => {
		if (!step?.selector) {
			setTargetRect(null);
			return;
		}

		const element = document.querySelector(step.selector);
		if (!element) {
			setTargetRect(null);
			return;
		}

		// Body scroll is locked while the tour runs, so a target below the fold would
		// be spotlighted off-screen. Scroll it into view within its scroll container
		// first, then measure the settled position.
		const rect = element.getBoundingClientRect();
		const isOffScreen = rect.top < 0 || rect.bottom > window.innerHeight;
		if (isOffScreen) {
			element.scrollIntoView({ block: 'center' });
		}

		setTargetRect(element.getBoundingClientRect());
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

	// Step lifecycle: run the leaving step's onExit and the entering step's onEnter
	// exactly once per transition, then measure the target. Keyed on currentStep
	// (not the step object) so re-renders - rect updates, the rebuilt actions object
	// - never re-fire onEnter or re-push browser history.
	useEffect(() => {
		if (!isOpen || !isReady) return;

		const previousIndex = enteredStepIndexRef.current;
		if (previousIndex !== currentStep) {
			if (previousIndex !== null) {
				stepsRef.current[previousIndex]?.onExit?.();
			}
			enteredStepIndexRef.current = currentStep;
			stepsRef.current[currentStep]?.onEnter?.();
		}

		// Measure after navigation/state settles (150ms), then again after open and
		// scroll animations finish (e.g. the toolbelt side-panel slide).
		const measureTimer = setTimeout(() => updateTargetRect(), 150);
		const settleTimer = setTimeout(() => updateTargetRect(), 400);
		return () => {
			clearTimeout(measureTimer);
			clearTimeout(settleTimer);
		};
	}, [currentStep, isOpen, isReady, updateTargetRect]);

	// When the tour closes, run the active step's onExit (e.g. close a toolbelt
	// opened for its step) and reset so a re-open re-enters from the first step.
	useEffect(() => {
		if (isOpen) return;

		const index = enteredStepIndexRef.current;
		if (index !== null) {
			stepsRef.current[index]?.onExit?.();
			enteredStepIndexRef.current = null;
		}
	}, [isOpen]);

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
