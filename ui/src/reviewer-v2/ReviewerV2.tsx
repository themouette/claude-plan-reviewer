import 'highlight.js/styles/github-dark.css'
import { useHeartbeat } from './useHeartbeat'
import { useAnnotations } from './useAnnotations'
import ReviewerV2Shell from './ReviewerV2Shell'

export default function ReviewerV2() {
  // ARCH-02: v2 reviewer has its own independent heartbeat poller.
  // Return value intentionally unused in Phase 17 — Phase 22 will wire it to
  // the offline banner. The void expression satisfies ESLint no-unused-vars.
  void useHeartbeat()

  // Annotation store mounted here so it is available to child components
  // throughout the v2 subtree. Phase 21 will wire it into the UI.
  void useAnnotations()

  return <ReviewerV2Shell />
}
