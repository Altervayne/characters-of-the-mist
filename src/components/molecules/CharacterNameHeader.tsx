// -- Custom Hooks --
import { useInputDebouncer } from '@/hooks/useInputDebouncer';

interface CharacterNameHeaderProps {
   name: string;
   onCommit: (value: string) => void;
   placeholder: string;
}

/**
 * Header holding the character name input. Owns its debounced buffer so the edit
 * rides the hook's unmount flush: mounted with `key={character.id}`, a character or
 * board switch unmounts this header and flushes the pending name through the
 * `onCommit` captured at its last render - which is the leaving character's own
 * store action, so the write lands on the correct character.
 */
export function CharacterNameHeader({ name, onCommit, placeholder }: CharacterNameHeaderProps) {
   const [localName, setLocalName] = useInputDebouncer(name, onCommit);

   return (
      <header className="p-4 bg-popover border-b border-border">
         <input
            data-tour="character-name-input"
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            className="text-2xl text-popover-foreground font-bold bg-transparent focus:outline-none w-full"
            placeholder={placeholder}
         />
      </header>
   );
}
