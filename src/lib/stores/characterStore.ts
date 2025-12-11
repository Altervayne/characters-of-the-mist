// -- Other Library Imports --
import { create } from 'zustand';
import { temporal } from 'zundo';
import { persist, createJSONStorage } from 'zustand/middleware';
import cuid from 'cuid';

// -- Utils Imports --
import { createNewCharacter } from '../utils/character';
import { deepReId } from '../utils/drawer';
import { harmonizeData } from '../harmonization';
import { STORE_VERSION } from '../config';

// -- Store and Hook Imports --
import { useAppGeneralStateStore } from './appGeneralStateStore';

// -- Type Imports --
import { Character, Card, Tag, LegendsThemeDetails, StatusTracker, StoryTagTracker, Tracker, LegendsHeroDetails, LegendsFellowshipDetails, FellowshipRelationship, BlandTag, CardDetails, CardViewMode, StoryThemeTracker, CrewMember, CityRiftDetails } from '@/lib/types/character';
import { GeneralItemType, GameSystem } from '../types/drawer';
import { CreateCardOptions } from '../types/creation';



type TagListName = 'powerTags' | 'weaknessTags' | 'items';
type BlandTagListName = 'quintessences' | 'improvements' | 'backpack' | 'nemeses';
type IndexableCardDetails = CardDetails & { [key in BlandTagListName]?: BlandTag[] };

const hasBlandTagList = (details: CardDetails, listName: string): listName is BlandTagListName => {
   return listName in details && Array.isArray((details as unknown as { [key: string]: unknown })[listName]);
};



interface CharacterState {
   character: Character | null;
   actions: {
      createCharacter: (game: GameSystem) => void;
      loadCharacter: (character: Character, drawerItemId?: string) => void;
      resetCharacter: () => void;
      unloadCharacter: () => void;
      setGame: (game: Character['game']) => void;
      updateCharacterName: (name: string) => void;
      // --- Card Actions --- 
      addCard: (options: CreateCardOptions) => void;
      addImportedCard: (card: Card, index?: number) => void;
      deleteCard: (cardId: string) => void;
      updateCardDetails: (cardId: string, newDetails: Partial<CardDetails>) => void;
      reorderCards: (startIndex: number, endIndex: number) => void;
      flipCard: (cardId: string) => void;
      updateCardViewMode: (cardId: string, viewMode: CardViewMode | null) => void;
      // --- Tag Actions --- 
      addTag: (cardId: string, listName: TagListName) => void;
      updateTag: (cardId: string, listName: TagListName, tagId: string, updatedTag: Partial<Tag>) => void;
      removeTag: (cardId: string, listName: TagListName, tagId: string) => void;
      // --- Bland Tag Actions (for Quintessences, Items and Improvements) --- 
      addBlandTag: (cardId: string, listName: BlandTagListName) => void;
      updateBlandTag: (cardId: string, listName: BlandTagListName, tagId: string, name: string) => void;
      removeBlandTag: (cardId: string, listName: BlandTagListName, tagId: string) => void;
      // --- Tracker Actions --- 
      addStatus: (name?: string) => void;
      addStoryTag: (name?: string) => void;
      addStoryTheme: (name?: string) => void;
      addImportedTracker: (tracker: Tracker, index?: number) => void;
      removeStatus: (trackerId: string) => void;
      removeStoryTag: (trackerId: string) => void;
      removeStoryTheme: (trackerId: string) => void;
      updateStatus: (trackerId: string, updates: Partial<StatusTracker>) => void;
      updateStoryTag: (trackerId: string, updates: Partial<StoryTagTracker>) => void;
      updateStoryTheme: (trackerId: string, updates: Partial<StoryThemeTracker>) => void;
      reorderStatuses: (oldIndex: number, newIndex: number) => void;
      reorderStoryTags: (oldIndex: number, newIndex: number) => void;
      reorderStoryThemes: (oldIndex: number, newIndex: number) => void;
      upgradeStoryTagToTheme: (trackerId: string) => void;
      downgradeStoryThemeToTag: (trackerId: string) => void;
      // --- Story Themes Tag Actions ---
      addTagToStoryTheme: (trackerId: string, listName: 'powerTags' | 'weaknessTags') => void;
      updateTagInStoryTheme: (trackerId: string, listName: 'mainTag' | 'powerTags' | 'weaknessTags', tagId: string, updatedTag: Partial<Tag>) => void;
      removeTagFromStoryTheme: (trackerId: string, listName: 'powerTags' | 'weaknessTags', tagId: string) => void;
      // --- Legends in the Mist ### Fellowship Relationship Actions --- 
      addRelationship: (cardId: string) => void;
      updateRelationship: (cardId: string, relationshipId: string, updates: Partial<FellowshipRelationship>) => void;
      removeRelationship: (cardId: string, relationshipId: string) => void;
      // --- City of Mist ### Crew Actions --- 
      addCrewMember: (cardId: string) => void;
      updateCrewMember: (cardId: string, crewId: string, updates: Partial<CrewMember>) => void;
      removeCrewMember: (cardId: string, crewId: string) => void;
   };
}



const initialState: Pick<CharacterState, 'character'> = {
   character: null,
};

const updateCardInState = (state: CharacterState, cardId: string, updateFn: (card: Card) => Card): CharacterState => {
   if (!state.character) return state;
   return {
      ...state,
      character: {
         ...state.character,
         cards: state.character.cards.map(card => card.id === cardId ? updateFn(card) : card),
      },
   };
};



export const useCharacterStore = create<CharacterState>()(
   temporal(
      persist(
         (set) => ({
            ...initialState,
            actions: {
               // --- Character Actions ---
               createCharacter: (game) => {
                  set(() => {
                    const newCharacter = createNewCharacter("New Character", game);
                    useCharacterStore.temporal.getState().clear(); 
                    useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                    return { character: newCharacter };
                  });
               },
               loadCharacter: (character: Character, drawerItemId?: string) => {
                  set(() => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     return { character: {
                        ...character,
                        drawerItemId: drawerItemId
                     } }
                  })
               },
               resetCharacter: () => {
                  set((state) => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     const newCharacter = createNewCharacter("New Character", state.character.game);
                     return { character: newCharacter };
                  });
               },
               unloadCharacter: () => {
                  set(() => {
                     useCharacterStore.temporal.getState().clear();
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     return { character: null };
                  });
               },
               updateCharacterName: (name) => {
                  set((state) => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');

                     const updatedCharacter = { ...state.character, name };

                     updatedCharacter.cards = updatedCharacter.cards.map(card => {
                        if (card.cardType === 'CHARACTER_CARD' && card.details.game === 'LEGENDS') {
                           const details = card.details as LegendsHeroDetails;
                           return {
                              ...card,
                              details: {
                                    ...details,
                                    characterName: name,
                              }
                           };
                        } else if (card.details.game === 'CITY_OF_MIST') {
                           const details = card.details as CityRiftDetails;
                           return {
                              ...card,
                              details: {
                                 ...details,
                                 characterName: name,
                              }
                           };
                        }
                        return card;
                     });

                     return { character: updatedCharacter };
                  });
               },
               setGame: (game) => {
                  set((state) => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     return { character: { ...state.character, game } };
                  });
               },
               // --- Card Actions ---
               addCard: (options) => {
                  set((state) => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     
                     let newCard: Card | null = null;
                     const baseCard = {
                        id: cuid(),
                        order: state.character.cards.length,
                        isFlipped: false,
                     };
                     const createTags = (count: number): Tag[] => Array.from({ length: count }, () => ({ id: cuid(), name: '', isActive: false, isScratched: false }));

                     if (state.character.game === 'LEGENDS') {
                        switch (options.cardType) {
                           case 'GROUP_THEME':
                              newCard = {
                                 ...baseCard,
                                 cardType: 'GROUP_THEME',
                                 title: `${state.character.name}'s Fellowship Theme Card`,
                                 details: {
                                    game: 'LEGENDS',
                                    milestone: 0,
                                    abandon: 0,
                                    improve: 0,
                                    mainTag: { id: cuid(), name: options.mainTagName || '', isActive: false, isScratched: false },
                                    powerTags: createTags(options.powerTagsCount),
                                    weaknessTags: createTags(options.weaknessTagsCount),
                                    quest: '',
                                    improvements: [],
                                 } as LegendsFellowshipDetails
                              };
                              break;

                           case 'CHARACTER_THEME':
                              newCard = {
                                 ...baseCard,
                                 cardType: 'CHARACTER_THEME',
                                 title: `${state.character.name}'s Theme Card - ${options.themebook + '/' || ''}${options.themeType}` || '',
                                 details: {
                                    game: 'LEGENDS',
                                    themebook: options.themebook || '',
                                    themeType: options.themeType || 'Origin',
                                    milestone: 0,
                                    abandon: 0,
                                    improve: 0,
                                    mainTag: { id: cuid(), name: options.mainTagName || '', isActive: false, isScratched: false },
                                    powerTags: createTags(options.powerTagsCount),
                                    weaknessTags: createTags(options.weaknessTagsCount),
                                    quest: '',
                                    improvements: [],
                                 } as LegendsThemeDetails,
                              };
                              break;
                        }
                     }

                     if (!newCard) return {};

                     return {
                        character: {
                           ...state.character,
                           cards: [...state.character.cards, newCard],
                        },
                     };
                  });
               },
               addImportedCard: (card, index) => {
                  set((state) => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     
                     const newCardCopy = deepReId(card);
                     let finalCards: Card[];
                     let newCharacterName = state.character.name;

                     const uniqueCharacterCardTypes: GeneralItemType[] = ['CHARACTER_CARD'];

                     if (uniqueCharacterCardTypes.includes(newCardCopy.cardType)) {
                        const originalUniqueCard = state.character.cards.find(c => uniqueCharacterCardTypes.includes(c.cardType));
                        const originalOrder = originalUniqueCard ? originalUniqueCard.order : 0;
                        newCardCopy.order = originalOrder;

                        finalCards = state.character.cards.map(c => 
                           uniqueCharacterCardTypes.includes(c.cardType) ? newCardCopy : c
                        );

                        if (newCardCopy.details.game === 'LEGENDS') {
                           newCharacterName = (newCardCopy.details as LegendsHeroDetails).characterName;
                        } else if (newCardCopy.details.game === 'CITY_OF_MIST') {
                           newCharacterName = (newCardCopy.details as CityRiftDetails).characterName;
                        };

                     } else {
                        const newCards = [...state.character.cards];
                        const insertionIndex = index ?? newCards.length;
                        newCards.splice(insertionIndex, 0, newCardCopy);
                        
                        finalCards = newCards.map((c, idx) => ({ ...c, order: idx }));
                     }

                     return {
                        character: {
                           ...state.character,
                           name: newCharacterName,
                           cards: finalCards,
                        },
                     };
                  });
               },
               deleteCard: (cardId) => {
                  set((state) => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     return {
                        character: {
                           ...state.character,
                           cards: state.character.cards.filter((card) => card.id !== cardId),
                        },
                     };
                  });
               },
               updateCardDetails: (cardId, newDetails) => {
                  set(state => {
                  useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                  return updateCardInState(state, cardId, card => ({
                        ...card,
                        details: { ...card.details, ...newDetails } as CardDetails
                     }))
                  });
               },
               reorderCards: (startIndex, endIndex) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     const result = Array.from(state.character.cards);
                     const [removed] = result.splice(startIndex, 1);
                     result.splice(endIndex, 0, removed);
                     const orderedCards = result.map((card, index) => ({ ...card, order: index }));
                     return { character: { ...state.character, cards: orderedCards } };
                  })
               },
               flipCard: (cardId) => {
                  set(state => {
                  useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                  return updateCardInState(state, cardId, card => ({
                        ...card,
                        isFlipped: !card.isFlipped,
                     }))
                  });
               },
               updateCardViewMode: (cardId, viewMode) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     return updateCardInState(state, cardId, card => ({
                        ...card,
                        viewMode: viewMode,
                     }));
                  });
               },
               // --- Tag Actions ---
               addTag: (cardId, listName) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     const newTag: Tag = { id: cuid(), name: '', isActive: false, isScratched: false };
                     
                     if ('powerTags' in card.details) {
                        const details = card.details as LegendsThemeDetails | LegendsFellowshipDetails;
                        const updatedDetails = { ...details };

                        if (listName === 'powerTags') {
                           updatedDetails.powerTags = [...details.powerTags, newTag];
                        } else if (listName === 'weaknessTags') {
                           updatedDetails.weaknessTags = [...details.weaknessTags, newTag];
                        }
                        
                        return { ...card, details: updatedDetails };
                     }
                     return card;
                  }));
               },
               updateTag: (cardId, listName, tagId, updatedTag) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     if ('powerTags' in card.details) {
                        const details = card.details as LegendsThemeDetails | LegendsFellowshipDetails;
                        const updatedDetails = { ...details };
                        const updateList = (list: Tag[]) => list.map(tag => tag.id === tagId ? { ...tag, ...updatedTag } : tag);

                        if (listName === 'powerTags') {
                           updatedDetails.powerTags = updateList(details.powerTags);
                        } else if (listName === 'weaknessTags') {
                           updatedDetails.weaknessTags = updateList(details.weaknessTags);
                        }

                        return { ...card, details: updatedDetails };
                     }
                     return card;
                  }));
               },
               removeTag: (cardId, listName, tagId) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     if ('powerTags' in card.details) {
                        const details = card.details as LegendsThemeDetails | LegendsFellowshipDetails;
                        const updatedDetails = { ...details };
                        const filterList = (list: Tag[]) => list.filter(tag => tag.id !== tagId);

                        if (listName === 'powerTags') {
                           updatedDetails.powerTags = filterList(details.powerTags);
                        } else if (listName === 'weaknessTags') {
                           updatedDetails.weaknessTags = filterList(details.weaknessTags);
                        }

                        return { ...card, details: updatedDetails };
                     }
                     return card;
                  }));
               },
               // --- Bland Tag Actions ---
               addBlandTag: (cardId, listName) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     if (hasBlandTagList(card.details, listName)) {
                        const details = card.details as IndexableCardDetails;
                        const newTag: BlandTag = { id: cuid(), name: '' };
                        const currentList = details[listName] || [];
                        const updatedList = [...currentList, newTag];
                        return { ...card, details: { ...details, [listName]: updatedList } };
                     }
                     return card;
                  }));
               },
               updateBlandTag: (cardId, listName, tagId, name) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     if (hasBlandTagList(card.details, listName)) {
                        const details = card.details as IndexableCardDetails;
                        const currentList = details[listName] || [];
                        const updatedList = currentList.map((tag: BlandTag) =>
                        tag.id === tagId ? { ...tag, name } : tag
                        );
                        return { ...card, details: { ...details, [listName]: updatedList } };
                     }
                     return card;
                  }));
               },
               removeBlandTag: (cardId, listName, tagId) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     if (hasBlandTagList(card.details, listName)) {
                        const details = card.details as IndexableCardDetails;
                        const currentList = details[listName] || [];
                        const updatedList = currentList.filter((tag: BlandTag) => tag.id !== tagId);
                        return { ...card, details: { ...details, [listName]: updatedList } };
                     }
                     return card;
                  }));
               },
               // --- Tracker Actions ---
               addStatus: (name) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     const newStatus: StatusTracker = { id: cuid(), name: name || '', game: state.character.game, trackerType: 'STATUS', tiers: Array(6).fill(false) };
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              statuses: [
                                 ...state.character.trackers.statuses,
                                 newStatus
                              ]
                           }
                        }
                     };
                  });
               },
               addStoryTag: (name) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     const newStoryTag: StoryTagTracker = { id: cuid(), name: name || '', game: state.character.game, trackerType: 'STORY_TAG', isScratched: false };
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyTags: [
                                 ...state.character.trackers.storyTags,
                                 newStoryTag
                              ]
                           }
                        }
                     };
                  });
               },
               addStoryTheme: (name) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     const newStoryTheme: StoryThemeTracker = {
                        id: cuid(),
                        name: name || '',
                        game: state.character.game,
                        trackerType: 'STORY_THEME',
                        mainTag: { id: cuid(), name: '', isActive: false, isScratched: false },
                        powerTags: [],
                        weaknessTags: [],
                     };
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyThemes: [...state.character.trackers.storyThemes, newStoryTheme]
                           }
                        }
                     };
                  });
               },
               addImportedTracker: (tracker, index) => {
                  set((state) => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');

                     const newTrackerCopy = deepReId(tracker);

                     if (!newTrackerCopy.game) {
                        newTrackerCopy.game = state.character.game;
                     }

                     const newTrackers = { ...state.character.trackers };
                     if (newTrackerCopy.trackerType === 'STATUS') {
                        const list = [...newTrackers.statuses];
                        const insertionIndex = index ?? list.length;
                        list.splice(insertionIndex, 0, newTrackerCopy as StatusTracker);
                        newTrackers.statuses = list;
                     } else if (newTrackerCopy.trackerType === 'STORY_TAG') {
                        const list = [...newTrackers.storyTags];
                        const insertionIndex = index ?? list.length;
                        list.splice(insertionIndex, 0, newTrackerCopy as StoryTagTracker);
                        newTrackers.storyTags = list;
                     } else if (newTrackerCopy.trackerType === 'STORY_THEME') {
                        const list = [...newTrackers.storyThemes];
                        const insertionIndex = index ?? list.length;
                        list.splice(insertionIndex, 0, newTrackerCopy as StoryThemeTracker);
                        newTrackers.storyThemes = list;
                     }
                     
                     return {
                        character: {
                           ...state.character,
                           trackers: newTrackers,
                        },
                     };
                  });
               },
               removeStatus: (trackerId) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              statuses: state.character.trackers.statuses.filter(tracker => tracker.id !== trackerId)
                           }
                        }
                     };
                  });
               },
               removeStoryTag: (trackerId) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyTags: state.character.trackers.storyTags.filter(tracker => tracker.id !== trackerId)
                           }
                        }
                     };
                  });
               },
               removeStoryTheme: (trackerId) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyThemes: state.character.trackers.storyThemes.filter(tracker => tracker.id !== trackerId)
                           }
                        }
                     };
                  });
               },
               updateStatus: (trackerId, updates) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              statuses: state.character.trackers.statuses.map(tracker => tracker.id === trackerId ? { ...tracker, ...updates } : tracker)
                           }
                        }
                     };
                  });
               },
               updateStoryTag: (trackerId, updates) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyTags: state.character.trackers.storyTags.map(tracker => tracker.id === trackerId ? { ...tracker, ...updates } : tracker)
                           }
                        }
                     };
                  });
               },
               updateStoryTheme: (trackerId, updates) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyThemes: state.character.trackers.storyThemes.map(tracker => tracker.id === trackerId ? { ...tracker, ...updates } : tracker)
                           }
                        }
                     };
                  });
               },
               reorderStatuses: (oldIndex, newIndex) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     const newItems = Array.from(state.character.trackers.statuses);
                     const [moved] = newItems.splice(oldIndex, 1);
                     newItems.splice(newIndex, 0, moved);
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              statuses: newItems
                           }
                        }
                     };
                  });
               },
               reorderStoryTags: (oldIndex, newIndex) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     const newItems = Array.from(state.character.trackers.storyTags);
                     const [moved] = newItems.splice(oldIndex, 1);
                     newItems.splice(newIndex, 0, moved);
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyTags: newItems
                           }
                        }
                     };
                  });
               },
               reorderStoryThemes: (oldIndex, newIndex) => {
                  set(state => {
                     if (!state.character) return {};
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     const newItems = Array.from(state.character.trackers.storyThemes);
                     const [moved] = newItems.splice(oldIndex, 1);
                     newItems.splice(newIndex, 0, moved);
                     return {
                        character: {
                           ...state.character,
                           trackers: { ...state.character.trackers, storyThemes: newItems }
                        }
                     };
                  });
               },
               upgradeStoryTagToTheme: (trackerId) => {
                  set(state => {
                     if (!state.character) return {};

                     const storyTagIndex = state.character.trackers.storyTags.findIndex(t => t.id === trackerId);
                     if (storyTagIndex === -1) return {};

                     const originalTag = state.character.trackers.storyTags[storyTagIndex];

                     const newStoryTheme: StoryThemeTracker = {
                        id: cuid(),
                        name: originalTag.name,
                        game: originalTag.game,
                        trackerType: 'STORY_THEME',
                        mainTag: {
                           id: cuid(),
                           name: originalTag.name,
                           isActive: false,
                           isScratched: false,
                        },
                        powerTags: [],
                        weaknessTags: [],
                     };

                     const newStoryTags = state.character.trackers.storyTags.filter(t => t.id !== trackerId);
                     const newStoryThemes = [...state.character.trackers.storyThemes, newStoryTheme];

                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyTags: newStoryTags,
                              storyThemes: newStoryThemes,
                           }
                        }
                     };
                  });
               },
               downgradeStoryThemeToTag: (trackerId) => {
                  set(state => {
                     if (!state.character) return {};
                     const storyThemeIndex = state.character.trackers.storyThemes.findIndex(t => t.id === trackerId);
                     if (storyThemeIndex === -1) return {};
                     const originalTheme = state.character.trackers.storyThemes[storyThemeIndex];
                     const newStoryTag: StoryTagTracker = {
                        id: cuid(),
                        name: originalTheme.mainTag.name,
                        game: originalTheme.game,
                        trackerType: 'STORY_TAG',
                        isScratched: originalTheme.mainTag.isScratched,
                     };
                     const newStoryThemes = state.character.trackers.storyThemes.filter(t => t.id !== trackerId);
                     const newStoryTags = [...state.character.trackers.storyTags, newStoryTag];
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyThemes: newStoryThemes,
                              storyTags: newStoryTags,
                           }
                        }
                     };
                  });
               },
               // --- Story Themes Tag Actions ---
               addTagToStoryTheme: (trackerId, listName) => {
                  set(state => {
                     if (!state.character) return {};
                     const newTag: Tag = { id: cuid(), name: '', isActive: false, isScratched: false };
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyThemes: state.character.trackers.storyThemes.map(t => {
                                 if (t.id === trackerId) {
                                    return { ...t, [listName]: [...t[listName], newTag] };
                                 }
                                 return t;
                              })
                           }
                        }
                     }
                  });
               },
               updateTagInStoryTheme: (trackerId, listName, tagId, updatedTag) => {
                  set(state => {
                     if (!state.character) return {};
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyThemes: state.character.trackers.storyThemes.map(t => {
                                 if (t.id === trackerId) {
                                    if (listName === 'mainTag') {
                                       return { ...t, mainTag: { ...t.mainTag, ...updatedTag }};
                                    }
                                    const updatedList = t[listName].map(tag => tag.id === tagId ? { ...tag, ...updatedTag } : tag);
                                    return { ...t, [listName]: updatedList };
                                 }
                                 return t;
                              })
                           }
                        }
                     }
                  });
               },
               removeTagFromStoryTheme: (trackerId, listName, tagId) => {
                  set(state => {
                     if (!state.character) return {};
                     return {
                        character: {
                           ...state.character,
                           trackers: {
                              ...state.character.trackers,
                              storyThemes: state.character.trackers.storyThemes.map(t => {
                                 if (t.id === trackerId) {
                                    const updatedList = t[listName].filter(tag => tag.id !== tagId);
                                    return { ...t, [listName]: updatedList };
                                 }
                                 return t;
                              })
                           }
                        }
                     }
                  });
               },
               // --- Legends in the Mist ### Fellowship Relationship Actions --- 
               addRelationship: (cardId) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     if (card.cardType !== 'CHARACTER_CARD' || card.details.game !== 'LEGENDS') return card;
                     const details = card.details as LegendsHeroDetails;
                     const newRelationship: FellowshipRelationship = {
                        id: cuid(),
                        companionName: '',
                        relationshipTag: '',
                     };
                     return {
                        ...card,
                        details: {
                           ...details,
                           fellowshipRelationships: [...details.fellowshipRelationships, newRelationship],
                        },
                     };
                  }));
               },
               updateRelationship: (cardId, relationshipId, updates) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     if (card.cardType !== 'CHARACTER_CARD' || card.details.game !== 'LEGENDS') return card;
                     const details = card.details as LegendsHeroDetails;
                     return {
                        ...card,
                        details: {
                           ...details,
                           fellowshipRelationships: details.fellowshipRelationships.map(rel => 
                              rel.id === relationshipId ? { ...rel, ...updates } : rel
                           ),
                        },
                     };
                  }));
               },
               removeRelationship: (cardId, relationshipId) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     if (card.cardType !== 'CHARACTER_CARD' || card.details.game !== 'LEGENDS') return card;
                     const details = card.details as LegendsHeroDetails;
                     return {
                        ...card,
                        details: {
                           ...details,
                           fellowshipRelationships: details.fellowshipRelationships.filter(rel => rel.id !== relationshipId),
                        },
                     };
                  }));
               },
               // --- City of Mist ### Crew Actions ---
               addCrewMember: (cardId) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     if (card.cardType !== 'CHARACTER_CARD' || card.details.game !== 'CITY_OF_MIST') return card;
                     const details = card.details as CityRiftDetails;
                     const newCrewMember: CrewMember = {
                        id: cuid(),
                        name: '',
                        help: '',
                        hurt: '',
                     };
                     return {
                        ...card,
                        details: {
                           ...details,
                           crewMembers: [...details.crewMembers, newCrewMember],
                        },
                     };
                  }));
               },
               updateCrewMember: (cardId, crewId, updates) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     if (card.cardType !== 'CHARACTER_CARD' || card.details.game !== 'CITY_OF_MIST') return card;
                     const details = card.details as CityRiftDetails;
                     return {
                        ...card,
                        details: {
                           ...details,
                           crewMembers: details.crewMembers.map(member => 
                              member.id === crewId ? { ...member, ...updates } : member
                           ),
                        },
                     };
                  }));
               },
               removeCrewMember: (cardId, crewId) => {
                  set(state => updateCardInState(state, cardId, card => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('character');
                     if (card.cardType !== 'CHARACTER_CARD' || card.details.game !== 'CITY_OF_MIST') return card;
                     const details = card.details as CityRiftDetails;
                     return {
                        ...card,
                        details: {
                           ...details,
                           crewMembers: details.crewMembers.filter(member => member.id !== crewId),
                        },
                     };
                  }));
               },
            },
         }),
         {
            name: 'characters-of-the-mist_character-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ character: state.character }),
            version: STORE_VERSION,
            migrate: (persistedState, version) => {
               const state = persistedState as Pick<CharacterState, 'character'>;

               if (state.character) {
                  console.log("Harmonizing character data via migrate function...");
                  state.character = harmonizeData(state.character, 'FULL_CHARACTER_SHEET');
                  console.log("Character data harmonization complete.");
               }

               return state;
            },
         }
      )
   )
);

export const useCharacterActions = () => useCharacterStore((state) => state.actions);