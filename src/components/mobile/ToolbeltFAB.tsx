// -- React Imports --
import { useTranslation } from 'react-i18next';

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

interface ToolbeltFABProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	actions: ToolbeltAction[];
}

export default function ToolbeltFAB({
	isOpen,
	onOpenChange,
	actions
}: ToolbeltFABProps) {
	const { t } = useTranslation();

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

						{/* Action Buttons */}
						{actions.length > 0 && (
							<div className="fixed bottom-24 right-4 flex flex-col-reverse gap-3 z-50">
								{actions.map((action, index) => {
									const Icon = action.icon;
									return (
										<motion.div
											key={action.id}
											initial={{ scale: 0, opacity: 0, y: 20 }}
											animate={{ scale: 1, opacity: 1, y: 0 }}
											exit={{ scale: 0, opacity: 0, y: 20 }}
											transition={{
												type: 'spring',
												damping: 25,
												stiffness: 300,
												delay: index * 0.05
											}}
										>
											<div className="flex items-center gap-3">
												{/* Action label */}
												<motion.div
													initial={{ opacity: 0, x: 20 }}
													animate={{ opacity: 1, x: 0 }}
													exit={{ opacity: 0, x: 20 }}
													transition={{ delay: index * 0.05 + 0.1 }}
													className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg"
												>
													<span className="text-sm font-medium whitespace-nowrap">
														{action.label}
													</span>
												</motion.div>

												{/* Action button */}
												<IconButton
													variant={action.variant === 'destructive' ? 'destructive' : 'default'}
													size="lg"
													onClick={() => {
														action.onClick();
														onOpenChange(false);
													}}
													className="shadow-lg"
												>
													<Icon className="h-5 w-5" />
												</IconButton>
											</div>
										</motion.div>
									);
								})}
							</div>
						)}
					</>
				)}
			</AnimatePresence>

			{/* Primary FAB Button */}
			<motion.div
				className="fixed bottom-4 right-4 z-50"
				whileTap={{ scale: 0.95 }}
			>
				<IconButton
					variant="default"
					size="lg"
					onClick={() => onOpenChange(!isOpen)}
					className={cn(
						"h-14 w-14 shadow-2xl",
						actions.length === 0 && "opacity-50 cursor-not-allowed"
					)}
					disabled={actions.length === 0}
				>
					<motion.div
						animate={{ rotate: isOpen ? 45 : 0 }}
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
		</>
	);
}
