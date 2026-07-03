// -- Component Imports --
import { InfoTip } from '@/components/molecules/theme/InfoTip';
import { TokenSwatch } from '@/components/molecules/theme/TokenSwatch';
import { HexInput } from '@/components/molecules/theme/HexInput';

/**
 * One seed input for the generator, built like the editor's token rows: a label (with an optional info
 * tip) over a swatch + hex field, so seeds read and behave the same (paste, revert-on-invalid, picker sync).
 */
export function SeedField({ label, info, value, onPick, isMobile = false }: { label: string; info?: string; value: string; onPick: (hex: string) => void; isMobile?: boolean }) {
   return (
      <div className="flex min-w-0 flex-col gap-1">
         <div className="flex items-center gap-1">
            <span className="truncate text-sm">{label}</span>
            {info && <InfoTip text={info} isMobile={isMobile} />}
         </div>
         <div className="flex items-center gap-1">
            <TokenSwatch value={value} label={label} onPick={onPick} isMobile={isMobile} />
            <HexInput value={value} label={label} onCommit={onPick} className="min-w-0 flex-1" isMobile={isMobile} />
         </div>
      </div>
   );
}
