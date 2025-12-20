'use client';

// -- React Imports --
import React, { useState, useMemo, useEffect } from 'react';

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

// -- Icon Imports --
import { Check, ChevronsUpDown } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { legendsThemeTypes, legendsThemebooks } from '@/lib/data/legends-data';
import { cityThemeTypes, cityThemebooks } from '@/lib/data/city-data';
import { otherscapeThemeTypes, otherscapeThemebooks } from '@/lib/data/otherscape-data';

// -- Type Imports --
import { Card as CardData, LegendsThemeDetails, CityThemeDetails, OtherscapeThemeDetails } from '@/lib/types/character';
import { CreateCardOptions, ThemeTypeUnion } from '@/lib/types/creation';
import { GameSystem } from '@/lib/types/drawer';


type CardTypeSelection = 'CHARACTER_THEME' | 'GROUP_THEME' | 'LOADOUT_THEME';

interface CreateCardDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (options: CreateCardOptions, cardId?: string) => void;
  mode: 'create' | 'edit';
  cardData?: CardData;
  modal?: boolean;
  game: GameSystem;
}



export function CreateCardDialog({ isOpen, onOpenChange, onConfirm, mode, cardData, modal = true, game }: CreateCardDialogProps) {
   const { t: t } = useTranslation();
   const { t: tTypes } = useTranslation();
   const tTheme = useTranslations();

   const [cardType, setCardType] = useState<'CHARACTER_THEME' | 'GROUP_THEME' | 'LOADOUT_THEME' | ''>('');
   const [themeType, setThemeType] = useState<ThemeTypeUnion>(
      game === 'LEGENDS' ? 'Origin' : game === 'OTHERSCAPE' ? 'Mythos' : 'Mythos'
   );
   const [themebook, setThemebook] = useState('');
   const [powerTagsCount, setPowerTagsCount] = useState(2);
   const [weaknessTagsCount, setWeaknessTagsCount] = useState(1);
   const [wildcardSlots, setWildcardSlots] = useState(0);
   const [popoverOpen, setPopoverOpen] = useState(false);

   // Get the appropriate theme types based on game
   const themeTypes = game === 'LEGENDS' ? legendsThemeTypes : game === 'OTHERSCAPE' ? otherscapeThemeTypes : cityThemeTypes;



   const availableThemebooks = useMemo(() => {
      if (!themeType) return [];

      if (game === 'LEGENDS' && (themeType === 'Origin' || themeType === 'Adventure' || themeType === 'Greatness')) {
         return legendsThemebooks[themeType];
      } else if (game === 'CITY_OF_MIST' && (themeType === 'Mythos' || themeType === 'Logos')) {
         return cityThemebooks[themeType];
      } else if (game === 'OTHERSCAPE' && (themeType === 'Mythos' || themeType === 'Self' || themeType === 'Noise')) {
         return otherscapeThemebooks[themeType];
      }
      return [];
   }, [themeType, game]);

   const selectedThemebookDisplay = useMemo(() => {
      if (themebook) {
         const selected = availableThemebooks.find(book => book.value.toLowerCase() === themebook.toLowerCase());
         return selected ? tTheme(selected.key as string) : themebook;
      }
      return t('CreateCardDialog.selectThemebookPlaceholder');
   }, [themebook, availableThemebooks, tTheme, t]);

   useEffect(() => {
      if (isOpen && mode === 'edit' && cardData) {
         if (game === 'LEGENDS') {
            const details = cardData.details as LegendsThemeDetails;
            setCardType(cardData.cardType as 'CHARACTER_THEME');
            setThemeType(details.themeType);
            setThemebook(details.themebook);
            setPowerTagsCount(details.powerTags.length);
            setWeaknessTagsCount(details.weaknessTags.length);
         } else if (game === 'CITY_OF_MIST') {
            const details = cardData.details as CityThemeDetails;
            setCardType(cardData.cardType as 'CHARACTER_THEME');
            setThemeType(details.themeType);
            setThemebook(details.themebook);
            setPowerTagsCount(details.powerTags.length);
            setWeaknessTagsCount(details.weaknessTags.length);
         } else if (game === 'OTHERSCAPE') {
            const details = cardData.details as OtherscapeThemeDetails;
            setCardType(cardData.cardType as 'CHARACTER_THEME');
            setThemeType(details.themeType);
            setThemebook(details.themebook);
            setPowerTagsCount(details.powerTags.length);
            setWeaknessTagsCount(details.weaknessTags.length);
         }
      } else {
         setCardType('');
         setThemeType(game === 'LEGENDS' ? 'Origin' : game === 'OTHERSCAPE' ? 'Mythos' : 'Mythos');
         setThemebook('');
      }
   }, [isOpen, mode, cardData, game]);

   const handleConfirm = () => {
      if (cardType) {
         onConfirm(
            { cardType, themebook: themebook.trim(), themeType, powerTagsCount, weaknessTagsCount, wildcardSlots },
            mode === 'edit' ? cardData?.id : undefined
         );
         onOpenChange(false);
      }
   };

   const handleThemeTypeChange = (value: string) => {
      if (game === 'LEGENDS') {
         if (value === 'Origin' || value === 'Adventure' || value === 'Greatness') {
            setThemeType(value);
            setThemebook('');
         }
      } else if (game === 'CITY_OF_MIST') {
         if (value === 'Mythos' || value === 'Logos') {
            setThemeType(value);
            setThemebook('');
         }
      } else if (game === 'OTHERSCAPE') {
         if (value === 'Mythos' || value === 'Self' || value === 'Noise') {
            setThemeType(value);
            setThemebook('');
         }
      }
   }

   const isConfirmDisabled = !cardType ||
      (cardType === 'CHARACTER_THEME' && !themebook.trim()) ||
      (cardType === 'CHARACTER_THEME' && !themeType) ||
      (cardType === 'GROUP_THEME' && game === 'LEGENDS' && !themebook.trim()) ||
      (cardType === 'GROUP_THEME' && game === 'LEGENDS' && !themeType);



   return (
      <Dialog open={isOpen} onOpenChange={onOpenChange} modal={modal}>
         <DialogContent data-tour="creation-dialog">
            <DialogHeader>
               <DialogTitle>{mode === 'create' ? t('CreateCardDialog.title') : t('CreateCardDialog.editTitle')}</DialogTitle>
               <DialogDescription>{mode === 'create' ? t('CreateCardDialog.description') : t('CreateCardDialog.editDescription')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-6">
               <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="card-type" className="text-left">{t('CreateCardDialog.cardTypeLabel')}</Label>
                  <Select value={cardType} onValueChange={(value: CardTypeSelection) => setCardType(value)} disabled={mode === 'edit'}>
                     <SelectTrigger id="card-type" className="col-span-3 hover:bg-muted border-primary">
                        <SelectValue placeholder={t('CreateCardDialog.selectPlaceholder')} />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="CHARACTER_THEME">{game === 'LEGENDS' ? t('CreateCardDialog.themeCard') : game === 'OTHERSCAPE' ? t('CreateCardDialog.otherscapeThemeCard') : t('CreateCardDialog.riftThemeCard')}</SelectItem>
                        {game === 'LEGENDS' && <SelectItem value="GROUP_THEME">{t('CreateCardDialog.fellowshipCard')}</SelectItem>}
                        {game === 'CITY_OF_MIST' && <SelectItem value="GROUP_THEME">{t('CreateCardDialog.crewCard')}</SelectItem>}
                        {game === 'OTHERSCAPE' && <SelectItem value="GROUP_THEME">{t('CreateCardDialog.otherscapeCrewCard')}</SelectItem>}
                        {game === 'OTHERSCAPE' && <SelectItem value="LOADOUT_THEME">{t('CreateCardDialog.otherscapeLoadoutCard')}</SelectItem>}
                     </SelectContent>
                  </Select>
               </div>

               {cardType === 'CHARACTER_THEME' && (
                  <>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="theme-type" className="text-left">{t('CreateCardDialog.themeTypeLabel')}</Label>
                        <Select value={themeType} onValueChange={handleThemeTypeChange}>
                           <SelectTrigger id="theme-type" className="col-span-3 hover:bg-muted border-primary">
                              <SelectValue placeholder={t('CreateCardDialog.selectThemeTypePlaceholder')} />
                           </SelectTrigger>
                           <SelectContent>
                              {themeTypes.map(type => <SelectItem key={type} value={type}>{tTypes(type)}</SelectItem>)}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="themebook" className="text-left">{t('CreateCardDialog.themebookLabel')}</Label>
                        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                           <PopoverTrigger asChild>
                              <Button
                                 variant="outline"
                                 role="combobox"
                                 aria-expanded={popoverOpen}
                                 className="col-span-3 justify-between"
                                 disabled={!themeType}
                              >
                                 {selectedThemebookDisplay}
                                 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                           </PopoverTrigger>
                           <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[var(--radix-popover-trigger-width)] p-0">
                              <Command>
                                 <CommandInput
                                    placeholder={t('CreateCardDialog.searchThemebookPlaceholder')}
                                    value={themebook}
                                    onValueChange={setThemebook}
                                 />
                                 <CommandList>
                                    <CommandEmpty>{t('CreateCardDialog.noThemebookFound')}</CommandEmpty>
                                    <CommandGroup onWheel={(e) => e.stopPropagation()}>
                                       {availableThemebooks.map((book) => (
                                          <CommandItem
                                             key={book.value}
                                             value={book.value}
                                             onSelect={(currentValue) => {
                                                setThemebook(currentValue);
                                                setPopoverOpen(false);
                                             }}
                                          >
                                             <Check
                                                className={cn(
                                                   "mr-2 h-4 w-4",
                                                   themebook.toLowerCase() === book.value.toLowerCase() ? "opacity-100" : "opacity-0"
                                                )}
                                             />
                                                {tTheme(book.key as string)}
                                          </CommandItem>
                                       ))}
                                    </CommandGroup>
                                 </CommandList>
                              </Command>
                           </PopoverContent>
                        </Popover>
                     </div>
                  </>
               )}


               {(cardType === 'GROUP_THEME' && game === 'LEGENDS') && (
                  <>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="theme-type" className="text-left">{t('CreateCardDialog.themeTypeLabel')}</Label>
                        <Select value={themeType} onValueChange={handleThemeTypeChange}>
                           <SelectTrigger id="theme-type" className="col-span-3 hover:bg-muted border-primary">
                              <SelectValue placeholder={t('CreateCardDialog.selectThemeTypePlaceholder')} />
                           </SelectTrigger>
                           <SelectContent>
                              {themeTypes.map(type => <SelectItem key={type} value={type}>{tTypes(type)}</SelectItem>)}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="themebook" className="text-left">{t('CreateCardDialog.themebookLabel')}</Label>
                        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                           <PopoverTrigger asChild>
                              <Button
                                 variant="outline"
                                 role="combobox"
                                 aria-expanded={popoverOpen}
                                 className="col-span-3 justify-between"
                                 disabled={!themeType}
                              >
                                 {selectedThemebookDisplay}
                                 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                           </PopoverTrigger>
                           <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[var(--radix-popover-trigger-width)] p-0">
                              <Command>
                                 <CommandInput
                                    placeholder={t('CreateCardDialog.searchThemebookPlaceholder')}
                                    value={themebook}
                                    onValueChange={setThemebook}
                                 />
                                 <CommandList>
                                    <CommandEmpty>{t('CreateCardDialog.noThemebookFound')}</CommandEmpty>
                                    <CommandGroup onWheel={(e) => e.stopPropagation()}>
                                       {availableThemebooks.map((book) => (
                                          <CommandItem
                                             key={book.value}
                                             value={book.value}
                                             onSelect={(currentValue) => {
                                                setThemebook(currentValue);
                                                setPopoverOpen(false);
                                             }}
                                          >
                                             <Check
                                                className={cn(
                                                   "mr-2 h-4 w-4",
                                                   themebook.toLowerCase() === book.value.toLowerCase() ? "opacity-100" : "opacity-0"
                                                )}
                                             />
                                                {tTheme(book.key as string)}
                                          </CommandItem>
                                       ))}
                                    </CommandGroup>
                                 </CommandList>
                              </Command>
                           </PopoverContent>
                        </Popover>
                     </div>
                  </>
               )}

               {
                  mode === 'create' && <>
                                          <span className="mt-6 font-bold">{t("CreateCardDialog.startingTagsLabel")}</span>
                                          <div className="grid grid-cols-3 items-center gap-4">
                                             <Label htmlFor="power-tags" className="text-right">{cardType === 'LOADOUT_THEME' ? t('CreateCardDialog.gearTagCountLabel') : t('CreateCardDialog.powerTagCountLabel')}</Label>
                                             <Input id="power-tags" type="number" value={powerTagsCount} onChange={e => setPowerTagsCount(Number(e.target.value))} className="col-span-2" />
                                          </div>
                                          <div className="grid grid-cols-3 items-center gap-4">
                                             <Label htmlFor="weakness-tags" className="text-right">{cardType === 'LOADOUT_THEME' ? t('CreateCardDialog.flawTagCountLabel') : t('CreateCardDialog.weaknessTagCountLabel')}</Label>
                                             <Input id="weakness-tags" type="number" value={weaknessTagsCount} onChange={e => setWeaknessTagsCount(Number(e.target.value))} className="col-span-2" />
                                          </div>
                                          {cardType === 'LOADOUT_THEME' && (
                                             <div className="grid grid-cols-3 items-center gap-4">
                                                <Label htmlFor="wildcard-slots" className="text-right">{t('CreateCardDialog.wildcardSlotsLabel')}</Label>
                                                <Input id="wildcard-slots" type="number" value={wildcardSlots} onChange={e => setWildcardSlots(Number(e.target.value))} className="col-span-2" />
                                             </div>
                                          )}
                                       </>
               }
            </div>

            <DialogFooter>
               <Button className={cn("cursor-pointer")} onClick={handleConfirm} disabled={isConfirmDisabled}>
                  {mode === 'create' ? t('CreateCardDialog.createButton') : t('CreateCardDialog.updateButton')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}
