import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ReviewerV2 from './reviewer-v2/ReviewerV2'

const isV2 = window.location.pathname.startsWith('/v2')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isV2 ? <ReviewerV2 /> : <App />}
  </StrictMode>,
)
