// -- Utils Imports --
import { cn } from '@/lib/utils';



interface MobileCharacterNameHeaderProps {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
}

/**
 * Presentational header holding the mobile character-name input. The debounced
 * local-name state lives in the sheet; this is a dumb controlled input. Mobile
 * styling differs from the shared desktop header (full-bleed bold input with a
 * primary-tinted focus state and no drawer-tour anchor).
 */
export function MobileCharacterNameHeader({ value, onChange, placeholder }: MobileCharacterNameHeaderProps) {
	return (
		<header className="p-3 bg-popover border-b border-border flex items-center gap-3">
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={cn(
					"flex-1 text-2xl font-bold bg-transparent outline-none transition-colors",
					"placeholder:text-muted-foreground/50",
					"focus:text-primary"
				)}
				placeholder={placeholder}
			/>
		</header>
	);
}
