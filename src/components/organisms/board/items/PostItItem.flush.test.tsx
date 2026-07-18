// @vitest-environment jsdom

// -- Library Imports --
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

// -- Utils Imports --
import { defaultTextStyle } from '@/lib/board/textStyle';

// -- Component Imports --
import { PostItItem } from './PostItItem';
import { BoardTextItem } from './BoardTextItem';

// -- Type Imports --
import type { BoardItem, PostItBoardContent, TextBoardContent } from '@/lib/types/board';

/*
 * Locks the flush-on-unmount invariant for the board's editable text items: a buffered edit MUST commit
 * even when the surface unmounts without a blur (a tab switch fires none) and even while the item is in its
 * editing sub-state - the commit is never gated behind the editing flag. Two disjoint flush paths carry it:
 * `useCommitOnUnmount` (the tab-switch unmount) and the `wasEditing` falling edge (the editing->false swap
 * in place). The commit is dirty-guarded, so a clean exit no-ops.
 */

// The mention-mint hook reaches into board context; a no-op is all these items need to render in isolation.
vi.mock('@/hooks/board/useBoardMentionMint', () => ({ useBoardMentionMint: () => () => {} }));
// Echo the i18n key instead of standing up a provider - these items only read placeholder/label strings.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

afterEach(cleanup);

const boardItem = (): BoardItem => ({ id: 'item-1', kind: 'post-it', x: 0, y: 0, width: 200, height: 200, z: 0, content: postItContent('') });

const postItContent = (text: string): PostItBoardContent => ({ kind: 'post-it', mode: 'copy', data: { id: 'note-1', text } });

const textContent = (text: string): TextBoardContent => ({ kind: 'text', text, style: defaultTextStyle() });

describe('PostItItem flush-on-unmount invariant', () => {
   it('commits the buffered edit when the surface unmounts mid-edit without a blur (tab switch)', () => {
      const onContentChange = vi.fn();
      const { getByRole, unmount } = render(
         <PostItItem item={boardItem()} content={postItContent('before')} isSelected isEditing toolbarSlot={null} onContentChange={onContentChange} onRequestSelect={() => {}} />,
      );

      fireEvent.change(getByRole('textbox'), { target: { value: 'after' } });
      unmount();

      expect(onContentChange).toHaveBeenCalledTimes(1);
      expect(onContentChange.mock.calls[0][0].data.text).toBe('after');
   });

   it('commits the buffered edit on the editing->false swap-in-place (no unmount, no blur)', () => {
      const onContentChange = vi.fn();
      const item = boardItem();
      const content = postItContent('before');
      const { getByRole, rerender } = render(
         <PostItItem item={item} content={content} isSelected isEditing toolbarSlot={null} onContentChange={onContentChange} onRequestSelect={() => {}} />,
      );

      fireEvent.change(getByRole('textbox'), { target: { value: 'after' } });
      rerender(
         <PostItItem item={item} content={content} isSelected isEditing={false} toolbarSlot={null} onContentChange={onContentChange} onRequestSelect={() => {}} />,
      );

      expect(onContentChange).toHaveBeenCalledTimes(1);
      expect(onContentChange.mock.calls[0][0].data.text).toBe('after');
   });

   it('does not commit an unchanged buffer on unmount (dirty-guarded)', () => {
      const onContentChange = vi.fn();
      const { unmount } = render(
         <PostItItem item={boardItem()} content={postItContent('before')} isSelected isEditing toolbarSlot={null} onContentChange={onContentChange} onRequestSelect={() => {}} />,
      );

      unmount();

      expect(onContentChange).not.toHaveBeenCalled();
   });
});

describe('BoardTextItem flush-on-unmount invariant', () => {
   it('commits the buffered edit when the surface unmounts mid-edit without a blur (tab switch)', () => {
      const onContentChange = vi.fn();
      const { getByRole, unmount } = render(
         <BoardTextItem item={boardItem()} content={textContent('before')} isSelected isEditing toolbarSlot={null} onContentChange={onContentChange} />,
      );

      fireEvent.change(getByRole('textbox'), { target: { value: 'after' } });
      unmount();

      expect(onContentChange).toHaveBeenCalledTimes(1);
      expect(onContentChange.mock.calls[0][0].text).toBe('after');
   });
});
