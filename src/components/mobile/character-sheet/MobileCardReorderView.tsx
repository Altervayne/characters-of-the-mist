// -- Library Imports --
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

// -- Component Imports --
import { IconButton } from '@/components/ui/icon-button';
import { resolveCardComponent } from '@/components/organisms/cards/resolveCardComponent';

// -- Icon Imports --
import { ChevronUp, ChevronDown } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { Card } from '@/lib/types/character';



interface MobileCardReorderViewProps {
	cards: Card[];
	isMobileFABMode: boolean;
	isReorderingCard: boolean;
	onMoveCardUp: (index: number) => void;
	onMoveCardDown: (index: number) => void;
	onSelectCard: (index: number) => void;
}

/**
 * The card-reorder view of the mobile character sheet: a vertical list of card
 * previews, each with up/down controls and clickable to jump to that card and
 * exit reorder mode. Purely presentational - the card list, mode flag, the
 * mid-move `isReorderingCard` guard, and the move/select callbacks come from the
 * sheet. The previews route through the shared `resolveCardComponent` (forced to
 * the front-facing side-by-side view), so no card-type/game routing lives here.
 */
export function MobileCardReorderView({ cards, isMobileFABMode, isReorderingCard, onMoveCardUp, onMoveCardDown, onSelectCard }: MobileCardReorderViewProps) {
	const { t } = useTranslation();

	// Force SIDE_BY_SIDE mode and front face for previews (like in the Drawer)
	const renderCardPreview = (card: Card) => {
		const Component = resolveCardComponent(card.cardType, card.details.game);
		if (!Component) return null;

		const previewCard = { ...card, viewMode: 'SIDE_BY_SIDE' as const, isFlipped: false };
		return <Component card={previewCard} isDrawerPreview />;
	};

	return (
		<div className={cn("flex-1 overflow-y-auto p-4", isMobileFABMode && "pb-32")}>
			<div className="max-w-2xl mx-auto space-y-4">
				{/* Header */}
				<div className="flex items-center justify-center mb-4 sticky top-0 bg-background z-10 pb-2">
					<h2 className="text-lg font-semibold">{t('MobileCharacterSheet.reorderCards')}</h2>
				</div>

				{/* Card list with reorder controls */}
				{cards.map((card, index) => (
					<motion.div
						key={card.id}
						layout
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
					>
						{/* Card preview - clickable to navigate and close reorder mode */}
						<div
							className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
							onClick={() => onSelectCard(index)}
						>
							{renderCardPreview(card)}
						</div>

						{/* Reorder buttons */}
						<div className="flex flex-col gap-1 shrink-0">
							<IconButton
								variant="outline"
								size="lg"
								onClick={() => onMoveCardUp(index)}
								disabled={index === 0 || isReorderingCard}
								className="h-10 w-10"
							>
								<ChevronUp className="h-6 w-6" />
							</IconButton>
							<IconButton
								variant="outline"
								size="lg"
								onClick={() => onMoveCardDown(index)}
								disabled={index === cards.length - 1 || isReorderingCard}
								className="h-10 w-10"
							>
								<ChevronDown className="h-6 w-6" />
							</IconButton>
						</div>
					</motion.div>
				))}
			</div>
		</div>
	);
}
