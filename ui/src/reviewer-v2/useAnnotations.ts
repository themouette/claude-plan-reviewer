import { useReducer } from 'react'
import type { Annotation, AnnotationAction } from './types'

export interface AnnotationState {
  annotations: Annotation[]
}

export const initialAnnotationState: AnnotationState = {
  annotations: [],
}

export function annotationReducer(
  state: AnnotationState,
  action: AnnotationAction,
): AnnotationState {
  switch (action.type) {
    case 'add':
      return { ...state, annotations: [...state.annotations, action.annotation] }
    case 'edit':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.id ? { ...a, comment: action.comment } : a,
        ),
      }
    case 'remove':
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.id),
      }
  }
}

export function useAnnotations() {
  const [state, dispatch] = useReducer(annotationReducer, initialAnnotationState)

  return {
    annotations: state.annotations,
    addAnnotation: (annotation: Annotation) =>
      dispatch({ type: 'add', annotation }),
    editAnnotation: (id: string, comment: string) =>
      dispatch({ type: 'edit', id, comment }),
    removeAnnotation: (id: string) =>
      dispatch({ type: 'remove', id }),
  }
}
