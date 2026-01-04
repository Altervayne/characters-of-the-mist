import type { LucideIcon } from 'lucide-react';
import type { Card, StatusTracker, StoryTagTracker, StoryThemeTracker } from './character';

export type ToolbeltMode = 'side-panel' | 'fab';

export interface ToolbeltAction {
	id: string;
	label: string;
	icon: LucideIcon;
	onClick: () => void;
	variant?: 'default' | 'destructive';
	show: boolean;
}

export interface ToolbeltActions {
	itemActions: ToolbeltAction[];
	globalActions: ToolbeltAction[];
}

export type ToolbeltContext =
	| { type: 'card'; card: Card }
	| { type: 'tracker'; tracker: StatusTracker | StoryTagTracker | StoryThemeTracker }
	| { type: 'none' };
