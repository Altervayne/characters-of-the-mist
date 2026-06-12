// -- Icon Imports --
import type { LucideIcon } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';



interface MobileMenuItemButtonProps {
	/** The button's visible text. */
	label: string;
	/** The leading lucide icon component. */
	icon: LucideIcon;
	/** When true, renders with the destructive styling (e.g. the "unload" action). */
	destructive: boolean;
	/** Invoked when the button is pressed. */
	onClick: () => void;
}

/**
 * A single full-width entry in the mobile menu list: a leading icon plus a label,
 * styled as either a primary or destructive action. Purely presentational - it
 * holds no store state and resolves no action itself; the parent supplies the
 * `onClick`. Extracted from `MobileMenu`'s item map so the list body stays terse.
 */
export function MobileMenuItemButton({ label, icon: Icon, destructive, onClick }: MobileMenuItemButtonProps) {
	return (
		<button
			onClick={onClick}
			className={cn(
				"inline-flex px-4 items-center gap-2 rounded-md transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
				"w-68 max-w-full min-h-12 py-2 justify-start text-left",
				destructive ? "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60" : "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
				"hover:bg-primary/10 transition-colors"
			)}
		>
			<Icon className="h-6 w-6 mr-4 shrink-0" />
			<span className="text-md text-left">{label}</span>
		</button>
	);
}
