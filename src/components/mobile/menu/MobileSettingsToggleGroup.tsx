// -- React Imports --
import type { ReactNode } from 'react';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';



interface MobileSettingsToggleOption {
	/** The fully-rendered leading icon element (caller supplies its own className/sizing). */
	icon: ReactNode;
	/** The option's visible text. */
	label: string;
	/** Whether this option is the currently-selected one (renders the filled `default` variant). */
	isActive: boolean;
	/** Invoked when this option is pressed. */
	onSelect: () => void;
}

interface MobileSettingsToggleGroupProps {
	/** The group's heading label. */
	label: string;
	/** Exactly the two mutually-exclusive options, rendered side by side. */
	options: [MobileSettingsToggleOption, MobileSettingsToggleOption];
}

/**
 * A labelled two-option toggle row used across the mobile settings screen
 * (appearance, card view, tracker editing, mobile UI mode, handedness). Renders
 * the heading and two side-by-side buttons; the selected option uses the filled
 * `default` variant and the other the `outline` variant. Purely presentational -
 * it holds no store state and resolves nothing itself. The icon is passed in as a
 * ready-rendered node, so each caller controls its own icon sizing/transform
 * (e.g. the handedness group's mirrored, margin-less hand) without this component
 * needing to know about it.
 */
export function MobileSettingsToggleGroup({ label, options }: MobileSettingsToggleGroupProps) {
	return (
		<div className="space-y-2">
			<Label className="text-sm font-semibold">{label}</Label>
			<div className="grid grid-cols-2 gap-3">
				{options.map((option, index) => (
					<Button
						key={index}
						variant={option.isActive ? 'default' : 'outline'}
						onClick={option.onSelect}
						className="h-auto min-h-12 text-base whitespace-normal py-3"
					>
						{option.icon}
						<span className="text-center leading-tight">{option.label}</span>
					</Button>
				))}
			</div>
		</div>
	);
}
