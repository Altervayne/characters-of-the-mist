// -- React Imports --
import { useRef, useState, useLayoutEffect } from 'react';

// -- Component Imports --
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { Wrench, X } from 'lucide-react';

// -- Animation Imports --
import { motion, AnimatePresence } from 'framer-motion';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Hook Imports --
import { useWindowHeight } from '@/hooks/mobile/useWindowHeight';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getFloatingBottom } from '@/lib/utils/mobileFloating';

// -- Type Imports --
import type { ToolbeltAction, ToolbeltGroup } from '@/lib/types/toolbelt';



// Grouping in the FAB ring is expressed by ORDER alone (no header rows, so the
// index-based measurement math stays on a flat, uniform-height list): edit, then
// add, then workspace, with the context (item) actions last where they've always sat.
const GROUP_ORDER: Record<ToolbeltGroup, number> = { edit: 0, add: 1, workspace: 2, item: 3 };



type SheetTab = 'trackers' | 'cards';

interface ToolbeltFABProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	itemActions: ToolbeltAction[];
	globalActions: ToolbeltAction[];
	activeTab?: SheetTab;
	isMenuFABExpanded?: boolean;
}



export default function ToolbeltFAB({
	isOpen,
	onOpenChange,
	itemActions,
	globalActions,
	activeTab,
	isMenuFABExpanded
}: ToolbeltFABProps) {
	const mobileHandedness = useAppSettingsStore((state) => state.mobileHandedness);
	const isLeft = mobileHandedness === 'left';
	// Stable sort keeps each group's internal order; the list stays flat and uniform-height,
	// so the center-snap / scale / padding math below is unaffected.
	const allActions = [...globalActions, ...itemActions].sort(
		(a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group]
	);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [scrollY, setScrollY] = useState(0);
	const rafRef = useRef<number | null>(null);
   const windowHeight = useWindowHeight();

	// Distinguish a deliberate tap on the ring's empty area (which closes the
	// toolbelt) from a scroll gesture through the thumb-zone list (which must
	// not). We remember where the pointer went down and whether the list scrolled
	// during the interaction; a tap that scrolled or travelled beyond the slop is
	// treated as scroll-intent and does not close.
	const ringPointerDownYRef = useRef<number | null>(null);
	const ringScrolledRef = useRef(false);
	const RING_TAP_SLOP = 10;

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
		// Any scroll during the current touch marks it as scroll-intent.
		ringScrolledRef.current = true;

		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
		}

		rafRef.current = requestAnimationFrame(() => {
			setScrollY(newScrollY);
			rafRef.current = null;
		});
	};

	const handleRingPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		ringPointerDownYRef.current = e.clientY;
		ringScrolledRef.current = false;
	};

	const handleRingClick = (e: React.MouseEvent<HTMLDivElement>) => {
		const travelled = ringPointerDownYRef.current === null
			? 0
			: Math.abs(e.clientY - ringPointerDownYRef.current);
		// Ignore taps that scrolled the list or travelled past the slop; only a
		// deliberate, stationary tap on the ring's empty area closes the toolbelt.
		if (ringScrolledRef.current || travelled > RING_TAP_SLOP) return;
		onOpenChange(false);
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
							className="fixed inset-0 bg-black/50 backdrop-blur-sm layer-backdrop"
							onClick={() => onOpenChange(!isOpen)}
						/>

						{/* Scrollable Action Buttons with Thumb-Zone Scaling (globalActions is always non-empty) */}
							<motion.div
								ref={scrollContainerRef}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								onScroll={handleScroll}
                        onPointerDown={handleRingPointerDown}
                        onClick={handleRingClick}
								// Full-width so labels are never clipped: an element with
								// `overflow-y-auto` forces its `overflow-x` to compute to `auto`
								// too, so the old `w-64` + `overflow-x-visible` clipped
								// any label wider than 16rem. Spanning the viewport (with `px-4`
								// edge insets) keeps vertical scroll and thumb-zone scaling intact
								// while giving labels the whole width to extend into; the inner
								// `items-start`/`items-end` still anchors the rows to the handed edge.
								className="fixed inset-x-0 top-0 px-4 layer-panel h-[calc(100vh-5rem)] overflow-y-auto scrollbar-hide perspective-1000"
								style={{
                           paddingTop: `${THUMB_ZONE_Y}px`,
                           paddingBottom: `${(windowHeight - FAB_HEIGHT_OFFSET) - THUMB_ZONE_Y - ITEM_HEIGHT}px`,
                           maskImage: 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)',
                           WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)'
                        }}
							>
								<div className={cn(
									"flex flex-col w-full",
									isLeft ? "items-start" : "items-end"
								)}>
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
													<button
														className={cn(
															"flex items-center gap-3 h-full",
															isLeft ? "justify-start flex-row" : "justify-end flex-row-reverse"
														)}
                                          onClick={(e) => {
                                             e.stopPropagation()
                                             action.onClick();
                                             onOpenChange(false);
                                          }}
														style={{
															transform: `scale(${scale})`,
															transformOrigin: isLeft ? 'left center' : 'right center',
															willChange: 'transform'
														}}
													>
														{/* Action button */}
														<div
															className={cn(
																"inline-flex items-center justify-center rounded-md h-11 w-11 shadow-lg shrink-0",
																action.variant === 'destructive'
																	? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
																	: 'bg-primary text-primary-foreground hover:bg-primary/90'
															)}
														>
															<Icon className="h-5 w-5" />
														</div>

														{/* Action label. Capped to the width left after the icon,
														    gap, and the container's edge insets (44px icon + 12px
														    gap + 2x16px px-4 = 5.5rem) and allowed to wrap, so even a
														    pathologically long label or translation stays within the
														    viewport instead of clipping. */}
														<div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg shrink-0 max-w-[calc(100vw-5.5rem)]">
															<span className="text-sm font-medium">
																{action.label}
															</span>
														</div>
													</button>
												</motion.div>
											</div>
										);
									})}
								</div>
							</motion.div>
					</>
				)}
			</AnimatePresence>

			{/* Primary FAB Button - Hide when menu FAB is expanded */}
			{!isMenuFABExpanded && (
				<motion.div
					className={cn(
						// Single resting inset on every tab; the card yields room for the FAB
						// on the cards tab (see MobileCardArea's FAB_CLEARANCE_SHIFT) instead of
						// the FAB hopping inward here.
						"fixed layer-panel",
						isLeft ? "left-4" : "right-4"
					)}
					// Stagger 1 keeps the toolbelt FAB clear of the navigation FAB (stagger 0)
					// in FAB mode; both ride above the card nav bar on the cards tab.
					style={{ bottom: getFloatingBottom({ clearsCardsNavBar: !isOpen && activeTab === 'cards', stagger: isOpen ? 0 : 1 }) }}
					whileTap={{ scale: 0.95 }}
				>
					<IconButton
						variant="default"
						size="lg"
						onClick={() => onOpenChange(!isOpen)}
						data-tutorial="toolbelt"
						className="h-11 w-11 shadow-2xl"
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
