import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';

import { deriveCardTitle } from './character';
import type { Card, LegendsChallengeDetails } from '@/lib/types/character';

/*
 * The Challenge Card model + its `deriveCardTitle` branch. Building a full `LegendsChallengeDetails`
 * here also guards its shape (a compile break surfaces as a test-build failure).
 */

const t = ((key: string) => key) as unknown as TFunction;

const challengeDetails = (): LegendsChallengeDetails => ({
   game: 'LEGENDS',
   assetId: null,
   types: ['Aggressor', 'Pursuer'],
   challengeLevel: 3,
   flavor: 'A snarling pack circles the camp.',
   limits: [{ id: 'l1', name: 'Burn', tier: 4 }],
   statuses: [{ id: 's1', name: 'bloodied', tier: 2 }],
   tags: [{ id: 'tg1', name: 'fast' }],
   abilities: [{ id: 'a1', tag: 'Lunge', flavor: 'It leaps for the throat.', consequences: [{ id: 'c1', text: 'You are knocked prone.' }] }],
});

const challengeCard = (title: string): Card => ({
   id: 'c1',
   title,
   isFlipped: false,
   cardType: 'CHALLENGE_CARD',
   details: challengeDetails(),
});

describe('deriveCardTitle - Challenge Card', () => {
   it('returns the challenge name from Card.title', () => {
      expect(deriveCardTitle(challengeCard('Pack of Hyenas'), t)).toBe('Pack of Hyenas');
   });

   it('falls back to the untitled label when the title is empty', () => {
      expect(deriveCardTitle(challengeCard(''), t)).toBe('Cards.challenge.untitled');
   });
});
