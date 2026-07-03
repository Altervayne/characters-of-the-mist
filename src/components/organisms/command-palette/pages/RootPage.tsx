// -- Other Library Imports --
import { Command } from 'cmdk';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Local Imports --
import { commonItemClass } from '../constants';

// -- Type Imports --
import type { CommandAction } from '@/hooks/useCommandPaletteActions';



interface RootPageProps {
   commandGroups: Record<string, CommandAction[]>;
   onSelectCommand: (command: CommandAction) => void;
};

export const RootPage = ({ commandGroups, onSelectCommand }: RootPageProps) => {
   return (
      <>
         {Object.entries(commandGroups).map(([groupName, groupCommands], index) => (
            <Command.Group key={groupName} heading={groupName} className={cn("text-xs", index !== 0 ? "mt-4" : "mt-1")}>
               {groupCommands.map((command) => (
                  <Command.Item
                     key={command.id}
                     onSelect={() => onSelectCommand(command)}
                     value={command.label}
                     keywords={command.keywords}
                     className={commonItemClass}
                  >
                     <command.icon className="mr-3 ml-1 h-5 w-5" />
                     <span>{command.label}</span>
                  </Command.Item>
               ))}
            </Command.Group>
         ))}
      </>
   );
};
