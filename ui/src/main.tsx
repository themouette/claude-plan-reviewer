import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ReviewerV2 from './reviewer-v2/ReviewerV2'
import CodeReviewApp from './code-review/CodeReviewApp'

const isCodeReview = window.location.pathname.startsWith('/code-review')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCodeReview ? <CodeReviewApp /> : <ReviewerV2 />}
  </StrictMode>,
)
