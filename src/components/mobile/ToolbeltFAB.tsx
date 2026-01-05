// -- React Imports --
import { useRef, useState, useLayoutEffect } from 'react';

// -- Component Imports --
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { Wrench, X } from 'lucide-react';

// -- Animation Imports --
import { motion, AnimatePresence } from 'framer-motion';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { ToolbeltAction } from '@/lib/types/toolbelt';



type SheetTab = 'trackers' | 'cards';

interface ToolbeltFABProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	itemActions: ToolbeltAction[];
	globalActions: ToolbeltAction[];
	activeTab?: SheetTab;
	isMenuFABExpanded?: boolean;
}



function useWindowHeight() {
   const [height, setHeight] = useState(0);
   useLayoutEffect(() => {
      const update = () => setHeight(window.innerHeight);
      update();
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
   }, []);
   return height;
}



export default function ToolbeltFAB({
	isOpen,
	onOpenChange,
	itemActions,
	globalActions,
	activeTab,
	isMenuFABExpanded
}: ToolbeltFABProps) {
	const allActions = [...globalActions, ...itemActions];
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [scrollY, setScrollY] = useState(0);
	const rafRef = useRef<number | null>(null);
   const windowHeight = useWindowHeight();

	const ITEM_HEIGHT = 60;
	const BOTTOM_OFFSET = 175;
   const FAB_HEIGHT_OFFSET = 80;

   const THUMB_ZONE_Y = windowHeight ? windowHeight - BOTTOM_OFFSET : 500;
	const MAX_SCALE_DISTANCE = 200;



	useLayoutEffect(() => {
		if (isOpen && scrollContainerRef.current && allActions.length > 0 && windowHeight > 0) {
			const middleIndex = Math.floor(allActions.length / 2);
         const targetScroll = middleIndex * ITEM_HEIGHT;
         scrollContainerRef.current.scrollTop = targetScroll;
         setScrollY(targetScroll);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const newScrollY = e.currentTarget.scrollTop;

		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
		}

		rafRef.current = requestAnimationFrame(() => {
			setScrollY(newScrollY);
			rafRef.current = null;
		});
	};

	const getItemTransform = (index: number) => {
		const currentScrollY = scrollY;
		const itemAbsoluteY = THUMB_ZONE_Y + (index * ITEM_HEIGHT);
      const viewportY = itemAbsoluteY - currentScrollY;
      const distanceFromThumb = Math.abs(viewportY - THUMB_ZONE_Y);
      const scale = Math.max(0.8, 1.05 - (distanceFromThumb / MAX_SCALE_DISTANCE) * 0.2);

		return { scale };
	};

	return (
		<>
			<AnimatePresence>
				{isOpen && (
					<>
						{/* Backdrop */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
							onClick={() => onOpenChange(false)}
						/>

						{/* Scrollable Action Buttons with Thumb-Zone Scaling */}
						{allActions.length > 0 && (
							<motion.div
								ref={scrollContainerRef}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								onScroll={handleScroll}
								className="fixed top-0 right-4 z-50 h-[calc(100vh-5rem)] w-64 overflow-y-auto overflow-x-visible scrollbar-hide perspective-1000"
								style={{
                           paddingTop: `${THUMB_ZONE_Y}px`,
                           paddingBottom: `${(windowHeight - FAB_HEIGHT_OFFSET) - THUMB_ZONE_Y - ITEM_HEIGHT}px`,
                           maskImage: 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)',
                           WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)'
                        }}
							>
								<div className="flex flex-col">
									{allActions.map((action, index) => {
										const Icon = action.icon;
										const { scale } = getItemTransform(index);

										return (
											<div
												key={action.id}
												style={{ height: ITEM_HEIGHT }}
											>
												<motion.div
													initial={{ opacity: 0, y: 20 }}
													animate={{ opacity: 1, y: 0 }}
													exit={{ opacity: 0, y: 20 }}
													transition={{
														opacity: { duration: 0.2 },
														y: {
															type: 'spring',
															damping: 25,
															stiffness: 300,
															delay: isOpen ? (allActions.length - index) * 0 : 0
														}
													}}
													className="h-full"
												>
													<div
														className="flex flex-row-reverse items-center gap-3 justify-start h-full"
														style={{
															transform: `scale(${scale})`,
															transformOrigin: 'right center',
															willChange: 'transform'
														}}
													>
														{/* Action button */}
														<button
															onClick={() => {
																action.onClick();
																onOpenChange(false);
															}}
															className={cn(
																"inline-flex items-center justify-center rounded-md h-11 w-11 shadow-lg",
																action.variant === 'destructive'
																	? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
																	: 'bg-primary text-primary-foreground hover:bg-primary/90'
															)}
														>
															<Icon className="h-5 w-5" />
														</button>

														{/* Action label */}
														<div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
															<span className="text-sm font-medium whitespace-nowrap">
																{action.label}
															</span>
														</div>
													</div>
												</motion.div>
											</div>
										);
									})}
								</div>
							</motion.div>
						)}
					</>
				)}
			</AnimatePresence>

			{/* Primary FAB Button - Hide when menu FAB is expanded */}
			{!isMenuFABExpanded && (
				<motion.div
					className={cn(
						"fixed z-50",
						isOpen
							? "bottom-4 right-4"
							: activeTab === 'cards'
								? "bottom-14 right-2"
								: "bottom-4 right-4"
					)}
					whileTap={{ scale: 0.95 }}
				>
					<IconButton
						variant="default"
						size="lg"
						onClick={() => onOpenChange(!isOpen)}
						className={cn(
							"h-10 w-10 shadow-2xl",
							allActions.length === 0 && "opacity-50 cursor-not-allowed"
						)}
						disabled={allActions.length === 0}
					>
						<motion.div
							animate={{ rotate: isOpen ? 90 : 0 }}
							transition={{ duration: 0.2 }}
						>
							{isOpen ? (
								<X className="h-6 w-6" />
							) : (
								<Wrench className="h-6 w-6" />
							)}
						</motion.div>
					</IconButton>
				</motion.div>
			)}
		</>
	);
}
