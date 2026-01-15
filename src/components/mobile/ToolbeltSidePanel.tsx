// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { X } from 'lucide-react';

// -- Animation Imports --
import { motion, AnimatePresence } from 'framer-motion';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { ToolbeltAction } from '@/lib/types/toolbelt';

interface ToolbeltSidePanelProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	itemActions: ToolbeltAction[];
	globalActions: ToolbeltAction[];
}

export default function ToolbeltSidePanel({
	isOpen,
	onOpenChange,
	itemActions,
	globalActions
}: ToolbeltSidePanelProps) {
	const { t } = useTranslation();
	const mobileHandedness = useAppSettingsStore((state) => state.mobileHandedness);
	const isLeft = mobileHandedness === 'left';
	const hasItemActions = itemActions.length > 0;
	const hasGlobalActions = globalActions.length > 0;

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
						className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
						onClick={() => onOpenChange(false)}
					/>

					{/* Side Panel */}
					<motion.div
						initial={{ x: isLeft ? '-100%' : '100%' }}
						animate={{ x: 0 }}
						exit={{ x: isLeft ? '-100%' : '100%' }}
						transition={{ type: 'spring', damping: 30, stiffness: 300 }}
						className={cn(
							"fixed top-0 bottom-0 w-80 max-w-[85vw] bg-card shadow-2xl z-50 flex flex-col",
							isLeft ? "left-0 border-r" : "right-0 border-l",
							"border-border"
						)}
					>
						{/* Header */}
						<div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
							<h2 className="text-lg font-semibold">
								{t('Toolbelt.title')}
							</h2>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onOpenChange(false)}
								className="h-8 w-8 p-0"
							>
								<X className="h-5 w-5" />
							</Button>
						</div>

						{/* Actions List */}
						<div className="flex flex-col justify-end flex-1 overflow-y-auto p-2">
							{!hasItemActions && !hasGlobalActions ? (
								<div className="flex flex-col items-center justify-center w-full h-full p-8 text-center">
									<p className="text-muted-foreground">
										{t('Toolbelt.noActions')}
									</p>
								</div>
							) : (
								<div className="justify-end space-y-4">
									{/* Item Actions Section */}
									{hasItemActions && (
										<div>
											<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
												{t('Toolbelt.itemSection')}
											</h3>
											<div className="space-y-1">
												{itemActions.map((action) => {
													const Icon = action.icon;
													return (
														<Button
															key={action.id}
															variant={action.variant === 'destructive' ? 'destructive' : 'ghost'}
															onClick={() => {
																action.onClick();
																onOpenChange(false);
															}}
															className={cn(
																"w-full justify-start h-12 text-base",
																action.variant !== 'destructive' && "hover:bg-accent"
															)}
														>
															<Icon className="h-5 w-5 mr-3" />
															<span>{action.label}</span>
														</Button>
													);
												})}
											</div>
										</div>
									)}

									{/* Global Actions Section */}
									{hasGlobalActions && (
										<div>
											<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
												{t('Toolbelt.globalSection')}
											</h3>
											<div className="space-y-1">
												{globalActions.map((action) => {
													const Icon = action.icon;
													return (
														<Button
															key={action.id}
															variant={action.variant === 'destructive' ? 'destructive' : 'ghost'}
															onClick={() => {
																action.onClick();
																onOpenChange(false);
															}}
															className={cn(
																"w-full justify-start h-12 text-base",
																action.variant !== 'destructive' && "hover:bg-accent"
															)}
														>
															<Icon className="h-6 w-6 mr-3" />
															<span>{action.label}</span>
														</Button>
													);
												})}
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
