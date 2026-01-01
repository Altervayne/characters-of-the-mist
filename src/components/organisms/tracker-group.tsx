// -- React Imports --
import React from 'react';

// -- Other Library Imports --
import { SortableContext } from '@dnd-kit/sortable';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { PlusCircle } from 'lucide-react';



/**
 * Props for the TrackerGroup component
 */
interface TrackerGroupProps<T> {
   /** Section title displayed at the top */
   title: string;
   /** Text for the add button */
   addButtonText: string;
   /** Array of tracker items to display */
   trackers: T[];
   /** Array of tracker IDs for sortable context */
   trackerIds: string[];
   /** Callback when add button is clicked */
   onAddTracker: () => void;
   /** Render function for each tracker item */
   renderTracker: (tracker: T) => React.ReactNode;
   /** Whether to show the add button */
   showAddButton: boolean;
}



/**
 * Generic tracker group component that displays a sortable list of trackers
 * with a title and optional add button.
 *
 * @example
 * ```tsx
 * <TrackerGroup
 *    title={t('CharacterSheet.statuses')}
 *    addButtonText={t('CharacterSheet.addStatus')}
 *    trackers={character.trackers.statuses}
 *    trackerIds={statusIds}
 *    onAddTracker={addStatus}
 *    renderTracker={(tracker) => (
 *       <SortableTrackerItem tracker={tracker} trackerType="status" />
 *    )}
 *    showAddButton={!!character}
 * />
 * ```
 */
export function TrackerGroup<T extends { id: string }>({
   title,
   addButtonText,
   trackers,
   trackerIds,
   onAddTracker,
   renderTracker,
   showAddButton,
}: TrackerGroupProps<T>) {
   return (
      <div className="card-list-column">
         <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold">{title}</h2>
            {showAddButton && (
               <Button onClick={onAddTracker}>
                  <PlusCircle className="mr-2 h-4 w-4" /> {addButtonText}
               </Button>
            )}
         </div>

         <SortableContext items={trackerIds}>
            <div className="card-list">
               {trackers.map((tracker) => (
                  <React.Fragment key={tracker.id}>
                     {renderTracker(tracker)}
                  </React.Fragment>
               ))}
            </div>
         </SortableContext>
      </div>
   );
}
