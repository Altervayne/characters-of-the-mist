'use client';

// -- React Imports --
import React, { useState, useMemo, useEffect } from 'react';

// -- Next Imports --
import { useTranslations } from 'next-intl';

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

// -- Type Imports --
import { Card as CardData, LegendsThemeDetails } from '@/lib/types/character';
import { CreateCardOptions, LegendsThemeTypes } from '@/lib/types/creation';



type CardTypeSelection = 'CHARACTER_THEME' | 'GROUP_THEME';

interface CreateCardDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (options: CreateCardOptions, cardId?: string) => void;
  mode: 'create' | 'edit';
  cardData?: CardData;
  modal?: boolean;
}



export function CreateCardDialog({ isOpen, onOpenChange, onConfirm, mode, cardData, modal = true }: CreateCardDialogProps) {
   const t = useTranslations('CreateCardDialog');
   const tTypes = useTranslations('ThemeTypes');
   const tTheme = useTranslations();
   
   const [cardType, setCardType] = useState<'CHARACTER_THEME' | 'GROUP_THEME' | ''>('');
   const [themeType, setThemeType] = useState<LegendsThemeTypes>('Origin');
   const [themebook, setThemebook] = useState('');
   const [powerTagsCount, setPowerTagsCount] = useState(2);
   const [weaknessTagsCount, setWeaknessTagsCount] = useState(1);
   const [popoverOpen, setPopoverOpen] = useState(false);

   

   const availableThemebooks = useMemo(() => {
      if (themeType && legendsThemebooks[themeType as keyof typeof legendsThemebooks]) {
         return legendsThemebooks[themeType as keyof typeof legendsThemebooks];
      }
      return [];
   }, [themeType]);

   const selectedThemebookDisplay = useMemo(() => {
      if (themebook) {
         const selected = availableThemebooks.find(book => book.value.toLowerCase() === themebook.toLowerCase());
         return selected ? tTheme(selected.key as string) : themebook;
      }
      return t('selectThemebookPlaceholder');
   }, [themebook, availableThemebooks, tTheme, t]);

   useEffect(() => {
      if (isOpen && mode === 'edit' && cardData) {
         const details = cardData.details as LegendsThemeDetails;
         setCardType(cardData.cardType as 'CHARACTER_THEME');
         setThemeType(details.themeType);
         setThemebook(details.themebook);
         setPowerTagsCount(details.powerTags.length);
         setWeaknessTagsCount(details.weaknessTags.length);
      } else {
         setCardType('');
         setThemeType('Origin');
         setThemebook('');
      }
   }, [isOpen, mode, cardData]);

   const handleConfirm = () => {
      if (cardType) {
         onConfirm(
            { cardType, themebook: themebook.trim(), themeType, powerTagsCount, weaknessTagsCount },
            mode === 'edit' ? cardData?.id : undefined
         );
         onOpenChange(false);
      }
   };

   const handleThemeTypeChange = (value: string) => {
      if(value === 'Origin' || value === 'Adventure' || value === 'Greatness') {
         setThemeType(value);
         setThemebook('');
      }
   }

   const isConfirmDisabled = !cardType || (cardType === 'CHARACTER_THEME' && !themebook.trim());



   return (
      <Dialog open={isOpen} onOpenChange={onOpenChange} modal={modal}>
         <DialogContent data-tour="creation-dialog">
            <DialogHeader>
               <DialogTitle>{mode === 'create' ? t('title') : t('editTitle')}</DialogTitle>
               <DialogDescription>{mode === 'create' ? t('description') : t('editDescription')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-6">
               <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="card-type" className="text-left">{t('cardTypeLabel')}</Label>
                  <Select value={cardType} onValueChange={(value: CardTypeSelection) => setCardType(value)} disabled={mode === 'edit'}>
                     <SelectTrigger id="card-type" className="col-span-3 hover:bg-muted border-primary">
                        <SelectValue placeholder={t('selectPlaceholder')} />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="CHARACTER_THEME">{t('themeCard')}</SelectItem>
                        <SelectItem value="GROUP_THEME">{t('fellowshipCard')}</SelectItem>
                     </SelectContent>
                  </Select>
               </div>

               {cardType === 'CHARACTER_THEME' && (
                  <>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="theme-type" className="text-left">{t('themeTypeLabel')}</Label>
                        <Select value={themeType} onValueChange={handleThemeTypeChange}>
                           <SelectTrigger id="theme-type" className="col-span-3 hover:bg-muted border-primary">
                              <SelectValue placeholder={t('selectThemeTypePlaceholder')} />
                           </SelectTrigger>
                           <SelectContent>
                              {legendsThemeTypes.map(type => <SelectItem key={type} value={type}>{tTypes(type)}</SelectItem>)}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="themebook" className="text-left">{t('themebookLabel')}</Label>
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
                                    placeholder={t('searchThemebookPlaceholder')}
                                    value={themebook}
                                    onValueChange={setThemebook}
                                 />
                                 <CommandList>
                                    <CommandEmpty>{t('noThemebookFound')}</CommandEmpty>
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
                                          <span className="mt-6 font-bold">{t("startingTagsLabel")}</span>
                                          <div className="grid grid-cols-3 items-center gap-4">
                                             <Label htmlFor="power-tags" className="text-right">{t('powerTagCountLabel')}</Label>
                                             <Input id="power-tags" type="number" value={powerTagsCount} onChange={e => setPowerTagsCount(Number(e.target.value))} className="col-span-2" />
                                          </div>
                                          <div className="grid grid-cols-3 items-center gap-4">
                                             <Label htmlFor="weakness-tags" className="text-right">{t('weaknessTagCountLabel')}</Label>
                                             <Input id="weakness-tags" type="number" value={weaknessTagsCount} onChange={e => setWeaknessTagsCount(Number(e.target.value))} className="col-span-2" />
                                          </div>
                                       </>         
               }
            </div>

            <DialogFooter>
               <Button className={cn("cursor-pointer")} onClick={handleConfirm} disabled={isConfirmDisabled}>
                  {mode === 'create' ? t('createButton') : t('updateButton')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}