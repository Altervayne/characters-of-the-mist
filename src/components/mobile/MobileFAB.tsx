// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion, AnimatePresence } from 'framer-motion';

// -- Icon Imports --
import { Plus, X, Edit, FolderOpen, Save, Settings } from 'lucide-react';

// -- Store Imports --
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useCharacterStore } from '@/lib/stores/characterStore';

// -- Utils Imports --
import { cn } from '@/lib/utils';

interface MobileFABProps {
	onOpenDrawer: () => void;
	onOpenMenu: () => void;
}

export default function MobileFAB({ onOpenDrawer, onOpenMenu }: MobileFABProps) {
	const { t } = useTranslation();
	const [isExpanded, setIsExpanded] = useState(false);
	const isEditing = useAppGeneralStateStore((state) => state.isEditing);
	const { toggleIsEditing } = useAppGeneralStateActions();
	const character = useCharacterStore((state) => state.character);

	const toggleExpanded = () => setIsExpanded(!isExpanded);

	const actions = [
		{
			id: 'edit',
			label: t('MobileFAB.edit') || 'Edit Mode',
			icon: Edit,
			onClick: () => {
				toggleIsEditing();
				setIsExpanded(false);
			},
			show: !!character,
			active: isEditing,
		},
		{
			id: 'drawer',
			label: t('MobileFAB.drawer') || 'Drawer',
			icon: FolderOpen,
			onClick: () => {
				onOpenDrawer();
				setIsExpanded(false);
			},
			show: true,
		},
		{
			id: 'menu',
			label: t('MobileFAB.menu') || 'Menu',
			icon: Settings,
			onClick: () => {
				onOpenMenu();
				setIsExpanded(false);
			},
			show: true,
		},
	].filter(action => action.show);

	return (
		<>
			{/* Backdrop */}
			<AnimatePresence>
				{isExpanded && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
						onClick={() => setIsExpanded(false)}
					/>
				)}
			</AnimatePresence>

			{/* Action Buttons */}
			<div className="fixed bottom-20 right-4 z-50 flex flex-col-reverse items-end gap-3">
				<AnimatePresence>
					{isExpanded && actions.map((action, index) => {
						const Icon = action.icon;
						return (
							<motion.button
								key={action.id}
								initial={{ opacity: 0, scale: 0, y: 20 }}
								animate={{ opacity: 1, scale: 1, y: 0 }}
								exit={{ opacity: 0, scale: 0, y: 20 }}
								transition={{
									duration: 0.2,
									delay: index * 0.05,
								}}
								onClick={action.onClick}
								className={cn(
									"flex items-center gap-3 rounded-full shadow-lg",
									"px-4 py-3 min-w-max",
									"active:scale-95 transition-transform",
									action.active
										? "bg-primary text-primary-foreground"
										: "bg-card text-foreground border border-border"
								)}
							>
								<Icon className="h-5 w-5" />
								<span className="text-sm font-medium">{action.label}</span>
							</motion.button>
						);
					})}
				</AnimatePresence>
			</div>

			{/* Primary FAB */}
			<motion.button
				onClick={toggleExpanded}
				className={cn(
					"fixed bottom-4 right-4 z-50",
					"w-14 h-14 rounded-full shadow-lg",
					"flex items-center justify-center",
					"bg-primary text-primary-foreground",
					"active:scale-95 transition-transform"
				)}
				whileTap={{ scale: 0.9 }}
				aria-label={isExpanded ? t('MobileFAB.close') || 'Close' : t('MobileFAB.open') || 'Open menu'}
			>
				<AnimatePresence mode="wait">
					{isExpanded ? (
						<motion.div
							key="close"
							initial={{ rotate: -90, opacity: 0 }}
							animate={{ rotate: 0, opacity: 1 }}
							exit={{ rotate: 90, opacity: 0 }}
							transition={{ duration: 0.15 }}
						>
							<X className="h-6 w-6" />
						</motion.div>
					) : (
						<motion.div
							key="open"
							initial={{ rotate: -90, opacity: 0 }}
							animate={{ rotate: 0, opacity: 1 }}
							exit={{ rotate: 90, opacity: 0 }}
							transition={{ duration: 0.15 }}
						>
							<Plus className="h-6 w-6" />
						</motion.div>
					)}
				</AnimatePresence>
			</motion.button>
		</>
	);
}
