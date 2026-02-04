// Mobile Add Folder Sheet Component
// Bottom sheet for creating a new folder with custom name input

// -- React Imports --
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion, AnimatePresence } from 'framer-motion';

// -- Component Imports --
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';



interface MobileAddFolderSheetProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: (folderName: string) => void;
}

export default function MobileAddFolderSheet({
	isOpen,
	onClose,
	onConfirm
}: MobileAddFolderSheetProps) {
	const { t } = useTranslation();
	const [folderName, setFolderName] = useState('');

	// Reset folder name when sheet opens
	useEffect(() => {
		if (isOpen) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setFolderName('');
		}
	}, [isOpen]);

	const handleConfirm = () => {
		if (folderName.trim()) {
			onConfirm(folderName.trim());
			setFolderName('');
			onClose();
		}
	};

	const handleCancel = () => {
		setFolderName('');
		onClose();
	};

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
						className="fixed inset-0 bg-black/50 z-60"
						onClick={handleCancel}
					/>

					{/* Bottom Sheet */}
					<motion.div
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ type: 'spring', damping: 30, stiffness: 300 }}
						className="fixed border-t border-border bottom-0 left-0 right-0 z-60 bg-background rounded-t-2xl shadow-2xl"
					>
						<div className="p-4 pb-3 border-b border-border">
							<h2 className="text-lg font-semibold">
								{t('Drawer.Actions.addFolderTitle')}
							</h2>
						</div>

						<div className="p-4 space-y-4">
							<Input
								value={folderName}
								onChange={(e) => setFolderName(e.target.value)}
								placeholder={t('Drawer.folderNamePlaceholder')}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										handleConfirm();
									}
								}}
								autoFocus
								className="text-base"
							/>

							<div className="flex gap-2 pb-safe">
								<Button
									variant="outline"
									onClick={handleCancel}
									className="flex-1 cursor-pointer h-11"
								>
									{t('Drawer.Actions.cancel')}
								</Button>
								<Button
									onClick={handleConfirm}
									disabled={!folderName.trim()}
									className="flex-1 cursor-pointer h-11"
								>
									{t('Drawer.Actions.createFolder')}
								</Button>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
