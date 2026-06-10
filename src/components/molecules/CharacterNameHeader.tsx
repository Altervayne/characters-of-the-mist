interface CharacterNameHeaderProps {
   value: string;
   onChange: (value: string) => void;
   placeholder: string;
}

/**
 * Presentational header holding the character name input.
 * The debounced local-name state lives in the page; this component is a dumb
 * controlled input.
 */
export function CharacterNameHeader({ value, onChange, placeholder }: CharacterNameHeaderProps) {
   return (
      <header className="p-4 bg-popover border-b border-border">
         <input
            data-tour="character-name-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-2xl text-popover-foreground font-bold bg-transparent focus:outline-none w-full"
            placeholder={placeholder}
         />
      </header>
   );
}
