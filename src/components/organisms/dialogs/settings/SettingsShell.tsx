// -- React Imports --
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import * as TabsPrimitive from '@radix-ui/react-tabs';

// -- Basic UI Imports --
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// -- Icon Imports --
import { Database, GraduationCap, Palette, SlidersHorizontal } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Pane Imports --
import { GeneralSettingsPane } from './GeneralSettingsPane';
import { AppearanceSettingsPane } from './AppearanceSettingsPane';
import { DataSettingsPane } from './DataSettingsPane';
import { LearnSettingsPane } from './LearnSettingsPane';

// -- Store Imports --
import { useAppGeneralStateActions, useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

/*
 * The desktop settings hub: one full-width header band over a section rail + a content pane, mirroring the
 * Themes window. Sections register declaratively below, grouped in the rail under group headers and rendered as
 * a real vertical tab set (Radix Tabs) so keyboard + focus flow come for free. Three surface shades read as
 * distinct bands - header `bg-card` (raised), rail `bg-popover` (middle), pane `bg-background` (recedes) - and
 * hold their brightness order in light and dark. New sections drop into `SECTIONS` with no shell changes.
 */

export type SettingsGroupId = 'configure' | 'help';
export type SettingsSectionId = 'general' | 'appearance' | 'data' | 'learn';

interface SettingsSection {
   id: SettingsSectionId;
   group: SettingsGroupId;
   labelKey: string;
   icon: LucideIcon;
   Pane: ComponentType;
}

const GROUP_ORDER: SettingsGroupId[] = ['configure', 'help'];

const GROUP_LABEL_KEYS: Record<SettingsGroupId, string> = {
   configure: 'SettingsShell.groups.configure',
   help: 'SettingsShell.groups.help',
};

const SECTIONS: SettingsSection[] = [
   { id: 'general', group: 'configure', labelKey: 'SettingsShell.sections.general', icon: SlidersHorizontal, Pane: GeneralSettingsPane },
   { id: 'appearance', group: 'configure', labelKey: 'SettingsShell.sections.appearance', icon: Palette, Pane: AppearanceSettingsPane },
   { id: 'data', group: 'configure', labelKey: 'SettingsShell.sections.data', icon: Database, Pane: DataSettingsPane },
   { id: 'learn', group: 'help', labelKey: 'SettingsShell.sections.learn', icon: GraduationCap, Pane: LearnSettingsPane },
];

const DEFAULT_SECTION: SettingsSectionId = 'general';
const SECTION_IDS = new Set<string>(SECTIONS.map((section) => section.id));



interface SettingsShellProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
}

export function SettingsShell({ isOpen, onOpenChange }: SettingsShellProps) {
   const { t } = useTranslation();
   const [activeSection, setActiveSection] = useState<SettingsSectionId>(DEFAULT_SECTION);

   const settingsInitialSection = useAppGeneralStateStore((state) => state.settingsInitialSection);
   const { setSettingsInitialSection } = useAppGeneralStateActions();

   // On open, honor a one-shot deep-link target (then clear it); otherwise land on the default section so a
   // reopen never drops the user back into wherever they last wandered (e.g. the Danger Zone).
   useEffect(() => {
      if (!isOpen) return;
      if (settingsInitialSection && SECTION_IDS.has(settingsInitialSection)) {
         setActiveSection(settingsInitialSection as SettingsSectionId);
         setSettingsInitialSection(null);
      } else {
         setActiveSection(DEFAULT_SECTION);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- seed the section only when the hub opens
   }, [isOpen]);

   return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
         <DialogContent className="flex h-[min(70vh,640px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
            {/* One full-width header band over the rail + pane, mirroring the Themes window - three surface
                shades (header card / rail popover / pane background) read as distinct bands, light and dark. */}
            <DialogHeader className="shrink-0 border-b border-border bg-card px-6 py-4 pr-10 text-left">
               <DialogTitle>{t('SettingsShell.title')}</DialogTitle>
               <DialogDescription>{t('SettingsDialog.description')}</DialogDescription>
            </DialogHeader>

            <TabsPrimitive.Root
               value={activeSection}
               onValueChange={(value) => setActiveSection(value as SettingsSectionId)}
               orientation="vertical"
               className="flex min-h-0 w-full flex-1"
            >
               {/* Nav rail: the middle `bg-popover` shade, grouped tabs; owns its own scroll. */}
               <TabsPrimitive.List
                  aria-label={t('SettingsShell.title')}
                  className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border bg-popover p-2"
               >
                  {GROUP_ORDER.map((group) => (
                     <div key={group}>
                        <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                           {t(GROUP_LABEL_KEYS[group])}
                        </div>
                        <div className="flex flex-col gap-0.5">
                           {SECTIONS.filter((section) => section.group === group).map((section) => {
                              const Icon = section.icon;
                              return (
                                 <TabsPrimitive.Trigger
                                    key={section.id}
                                    value={section.id}
                                    className={cn(
                                       'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground outline-none transition-colors',
                                       'hover:bg-muted hover:text-foreground',
                                       'data-[state=active]:bg-accent data-[state=active]:font-medium data-[state=active]:text-accent-foreground',
                                       'focus-visible:ring-2 focus-visible:ring-ring',
                                    )}
                                 >
                                    <Icon className="size-4 shrink-0" aria-hidden />
                                    <span className="truncate">{t(section.labelKey)}</span>
                                 </TabsPrimitive.Trigger>
                              );
                           })}
                        </div>
                     </div>
                  ))}
               </TabsPrimitive.List>

               {/* Section pane: the receding `bg-background` shade; each active pane owns its scroll. */}
               <div className="flex min-w-0 flex-1 flex-col bg-background">
                  {SECTIONS.map((section) => {
                     const Pane = section.Pane;
                     return (
                        <TabsPrimitive.Content
                           key={section.id}
                           value={section.id}
                           className="min-h-0 flex-1 overflow-y-auto px-5 py-4 outline-none"
                        >
                           <Pane />
                        </TabsPrimitive.Content>
                     );
                  })}
               </div>
            </TabsPrimitive.Root>
         </DialogContent>
      </Dialog>
   );
}
