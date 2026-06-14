// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { Wrench } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getFloatingBottom } from '@/lib/utils/mobileFloating';



interface MobileToolbeltTriggerProps {
	isLeftHanded: boolean;
	isCardsTab: boolean;
	onOpen: () => void;
}

/**
 * The thumb-zone toolbelt trigger for side-panel mode.
 *
 * A floating wrench button anchored to the bottom corner on the handedness side
 * (left for left-handed, right otherwise), replacing the old top tab-bar wrench
 * whose reach was the worst on the screen. Its bottom offset comes from the
 * shared {@link getFloatingBottom} helper (`hasBottomNav` true, since the side-panel
 * tab bar sits below it; plus the card-nav-bar allowance on the cards tab, where
 * that bar stacks above the tab bar), so it clears whatever bottom chrome is
 * present and the home-indicator safe area consistently with every other floating
 * control. The caller renders it only in side-panel mode and only while the
 * toolbelt is closed.
 *
 * @param isLeftHanded - Anchors the button to the left corner when true, the right otherwise.
 * @param isCardsTab - Adds the card navigation bar's height to the offset on the cards tab, so the trigger clears it.
 * @param onOpen - Opens the toolbelt (the caller wires haptic feedback and open state).
 */
export default function MobileToolbeltTrigger({ isLeftHanded, isCardsTab, onOpen }: MobileToolbeltTriggerProps) {
	const { t } = useTranslation();

	return (
		<div
			className={cn("fixed layer-floating", isLeftHanded ? "left-4" : "right-4")}
			style={{ bottom: getFloatingBottom({ hasBottomNav: true, clearsCardsNavBar: isCardsTab }) }}
		>
			<IconButton
				variant="default"
				size="lg"
				onClick={onOpen}
				data-tutorial="toolbelt-trigger"
				aria-label={t('Toolbelt.title')}
				className="h-12 w-12 shadow-2xl"
			>
				<Wrench className="h-6 w-6" />
			</IconButton>
		</div>
	);
}
