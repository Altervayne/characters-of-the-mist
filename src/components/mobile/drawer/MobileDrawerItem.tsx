// -- Icon Imports --
import { User, Layers, Users, Package, Heart, Tag, Sparkles, FileText } from 'lucide-react';

// -- Component Imports --
import { DrawerItemPreview } from '@/components/organisms/drawer/DrawerItemPreview';
import { Badge } from '@/components/ui/badge';

// -- Hook Imports --
import { useLongPress } from '@/hooks/mobile/useLongPress';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { DrawerItem, GeneralItemType } from '@/lib/types/drawer';



interface MobileDrawerItemProps {
	item: DrawerItem;
	isCompact: boolean;
	onLongPress: (itemId: string, itemName: string, position: { x: number; y: number }) => void;
}

// Icon mapping for different item types
const getItemIcon = (type: GeneralItemType) => {
	switch (type) {
		case 'CHARACTER_CARD':
			return User;
		case 'CHARACTER_THEME':
			return Layers;
		case 'GROUP_THEME':
			return Users;
		case 'LOADOUT_THEME':
			return Package;
		case 'STATUS_TRACKER':
			return Heart;
		case 'STORY_TAG_TRACKER':
			return Tag;
		case 'STORY_THEME_TRACKER':
			return Sparkles;
		case 'FULL_CHARACTER_SHEET':
			return FileText;
		default:
			return FileText;
	}
};

// Game badge color mapping
const getGameBadgeVariant = (game: string) => {
	switch (game) {
		case 'LEGENDS':
			return 'default';
		case 'CITY_OF_MIST':
			return 'secondary';
		case 'OTHERSCAPE':
			return 'outline';
		default:
			return 'default';
	}
};

// Get display name for game system
const getGameDisplayName = (game: string) => {
	switch (game) {
		case 'LEGENDS':
			return 'Legend';
		case 'CITY_OF_MIST':
			return 'City';
		case 'OTHERSCAPE':
			return 'Otherscape';
		default:
			return game;
	}
};

export default function MobileDrawerItem({
	item,
	isCompact,
	onLongPress
}: MobileDrawerItemProps) {
	const { isPressing, handlers } = useLongPress({
		onLongPress: (position) => onLongPress(item.id, item.name, position),
	});

	const Icon = getItemIcon(item.type);

	// Compact view: Icon + Name + Game badge
	if (isCompact) {
		return (
			<div
				{...handlers}
				className={cn(
					"flex items-center gap-3 p-3 rounded-lg border border-border bg-card transition-all",
					"active:scale-[0.98] cursor-pointer",
					isPressing && "bg-muted scale-[0.98]"
				)}
				style={{ minHeight: '60px' }} // Ensure adequate touch target
			>
				<div className="shrink-0">
					<Icon className="w-5 h-5 text-muted-foreground" />
				</div>

				<div className="flex-1 min-w-0">
					<p className="font-medium text-foreground truncate">
						{item.name}
					</p>
					<div className="flex items-center gap-2 mt-1">
						<Badge variant={getGameBadgeVariant(item.game)} className="text-xs">
							{getGameDisplayName(item.game)}
						</Badge>
					</div>
				</div>
			</div>
		);
	}

	// Rich view: Full card/tracker preview
	return (
		<div
			{...handlers}
			className={cn(
				"rounded-lg border border-border bg-card transition-all overflow-hidden",
				"active:scale-[0.98] cursor-pointer",
				isPressing && "ring-2 ring-primary scale-[0.98]"
			)}
		>
			<DrawerItemPreview item={item} />
		</div>
	);
}
