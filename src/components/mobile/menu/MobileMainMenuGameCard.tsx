// -- React Imports --
import type { FC, ReactNode } from 'react';

// -- Other Library Imports --
import { motion } from 'framer-motion';

// -- Icon Imports --
import { Feather } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';



interface MobileMainMenuGameCardProps {
	title: string;
	subtitle: string;
	icon: ReactNode;
	isSelected: boolean;
	onClick: () => void;
	gradient: string;
}

/**
 * A selectable game-system card in the mobile main menu: a leading icon, a title
 * and subtitle, a gradient wash whose opacity lifts when selected, and an
 * animated check badge (Feather) that springs in on the selected card. Purely
 * presentational - selection state and the click handler are supplied by the
 * parent. The `whileTap` press-scale and the badge's spring-in are deliberate
 * mobile interaction concerns and are preserved as-is.
 */
export const MobileMainMenuGameCard: FC<MobileMainMenuGameCardProps> = ({ title, subtitle, icon, isSelected, onClick, gradient }) => {
	return (
		<motion.button
			onClick={onClick}
			className={cn(
				"relative overflow-hidden rounded-xl p-5 w-full text-left transition-all",
				"border-2 bg-card active:scale-[0.98]",
				isSelected
					? "border-primary shadow-lg ring-4 ring-primary/20"
					: "border-border active:border-primary/50"
			)}
			whileTap={{ scale: 0.98 }}
		>
			<div className={cn(
				"absolute inset-0 opacity-10 transition-opacity",
				isSelected && "opacity-20",
				gradient
			)} />

			<div className="relative z-10 flex items-center gap-4">
				<div className="p-3 rounded-lg bg-background/50 backdrop-blur-sm shrink-0">
					{icon}
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="text-lg font-bold text-foreground mb-0.5">{title}</h3>
					<p className="text-sm text-muted-foreground line-clamp-1">{subtitle}</p>
				</div>
				{isSelected && (
					<motion.div
						initial={{ scale: 0, rotate: -180 }}
						animate={{ scale: 1, rotate: 0 }}
						className="p-1.5 rounded-full bg-primary text-primary-foreground shrink-0"
					>
						<Feather className="h-4 w-4" />
					</motion.div>
				)}
			</div>
		</motion.button>
	);
};
