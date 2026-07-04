// -- React Imports --
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import cuid from 'cuid';

// -- Basic UI Imports --
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// -- Icon Imports --
import { Image as ImageIcon, Loader2, Minus, Plus, Trash2, Upload, X } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { MentionText } from '@/components/molecules/challenge/MentionText';

// -- Store and Hook Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';

// -- Pipeline / Asset Store --
import { processImage } from '@/lib/assets/processImage';
import { storeAsset } from '@/lib/assets/assetRepository';

// -- Constants --
import { LEGENDS_CHALLENGE_TYPES } from '@/lib/constants/challengeCard';

// -- Type Imports --
import type { Card as CardData, ChallengeAbility, ChallengeStatus, LegendsChallengeDetails, Tag } from '@/lib/types/character';

/*
 * The GM Challenge Card editor: a dedicated dialog over the full LegendsChallengeDetails (too rich for
 * inline card editing). The card stays a read-only display; this is its only editor. Local working state
 * commits on Save - the name via `updateCardTitle`, the rest via `updateCardDetails`. Fresh cuids for new
 * rows so they behave like the app's other tags.
 */

interface ChallengeCardEditorProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
   /** The challenge card being edited, or null when the dialog is closed. */
   card: CardData | null;
   modal?: boolean;
}

const newStatus = (): ChallengeStatus => ({ id: cuid(), name: '', tier: 1 });
const newTag = (): Tag => ({ id: cuid(), name: '', isActive: false, isScratched: false });
const newAbility = (): ChallengeAbility => ({ id: cuid(), tag: '', flavor: '', consequences: [] });

export function ChallengeCardEditor({ isOpen, onOpenChange, card, modal = true }: ChallengeCardEditorProps) {
   const { t } = useTranslation();

   return (
      <Dialog open={isOpen} onOpenChange={onOpenChange} modal={modal}>
         <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
               <DialogTitle>{t('ChallengeCard.editor.title')}</DialogTitle>
               <DialogDescription>{t('ChallengeCard.editor.description')}</DialogDescription>
            </DialogHeader>
            {card && <ChallengeEditorForm card={card} onDone={() => onOpenChange(false)} />}
         </DialogContent>
      </Dialog>
   );
}

/** The form body. Remounts per edit (the dialog only renders it while open), so local state starts fresh. */
function ChallengeEditorForm({ card, onDone }: { card: CardData; onDone: () => void }) {
   const { t } = useTranslation();
   const { t: tNotifications } = useTranslation();
   const { updateCardTitle, updateCardDetails } = useCharacterActions();
   const details = card.details as LegendsChallengeDetails;

   const [title, setTitle] = useState(card.title);
   const [types, setTypes] = useState<string[]>(details.types);
   const [challengeLevel, setChallengeLevel] = useState(details.challengeLevel);
   const [assetId, setAssetId] = useState<string | null>(details.assetId);
   const [flavor, setFlavor] = useState(details.flavor);
   const [limits, setLimits] = useState<ChallengeStatus[]>(details.limits);
   const [statuses, setStatuses] = useState<ChallengeStatus[]>(details.statuses);
   const [tags, setTags] = useState<Tag[]>(details.tags);
   const [abilities, setAbilities] = useState<ChallengeAbility[]>(details.abilities);
   const [customType, setCustomType] = useState('');

   const toggleType = (type: string) =>
      setTypes((current) => (current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type]));

   const addCustomType = () => {
      const trimmed = customType.trim();
      if (trimmed && !types.includes(trimmed)) setTypes((current) => [...current, trimmed]);
      setCustomType('');
   };

   const handleSave = () => {
      updateCardTitle(card.id, title.trim());
      const nextDetails: LegendsChallengeDetails = { ...details, types, challengeLevel, assetId, flavor, limits, statuses, tags, abilities };
      updateCardDetails(card.id, nextDetails);
      toast.success(tNotifications('Notifications.card.updated'));
      onDone();
   };

   // Custom types are those the user added beyond the suggested list; shown as removable chips.
   const customTypes = types.filter((type) => !LEGENDS_CHALLENGE_TYPES.includes(type as (typeof LEGENDS_CHALLENGE_TYPES)[number]));

   return (
      <div className="flex flex-col gap-5">
         {/* Name. */}
         <Field label={t('ChallengeCard.editor.name')}>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('ChallengeCard.editor.namePlaceholder')} />
         </Field>

         {/* Types: suggested toggles + custom entry. */}
         <Field label={t('ChallengeCard.editor.types')}>
            <div className="flex flex-wrap gap-1.5">
               {LEGENDS_CHALLENGE_TYPES.map((type) => (
                  <button
                     key={type}
                     type="button"
                     onClick={() => toggleType(type)}
                     className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors',
                        types.includes(type) ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-foreground',
                     )}
                  >
                     {type}
                  </button>
               ))}
            </div>
            {customTypes.length > 0 && (
               <div className="mt-2 flex flex-wrap gap-1.5">
                  {customTypes.map((type) => (
                     <span key={type} className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                        {type}
                        <button type="button" onClick={() => toggleType(type)} className="cursor-pointer" aria-label={t('ChallengeCard.editor.removeType')}><X className="h-3 w-3" /></button>
                     </span>
                  ))}
               </div>
            )}
            <div className="mt-2 flex items-center gap-2">
               <Input
                  value={customType}
                  onChange={(event) => setCustomType(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomType(); } }}
                  placeholder={t('ChallengeCard.editor.customTypePlaceholder')}
                  className="h-8 text-sm"
               />
               <Button type="button" variant="outline" size="sm" onClick={addCustomType} className="cursor-pointer">{t('ChallengeCard.editor.addType')}</Button>
            </div>
         </Field>

         {/* Challenge level (1-10) + image side by side. */}
         <div className="grid grid-cols-2 gap-4">
            <Field label={t('ChallengeCard.editor.challengeLevel')}>
               <Stepper value={challengeLevel} min={1} max={10} onChange={setChallengeLevel} />
            </Field>
            <Field label={t('ChallengeCard.editor.image')}>
               <ImagePicker assetId={assetId} onChange={setAssetId} />
            </Field>
         </div>

         {/* Flavor. */}
         <Field label={t('ChallengeCard.editor.flavor')}>
            <Textarea value={flavor} onChange={(event) => setFlavor(event.target.value)} placeholder={t('ChallengeCard.editor.flavorPlaceholder')} className="min-h-20 resize-none" />
            <MentionPreview text={flavor} />
         </Field>

         {/* Limits: the win-conditions. */}
         <ListSection
            label={t('ChallengeCard.editor.limits')}
            addLabel={t('ChallengeCard.editor.addLimit')}
            onAdd={() => setLimits((current) => [...current, newStatus()])}
         >
            {limits.map((limit) => (
               <StatusRow
                  key={limit.id}
                  status={limit}
                  namePlaceholder={t('ChallengeCard.editor.limitNamePlaceholder')}
                  onChange={(next) => setLimits((current) => current.map((entry) => (entry.id === limit.id ? next : entry)))}
                  onRemove={() => setLimits((current) => current.filter((entry) => entry.id !== limit.id))}
                  removeLabel={t('ChallengeCard.editor.remove')}
               />
            ))}
         </ListSection>

         {/* Statuses (name + tier). */}
         <ListSection
            label={t('ChallengeCard.editor.statuses')}
            addLabel={t('ChallengeCard.editor.addStatus')}
            onAdd={() => setStatuses((current) => [...current, newStatus()])}
         >
            {statuses.map((status) => (
               <StatusRow
                  key={status.id}
                  status={status}
                  namePlaceholder={t('ChallengeCard.editor.statusNamePlaceholder')}
                  onChange={(next) => setStatuses((current) => current.map((entry) => (entry.id === status.id ? next : entry)))}
                  onRemove={() => setStatuses((current) => current.filter((entry) => entry.id !== status.id))}
                  removeLabel={t('ChallengeCard.editor.remove')}
               />
            ))}
         </ListSection>

         {/* Tags (name only). */}
         <ListSection
            label={t('ChallengeCard.editor.tags')}
            addLabel={t('ChallengeCard.editor.addTag')}
            onAdd={() => setTags((current) => [...current, newTag()])}
         >
            {tags.map((tag) => (
               <div key={tag.id} className="flex items-center gap-2">
                  <Input
                     value={tag.name}
                     onChange={(event) => setTags((current) => current.map((entry) => (entry.id === tag.id ? { ...entry, name: event.target.value } : entry)))}
                     placeholder={t('ChallengeCard.editor.tagNamePlaceholder')}
                     className="h-8 text-sm"
                  />
                  <IconButton onClick={() => setTags((current) => current.filter((entry) => entry.id !== tag.id))} label={t('ChallengeCard.editor.remove')}><Trash2 className="h-4 w-4" /></IconButton>
               </div>
            ))}
         </ListSection>

         {/* Abilities: tag + flavor + nested consequences. */}
         <ListSection
            label={t('ChallengeCard.editor.abilities')}
            addLabel={t('ChallengeCard.editor.addAbility')}
            onAdd={() => setAbilities((current) => [...current, newAbility()])}
         >
            {abilities.map((ability) => (
               <AbilityRow
                  key={ability.id}
                  ability={ability}
                  onChange={(next) => setAbilities((current) => current.map((entry) => (entry.id === ability.id ? next : entry)))}
                  onRemove={() => setAbilities((current) => current.filter((entry) => entry.id !== ability.id))}
               />
            ))}
         </ListSection>

         <DialogFooter>
            <Button type="button" variant="outline" onClick={onDone} className="cursor-pointer">{t('ChallengeCard.editor.cancel')}</Button>
            <Button type="button" onClick={handleSave} className="cursor-pointer">{t('ChallengeCard.editor.save')}</Button>
         </DialogFooter>
      </div>
   );
}

/** A labeled field wrapper. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
   return (
      <div className="flex flex-col gap-1.5">
         <Label className="text-sm font-semibold">{label}</Label>
         {children}
      </div>
   );
}

/** A labeled dynamic-list section with an add button. */
function ListSection({ label, addLabel, onAdd, children }: { label: string; addLabel: string; onAdd: () => void; children: React.ReactNode }) {
   return (
      <div className="flex flex-col gap-1.5">
         <Label className="text-sm font-semibold">{label}</Label>
         <div className="flex flex-col gap-1.5">{children}</div>
         <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="mt-1 w-full cursor-pointer border border-dashed">
            <Plus className="mr-1 h-4 w-4" />{addLabel}
         </Button>
      </div>
   );
}

/** A live styled preview of authored text, shown once it carries a `[bracket]` mention. */
function MentionPreview({ text }: { text: string }) {
   if (!text.includes('[')) return null;
   return (
      <div className="whitespace-pre-wrap rounded bg-muted/50 px-2 py-1 text-xs leading-relaxed">
         <MentionText text={text} />
      </div>
   );
}

/** A `{ name, tier }` row (limits + statuses). */
function StatusRow({ status, namePlaceholder, onChange, onRemove, removeLabel }: {
   status: ChallengeStatus;
   namePlaceholder: string;
   onChange: (next: ChallengeStatus) => void;
   onRemove: () => void;
   removeLabel: string;
}) {
   return (
      <div className="flex items-center gap-2">
         <Input value={status.name} onChange={(event) => onChange({ ...status, name: event.target.value })} placeholder={namePlaceholder} className="h-8 text-sm" />
         <Stepper value={status.tier} min={0} max={999} onChange={(tier) => onChange({ ...status, tier })} />
         <IconButton onClick={onRemove} label={removeLabel}><Trash2 className="h-4 w-4" /></IconButton>
      </div>
   );
}

/** An ability row: tag + flavor + a nested consequence list. */
function AbilityRow({ ability, onChange, onRemove }: { ability: ChallengeAbility; onChange: (next: ChallengeAbility) => void; onRemove: () => void }) {
   const { t } = useTranslation();
   return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-2">
         <div className="flex items-center gap-2">
            <Input value={ability.tag} onChange={(event) => onChange({ ...ability, tag: event.target.value })} placeholder={t('ChallengeCard.editor.abilityTagPlaceholder')} className="h-8 text-sm font-semibold" />
            <IconButton onClick={onRemove} label={t('ChallengeCard.editor.removeAbility')}><Trash2 className="h-4 w-4" /></IconButton>
         </div>
         <Textarea value={ability.flavor} onChange={(event) => onChange({ ...ability, flavor: event.target.value })} placeholder={t('ChallengeCard.editor.abilityFlavorPlaceholder')} className="min-h-14 resize-none text-sm" />
         <MentionPreview text={ability.flavor} />
         <div className="flex flex-col gap-1.5 pl-2">
            <Label className="text-xs font-semibold text-muted-foreground">{t('ChallengeCard.editor.consequences')}</Label>
            {ability.consequences.map((consequence, index) => (
               <div key={index} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                     <Input
                        value={consequence}
                        onChange={(event) => onChange({ ...ability, consequences: ability.consequences.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)) })}
                        placeholder={t('ChallengeCard.editor.consequencePlaceholder')}
                        className="h-8 text-sm"
                     />
                     <IconButton onClick={() => onChange({ ...ability, consequences: ability.consequences.filter((_, entryIndex) => entryIndex !== index) })} label={t('ChallengeCard.editor.remove')}><Trash2 className="h-4 w-4" /></IconButton>
                  </div>
                  <MentionPreview text={consequence} />
               </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...ability, consequences: [...ability.consequences, ''] })} className="cursor-pointer border border-dashed">
               <Plus className="mr-1 h-4 w-4" />{t('ChallengeCard.editor.addConsequence')}
            </Button>
         </div>
      </div>
   );
}

/** A −/value/+ stepper clamped to `[min, max]`. */
function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (value: number) => void }) {
   const set = (next: number) => onChange(Math.max(min, Math.min(max, next)));
   return (
      <div className="flex shrink-0 items-center gap-1 rounded-md border border-border px-1 py-0.5">
         <IconButton onClick={() => set(value - 1)} label="-"><Minus className="h-4 w-4" /></IconButton>
         <span className="w-7 text-center font-mono text-sm tabular-nums">{value}</span>
         <IconButton onClick={() => set(value + 1)} label="+"><Plus className="h-4 w-4" /></IconButton>
      </div>
   );
}

/** A small square ghost button for row controls. */
function IconButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
   return (
      <button type="button" onClick={onClick} title={label} aria-label={label} className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer">
         {children}
      </button>
   );
}

/** The image field: reuses the asset pipeline (process -> store -> hash), showing a preview or an upload prompt. */
function ImagePicker({ assetId, onChange }: { assetId: string | null; onChange: (assetId: string | null) => void }) {
   const { t } = useTranslation();
   const { url, isLoading } = useAssetObjectUrl(assetId);
   const [isProcessing, setIsProcessing] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const showSpinner = isProcessing || (assetId !== null && isLoading);

   const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      setIsProcessing(true);
      try {
         const processed = await processImage(file);
         const hash = await storeAsset(processed);
         onChange(hash);
      } catch {
         toast.error(t('ImageCard.uploadFailed'));
      } finally {
         setIsProcessing(false);
      }
   };

   return (
      <div className="flex items-center gap-2">
         <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            {showSpinner ? (
               <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : url ? (
               <img src={url} alt="" className="h-full w-full object-cover" />
            ) : (
               <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>
            )}
         </div>
         <div className="flex flex-col gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
               <Upload className="mr-1 h-4 w-4" />{url ? t('ChallengeCard.editor.changeImage') : t('ChallengeCard.editor.setImage')}
            </Button>
            {url && (
               <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} className="cursor-pointer text-destructive">
                  <Trash2 className="mr-1 h-4 w-4" />{t('ChallengeCard.editor.removeImage')}
               </Button>
            )}
         </div>
         <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
      </div>
   );
}
