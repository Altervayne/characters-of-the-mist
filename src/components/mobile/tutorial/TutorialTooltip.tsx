// -- React Imports --
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion, AnimatePresence } from 'framer-motion';

// -- Component Imports --
import { Button } from '@/components/ui/button';

// -- Hook Imports --
import { useWindowSize } from '@/hooks/mobile/useWindowSize';

// -- Icon Imports --
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// -- Type Imports --
import type { TutorialStep } from '@/lib/mobile-tutorial-steps';



interface TutorialTooltipProps {
	step: TutorialStep;
	targetRect: DOMRect | null;
	currentStep: number;
	totalSteps: number;
	onNext: () => void;
	onBack: () => void;
	onSkip: () => void;
	isVisible: boolean;
}

export default function TutorialTooltip({
	step,
	targetRect,
	currentStep,
	totalSteps,
	onNext,
	onBack,
	onSkip,
	isVisible,
}: TutorialTooltipProps) {
	const { t } = useTranslation();
	const windowSize = useWindowSize();

	// Don't render until we have valid window dimensions
	if (windowSize.width === 0 || windowSize.height === 0) {
		return null;
	}

	// Calculate tooltip position based on target element and preference
	const tooltipStyle = useMemo(() => {
		const viewWidth = windowSize.width || window.innerWidth;
		const viewHeight = windowSize.height || window.innerHeight;
		const tooltipPadding = 16;
		const tooltipWidth = Math.min(Math.max(viewWidth - tooltipPadding * 2, 200), 320);
		const tooltipHeight = 220; // Approximate height for calculations
		const arrowOffset = 12;

		// Center position for full-screen overlays (no target)
		if (!targetRect || step.position === 'center') {
			// Calculate centered position manually to avoid transform conflicts with framer-motion
			const left = Math.max(tooltipPadding, (viewWidth - tooltipWidth) / 2);
			const top = Math.max(tooltipPadding, (viewHeight - tooltipHeight) / 2);
			return {
				position: 'fixed' as const,
				left: `${left}px`,
				top: `${top}px`,
				width: `${tooltipWidth}px`,
				maxWidth: `calc(100vw - ${tooltipPadding * 2}px)`,
			};
		}

		// Calculate available space above and below target
		const spaceAbove = targetRect.top;
		const spaceBelow = viewHeight - targetRect.bottom;

		// Determine best position based on available space
		// If step specifies position, try to honor it but fall back if not enough space
		let actualPosition: 'top' | 'bottom';
		if (step.position === 'bottom' && spaceBelow >= tooltipHeight + arrowOffset) {
			actualPosition = 'bottom';
		} else if (step.position === 'top' && spaceAbove >= tooltipHeight + arrowOffset) {
			actualPosition = 'top';
		} else if (spaceBelow >= spaceAbove) {
			// Default: choose whichever has more space
			actualPosition = 'bottom';
		} else {
			actualPosition = 'top';
		}

		// Calculate horizontal position - center the tooltip in the viewport
		const left = Math.max(tooltipPadding, (viewWidth - tooltipWidth) / 2);

		// Calculate vertical position with bounds checking
		let top: number;
		if (actualPosition === 'bottom') {
			top = targetRect.bottom + arrowOffset;
			// Ensure tooltip doesn't go off-screen at bottom
			const maxTop = viewHeight - tooltipHeight - tooltipPadding;
			top = Math.min(top, maxTop);
		} else {
			top = targetRect.top - arrowOffset - tooltipHeight;
		}
		// Always ensure tooltip stays within viewport
		top = Math.max(tooltipPadding, top);

		return {
			position: 'fixed' as const,
			left: `${left}px`,
			top: `${top}px`,
			width: `${tooltipWidth}px`,
		};
	}, [targetRect, step.position, windowSize]);

	const isFirstStep = currentStep === 0;
	const isLastStep = currentStep === totalSteps - 1;

	return (
		<AnimatePresence mode="wait">
			{isVisible && (
				<motion.div
					key={`tooltip-step-${currentStep}`}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 10 }}
					transition={{ duration: 0.3, delay: 0.15 }}
					className="fixed z-[102] bg-card rounded-xl shadow-2xl border border-border p-4 pointer-events-auto"
					style={tooltipStyle}
				>
					{/* Skip button */}
					<button
						onClick={onSkip}
						className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-muted transition-colors cursor-pointer"
						aria-label={t('MobileTutorial.controls.skip')}
					>
						<X className="w-4 h-4 text-muted-foreground" />
					</button>

					{/* Content */}
					<div className="pr-6">
						<h3 className="text-lg font-semibold mb-2">
							{t(step.titleKey)}
						</h3>
						<p className="text-sm text-muted-foreground mb-4">
							{t(step.descriptionKey)}
						</p>
					</div>

					{/* Progress indicator */}
					<div className="flex items-center justify-center gap-1.5 mb-4">
						{Array.from({ length: totalSteps }).map((_, index) => (
							<div
								key={index}
								className={`h-1.5 rounded-full transition-all ${
									index === currentStep
										? 'w-4 bg-primary'
										: index < currentStep
											? 'w-1.5 bg-primary/50'
											: 'w-1.5 bg-muted'
								}`}
							/>
						))}
					</div>

					{/* Navigation buttons */}
					<div className="flex items-center justify-between gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={onBack}
							disabled={isFirstStep}
							className="cursor-pointer"
						>
							<ChevronLeft className="w-4 h-4 mr-1" />
							{t('MobileTutorial.controls.back')}
						</Button>

						<Button
							size="sm"
							onClick={onNext}
							className="cursor-pointer"
						>
							{isLastStep ? t('MobileTutorial.controls.done') : t('MobileTutorial.controls.next')}
							{!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
						</Button>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
