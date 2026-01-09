import { useState, useEffect, useCallback } from 'react';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

export type DeviceType = 'mobile' | 'desktop';

interface UseDeviceTypeResult {
	deviceType: DeviceType;
	isMobile: boolean;
	isDesktop: boolean;
	toggleDeviceType: () => void;
}

// Mobile detection based on user agent
function isMobileUserAgent(): boolean {
	if (typeof navigator === 'undefined') return false;

	const userAgent = navigator.userAgent.toLowerCase();
	const mobileKeywords = [
		'android',
		'webos',
		'iphone',
		'ipad',
		'ipod',
		'blackberry',
		'windows phone',
		'mobile'
	];

	return mobileKeywords.some(keyword => userAgent.includes(keyword));
}

// Touch capability detection
function hasTouchCapability(): boolean {
	if (typeof window === 'undefined') return false;

	return (
		'ontouchstart' in window ||
		navigator.maxTouchPoints > 0 ||
		// @ts-expect-error - msMaxTouchPoints is a legacy IE property not in TypeScript types
		navigator.msMaxTouchPoints > 0
	);
}

// Screen width detection (fallback)
function isMobileScreenWidth(): boolean {
	if (typeof window === 'undefined') return false;
	return window.innerWidth < 768; // md breakpoint
}

// Auto-detect device type
function detectDeviceType(): DeviceType {
	const isUserAgentMobile = isMobileUserAgent();
	const hasTouch = hasTouchCapability();
	const isSmallScreen = isMobileScreenWidth();

	// If user agent says mobile, it's probably mobile
	if (isUserAgentMobile) return 'mobile';

	// If touch + small screen, treat as mobile
	if (hasTouch && isSmallScreen) return 'mobile';

	// Otherwise desktop
	return 'desktop';
}

export function useDeviceType(): UseDeviceTypeResult {
	const deviceTypeOverride = useAppSettingsStore((state) => state.deviceTypeOverride);
	const { setDeviceTypeOverride } = useAppSettingsStore((state) => state.actions);

	const [detectedDeviceType, setDetectedDeviceType] = useState<DeviceType>(() => detectDeviceType());

	// Re-detect on window resize (debounced)
	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout>;

		const handleResize = () => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				setDetectedDeviceType(detectDeviceType());
			}, 200);
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			clearTimeout(timeoutId);
		};
	}, []);

	// Use override if set, otherwise use detected type
	const deviceType = deviceTypeOverride || detectedDeviceType;

	const toggleDeviceType = useCallback(() => {
		const newType: DeviceType = deviceType === 'mobile' ? 'desktop' : 'mobile';
		setDeviceTypeOverride(newType);
	}, [deviceType, setDeviceTypeOverride]);

	return {
		deviceType,
		isMobile: deviceType === 'mobile',
		isDesktop: deviceType === 'desktop',
		toggleDeviceType
	};
}
