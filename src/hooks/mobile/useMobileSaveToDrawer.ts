// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Store Imports --
import { useDrawerActions } from '@/lib/stores/drawerStore';

// -- Utils Imports --
import { mapItemToStorableInfo } from '@/lib/utils/dnd';

// -- Type Imports --
import type { Card, Tracker } from '@/lib/types/character';



/**
 * Owns the mobile "save to drawer" bottom-sheet state and its confirm flow.
 *
 * Tracks whether the sheet is open, the item being saved, and the default name to
 * prefill. `openSaveToDrawer(item, defaultName)` stores the item and opens the
 * sheet - the default name is computed by the caller (the card-title derivation
 * stays in the component for now), keeping this hook free of presentation logic.
 * `handleConfirmSaveToDrawer(name)` maps the item to its storable type/game,
 * deep-copies it (resetting any flipped state), dispatches the add-to-drawer store
 * action, and toasts success.
 *
 * @returns The open flag and its setter (for the sheet's close), the default name,
 *   the `openSaveToDrawer` opener, and the `handleConfirmSaveToDrawer` confirm handler.
 */
export function useMobileSaveToDrawer() {
	const { t } = useTranslation();
	const { addItem: addDrawerItem } = useDrawerActions();

	const [isSaveToDrawerOpen, setIsSaveToDrawerOpen] = useState(false);
	const [saveToDrawerItem, setSaveToDrawerItem] = useState<Card | Tracker | null>(null);
	const [saveToDrawerDefaultName, setSaveToDrawerDefaultName] = useState('');

	const openSaveToDrawer = (item: Card | Tracker, defaultName: string) => {
		setSaveToDrawerItem(item);
		setSaveToDrawerDefaultName(defaultName);
		setIsSaveToDrawerOpen(true);
	};

	const handleConfirmSaveToDrawer = (name: string) => {
		if (!saveToDrawerItem) return;
		const storableInfo = mapItemToStorableInfo(saveToDrawerItem);
		if (!storableInfo) return;
		const [type, game] = storableInfo;
		const contentCopy = JSON.parse(JSON.stringify(saveToDrawerItem));
		if ('isFlipped' in contentCopy) contentCopy.isFlipped = false;
		addDrawerItem(name, game, type, contentCopy);
		toast.success(t('Notifications.drawer.itemCreated'));
	};

	return { isSaveToDrawerOpen, setIsSaveToDrawerOpen, saveToDrawerDefaultName, openSaveToDrawer, handleConfirmSaveToDrawer };
}
