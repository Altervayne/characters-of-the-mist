// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { Command } from 'cmdk';

// -- Icon Imports --
import { CheckSquare, ListTodo, CornerDownLeft } from 'lucide-react';

// -- Local Imports --
import { commonItemClass } from '../constants';



// ==================
//  Step 1: Choose Type
// ==================
interface CreateTracker_TypePageProps {
   onSelect: (type: 'STATUS' | 'STORY_TAG') => void;
}
export const CreateTracker_TypePage = ({ onSelect }: CreateTracker_TypePageProps) => {
   const { t } = useTranslation();
   return (
      <Command.Group heading={t('CommandPalette.groups.creation')}>
         <Command.Item value={t('CommandPalette.commands.trackerTypeStatus')} onSelect={() => onSelect('STATUS')} className={commonItemClass}>
            <CheckSquare className="mr-2 h-4 w-4" />{t('CommandPalette.commands.trackerTypeStatus')}
         </Command.Item>
         <Command.Item value={t('CommandPalette.commands.trackerTypeStoryTag')} onSelect={() => onSelect('STORY_TAG')} className={commonItemClass}>
            <ListTodo className="mr-2 h-4 w-4" />{t('CommandPalette.commands.trackerTypeStoryTag')}
         </Command.Item>
      </Command.Group>
   );
};

// ==================
//  Step 2: Enter Name
// ==================
interface CreateTracker_NamePageProps {
    inputValue: string;
    onSelect: () => void;
}
export const CreateTracker_NamePage = ({ inputValue, onSelect }: CreateTracker_NamePageProps) => {
   const { t } = useTranslation();
   const text = t('CommandPalette.actions.createWith', { name: inputValue || '...' });
   return (
      <Command.Item value={text} onSelect={onSelect} className={commonItemClass}>
         <CornerDownLeft className="mr-2 h-4 w-4" />
         <span>{text}</span>
      </Command.Item>
   );
};
