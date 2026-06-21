import { FileUser, IdCard, FileText, FileHeart, CreditCard, RectangleEllipsis, WalletCards, Image } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GeneralItemType } from '@/lib/types/drawer';

/**
 * Returns the lucide icon *component* for a drawer item type, so callers can size
 * and style it themselves (e.g. the small drag-identity pill). {@link getItemTypeIcon}
 * is the pre-styled element wrapper around this.
 */
export function getItemTypeIconComponent(type: GeneralItemType): LucideIcon {
   switch (type) {
      case 'CHARACTER_CARD':
         return FileUser;
      case 'FULL_CHARACTER_SHEET':
         return IdCard;
      case 'CHARACTER_THEME':
         return FileText;
      case 'GROUP_THEME':
         return FileHeart;
      case 'STATUS_TRACKER':
         return CreditCard;
      case 'STORY_TAG_TRACKER':
         return RectangleEllipsis;
      case 'STORY_THEME_TRACKER':
         return WalletCards;
      case 'IMAGE_CARD':
         return Image;
      default:
         return FileText;
   }
}

/**
 * Returns the appropriate icon element for a given drawer item type.
 * Used wherever item type icons are rendered in the drawer UI.
 */
export function getItemTypeIcon(type: GeneralItemType): React.ReactElement {
   const Icon = getItemTypeIconComponent(type);
   return <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />;
}
