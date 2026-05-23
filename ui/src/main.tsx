import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ReviewerV2 from './reviewer-v2/ReviewerV2'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReviewerV2 />
  </StrictMode>,
)
