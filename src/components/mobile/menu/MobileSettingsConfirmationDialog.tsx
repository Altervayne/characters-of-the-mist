// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';

// -- Icon Imports --
import { AlertTriangle } from 'lucide-react';



interface MobileSettingsConfirmationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	title: string;
	description: string;
	confirmationText: string;
	confirmButtonText: string;
}

/**
 * A destructive-action confirmation dialog gated on the user re-typing an exact
 * phrase (e.g. "DELETE DRAWER"). It owns the confirmation-text `input` as local
 * state - the parent only supplies the phrase to match and the confirm callback;
 * the confirm button stays disabled until `input` equals `confirmationText`, and
 * the input is reset whenever the dialog closes. Used for the danger-zone
 * delete-drawer and reset-app actions in the mobile settings screen.
 */
export function MobileSettingsConfirmationDialog({ open, onOpenChange, onConfirm, title, description, confirmationText, confirmButtonText }: MobileSettingsConfirmationDialogProps) {
	const { t } = useTranslation();
	const [input, setInput] = useState("");

	const handleOpenChange = (isOpen: boolean) => {
		onOpenChange(isOpen);
		if (!isOpen) {
			setInput("");
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent className="border-2 border-dashed border-destructive">
				<AlertDialogHeader>
					<div className="flex items-center gap-2">
						<AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
						<AlertDialogTitle>{title}</AlertDialogTitle>
					</div>
					<AlertDialogDescription>
						{description}
						<p className="mt-2 text-foreground">
							{t('SettingsDialog.dangerZone.resetDialog.confirmationPrompt')}
						</p>
						<p className="w-full mt-1 text-center text-sm font-bold text-destructive">{confirmationText}</p>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<Input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder={confirmationText}
					className="border-foreground/50"
				/>
				<AlertDialogFooter>
					<AlertDialogCancel className="cursor-pointer">{t('SettingsDialog.dangerZone.resetDialog.cancel')}</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						disabled={input !== confirmationText}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
					>
						{confirmButtonText}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
