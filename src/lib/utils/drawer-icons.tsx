import { FileUser, IdCard, FileText, FileHeart, CreditCard, RectangleEllipsis, WalletCards } from 'lucide-react';
import type { GeneralItemType } from '@/lib/types/drawer';

/**
 * Returns the appropriate icon element for a given drawer item type.
 * Used wherever item type icons are rendered in the drawer UI.
 */
export function getItemTypeIcon(type: GeneralItemType): React.ReactElement {
   switch (type) {
      case 'CHARACTER_CARD':
         return <FileUser className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'FULL_CHARACTER_SHEET':
         return <IdCard className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'CHARACTER_THEME':
         return <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'GROUP_THEME':
         return <FileHeart className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'STATUS_TRACKER':
         return <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'STORY_TAG_TRACKER':
         return <RectangleEllipsis className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'STORY_THEME_TRACKER':
         return <WalletCards className="h-5 w-5 shrink-0 text-muted-foreground" />;
      default:
         return <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />;
   }
}
