// Tutorial Overlay
// Creates a dark backdrop with a transparent spotlight around the target element

// -- React Imports --
import { useEffect, useState } from 'react';

// -- Other Library Imports --
import { motion, AnimatePresence } from 'framer-motion';



interface TutorialOverlayProps {
	targetRect: DOMRect | null;
	padding?: number;
	isVisible: boolean;
}

export default function TutorialOverlay({ targetRect, padding = 8, isVisible }: TutorialOverlayProps) {
	const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const updateSize = () => {
			setWindowSize({ width: window.innerWidth, height: window.innerHeight });
		};
		updateSize();
		window.addEventListener('resize', updateSize);
		return () => window.removeEventListener('resize', updateSize);
	}, []);

	// If no target, show full-screen blocking overlay
	if (!targetRect) {
		return (
			<AnimatePresence mode="wait">
				{isVisible && (
					<motion.div
						key="fullscreen-overlay"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3 }}
						className="fixed inset-0 bg-black/70 z-[100]"
						// Block all interactions - user must use tutorial controls
					/>
				)}
			</AnimatePresence>
		);
	}

	// Calculate spotlight dimensions with padding
	const spotlightLeft = Math.max(0, targetRect.left - padding);
	const spotlightTop = Math.max(0, targetRect.top - padding);
	const spotlightRight = Math.min(windowSize.width, targetRect.right + padding);
	const spotlightBottom = Math.min(windowSize.height, targetRect.bottom + padding);

	// Create a clip-path that excludes the spotlight area
	// This creates a "hole" in the overlay for the highlighted element
	const clipPath = `polygon(
		0% 0%,
		0% 100%,
		${spotlightLeft}px 100%,
		${spotlightLeft}px ${spotlightTop}px,
		${spotlightRight}px ${spotlightTop}px,
		${spotlightRight}px ${spotlightBottom}px,
		${spotlightLeft}px ${spotlightBottom}px,
		${spotlightLeft}px 100%,
		100% 100%,
		100% 0%
	)`;

	return (
		<AnimatePresence mode="wait">
			{isVisible && (
				<motion.div key="spotlight-overlay">
					{/* Full-screen blocking overlay - blocks all interactions */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3 }}
						className="fixed inset-0 z-[100]"
						// This invisible layer blocks all touch/click events
					/>

					{/* Dark overlay with spotlight cutout - visual only */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3 }}
						className="fixed inset-0 bg-black/70 z-[100] pointer-events-none"
						style={{ clipPath }}
					/>

					{/* Highlight border around spotlight */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						transition={{ duration: 0.3, delay: 0.1 }}
						className="fixed z-[101] pointer-events-none rounded-lg border-2 border-primary shadow-lg shadow-primary/20"
						style={{
							left: spotlightLeft,
							top: spotlightTop,
							width: spotlightRight - spotlightLeft,
							height: spotlightBottom - spotlightTop,
						}}
					/>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
