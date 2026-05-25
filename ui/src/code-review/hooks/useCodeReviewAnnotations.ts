import { useReducer } from 'react'
import type { CodeReviewComment } from '../types'

export type CommentAction =
  | { type: 'ADD_COMMENT'; comment: CodeReviewComment }
  | { type: 'EDIT_COMMENT'; id: string; text: string }
  | { type: 'DELETE_COMMENT'; id: string }

export function reduceAnnotations(
  state: CodeReviewComment[],
  action: CommentAction,
): CodeReviewComment[] {
  switch (action.type) {
    case 'ADD_COMMENT':
      return [...state, action.comment]
    case 'EDIT_COMMENT':
      return state.map((c) =>
        c.id === action.id ? { ...c, text: action.text } : c,
      )
    case 'DELETE_COMMENT':
      return state.filter((c) => c.id !== action.id)
  }
}

export function useCodeReviewAnnotations(): {
  comments: CodeReviewComment[]
  addComment: (comment: CodeReviewComment) => void
  editComment: (id: string, text: string) => void
  deleteComment: (id: string) => void
} {
  const [comments, dispatch] = useReducer(reduceAnnotations, [])

  return {
    comments,
    addComment: (comment: CodeReviewComment) =>
      dispatch({ type: 'ADD_COMMENT', comment }),
    editComment: (id: string, text: string) =>
      dispatch({ type: 'EDIT_COMMENT', id, text }),
    deleteComment: (id: string) =>
      dispatch({ type: 'DELETE_COMMENT', id }),
  }
}
