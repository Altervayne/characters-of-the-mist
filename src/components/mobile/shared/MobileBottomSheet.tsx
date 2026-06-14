// -- React Imports --
import type { ReactNode } from 'react';

// -- Animation Imports --
import { motion, AnimatePresence } from 'framer-motion';

// -- Utils Imports --
import { cn } from '@/lib/utils';



interface MobileBottomSheetProps {
	/** Whether the sheet is shown. The primitive owns the enter/exit animation via AnimatePresence. */
	isOpen: boolean;
	/** Called when the backdrop is tapped. The caller decides whether to close immediately or defer (e.g. to let a parent menu finish its own exit). */
	onClose: () => void;
	/** The sheet's content (header, body, action buttons). Stays caller-specific. */
	children: ReactNode;
	/** When true, the sheet spans from near the top of the viewport (`top-20`) as a flex column, for scrollable content like a folder tree. Default false (content-height). */
	fullHeight?: boolean;
	/** Optional extra classes merged onto the sheet container, for one-off adjustments. */
	contentClassName?: string;
}

/**
 * The shared mobile bottom-sheet scaffold: a tap-to-dismiss backdrop plus a
 * spring-slide-up container with the standard sheet chrome (rounded top, top
 * border, shadow). It owns only the backdrop, the slide animation, and the
 * container chrome — every caller supplies its own header/body/buttons as
 * `children`.
 *
 * Replaces five hand-rolled copies of the same backdrop + `motion.div` slide.
 * The two differences across those copies are expressed as props rather than
 * forks: `fullHeight` for the tall scrollable folder picker, and the
 * caller-owned `onClose` (which may defer the actual close to let a parent
 * menu's exit animation finish).
 *
 * @param props - See {@link MobileBottomSheetProps}.
 *
 * @example
 * ```tsx
 * <MobileBottomSheet isOpen={isOpen} onClose={handleCancel}>
 *   <div className="p-4 pb-3 border-b border-border">
 *     <h2 className="text-lg font-semibold">{t('Drawer.Actions.addFolderTitle')}</h2>
 *   </div>
 *   <div className="p-4 space-y-4">{/* input + buttons *\/}</div>
 * </MobileBottomSheet>
 * ```
 */
export function MobileBottomSheet({
	isOpen,
	onClose,
	children,
	fullHeight = false,
	contentClassName,
}: MobileBottomSheetProps) {
	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 bg-black/50 layer-overlay"
						onClick={onClose}
					/>

					{/* Bottom Sheet */}
					<motion.div
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ type: 'spring', damping: 30, stiffness: 300 }}
						className={cn(
							"fixed border-t border-border bottom-0 left-0 right-0 layer-overlay bg-background rounded-t-2xl shadow-2xl",
							fullHeight && "top-20 flex flex-col",
							contentClassName
						)}
					>
						{children}
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
