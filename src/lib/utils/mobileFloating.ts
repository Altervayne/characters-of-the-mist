// -- Layout constants (rem) --

/** Bottom tab bar height, matching MobileBottomTabs' `h-16`. Present only in
 *  side-panel nav mode; FAB mode replaces the tab bar with the FAB itself. */
const BOTTOM_NAV_HEIGHT_REM = 4;
/** Extra clearance for the card navigation bar shown at the bottom of the cards tab. */
const CARDS_NAV_BAR_REM = 2.5;
/** Gap from the bottom chrome (or the screen edge in FAB mode) up to the first cluster. */
const FLOATING_BASE_GAP_REM = 1;
/** Vertical separation between two floating clusters that share one screen edge. */
const FLOATING_STAGGER_REM = 3;



interface FloatingBottomConfig {
	/** Add the bottom tab bar's height to the offset (side-panel nav mode). */
	hasBottomNav?: boolean;
	/** Add the card navigation bar's height to the offset (cards tab). */
	clearsCardsNavBar?: boolean;
	/** This control's index in the stack of clusters sharing the edge (0 = nearest the edge). */
	stagger?: number;
	/** One-off additional clearance in rem (e.g. an expanded action list floating above its own FAB). */
	extraRem?: number;
}

/**
 * Computes the `bottom` offset (a CSS `calc()` string) for a floating mobile
 * control, so every floating cluster clears the home-indicator safe area, clears
 * whatever bottom chrome sits beneath it, and is staggered far enough from any
 * other cluster on the same edge that the two never overlap in any configuration.
 *
 * The offset is `bottom-nav height + card-nav-bar height + base gap +
 * stagger × stagger-step`, all in rem, plus `env(safe-area-inset-bottom)` (the
 * same inset Prompt 1's `pb-safe` utility applies, made non-zero by the
 * `viewport-fit=cover` viewport). Callers describe their situation declaratively
 * (which bottom chrome is present, and their stagger index) rather than hard-coding
 * `bottom-*` values, so the whole floating layout stays consistent and
 * safe-area-aware from one place.
 *
 * The two FAB-mode clusters that co-occupy an edge - the navigation FAB
 * (`stagger: 0`) and the toolbelt FAB (`stagger: 1`) - are kept apart by the
 * stagger; on the cards tab both also add the card-nav-bar clearance so they ride
 * above it together.
 *
 * @param config - Which bottom chrome is present, this control's stagger index, and any one-off clearance.
 * @returns A `calc(...)` string suitable for an inline `style={{ bottom }}`.
 */
export function getFloatingBottom({
	hasBottomNav = false,
	clearsCardsNavBar = false,
	stagger = 0,
	extraRem = 0,
}: FloatingBottomConfig = {}): string {
	const offsetRem =
		(hasBottomNav ? BOTTOM_NAV_HEIGHT_REM : 0) +
		(clearsCardsNavBar ? CARDS_NAV_BAR_REM : 0) +
		FLOATING_BASE_GAP_REM +
		stagger * FLOATING_STAGGER_REM +
		extraRem;

	return `calc(${offsetRem}rem + env(safe-area-inset-bottom))`;
}
