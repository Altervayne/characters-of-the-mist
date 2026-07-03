// -- React Imports --
import { useEffect } from 'react';

// -- Library Imports --
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

// -- PWA Imports --
import { useRegisterSW } from 'virtual:pwa-register/react';

// -- Component Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { RefreshCw, X } from 'lucide-react';



/** How often a running instance polls for a freshly deployed service worker. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Service-worker lifecycle UI: a dismissible "update available" banner plus a
 * one-time "ready to work offline" confirmation.
 *
 * Because the worker is registered with `registerType: 'prompt'` (see
 * `vite.config.ts`), a newly built worker installs but waits instead of taking
 * over and reloading the page. `needRefresh` turns true once such a worker is
 * waiting; `updateServiceWorker(true)` then activates it and reloads. Dismissing
 * only hides the banner for now - the waiting worker stays ready, so the prompt
 * reappears on the next load until the user applies it.
 *
 * `onRegisteredSW` schedules a periodic `registration.update()` so a long-lived
 * open tab still discovers new deployments without needing a manual reload.
 */
export default function PWAUpdatePrompt() {
	const { t } = useTranslation();

	const {
		offlineReady: [offlineReady, setOfflineReady],
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		onRegisteredSW(_swScriptUrl, registration) {
			if (registration) {
				setInterval(() => {
					registration.update();
				}, UPDATE_CHECK_INTERVAL_MS);
			}
		},
	});

	// Surface offline readiness once, then clear the flag so it does not re-fire.
	useEffect(() => {
		if (offlineReady) {
			toast.success(t('PWA.offlineReady'));
			setOfflineReady(false);
		}
	}, [offlineReady, setOfflineReady, t]);

	if (!needRefresh) {
		return null;
	}

	return (
		<div
			role="status"
			aria-live="polite"
			// Above bottom sheets (layer-overlay, 60) but below the full-screen
			// onboarding/tutorial band (100+); see the mobile stacking ladder in
			// global.css.
			className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4"
			style={{ paddingTop: 'calc(1.75rem + env(safe-area-inset-top))' }}
		>
			<div className="flex w-full max-w-md items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-lg">
				<RefreshCw className="h-5 w-5 shrink-0 text-primary" />
				<p className="flex-1 text-sm text-foreground">
					{t('PWA.updateAvailable')}
				</p>
				<Button size="sm" onClick={() => updateServiceWorker(true)}>
					{t('PWA.update')}
				</Button>
				<button
					type="button"
					aria-label={t('PWA.dismiss')}
					onClick={() => setNeedRefresh(false)}
					className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
