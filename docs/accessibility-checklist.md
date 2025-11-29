# Accessibility Quick Check

- Keyboard navigation: Tab through landing CTAs, nav links, dashboards, the lesson player, and both chat widgets; ensure focus outlines remain visible and actions work without a mouse.
- Dialogs: Open the auth modal and chat/assistant windows, confirm initial focus lands inside, Tab stays within the dialog, and Escape or the close button dismisses them.
- Forms and toggles: Submit auth flows with the keyboard, toggle student/parent roles, and interact with lesson check-in answers using space/enter.
- Contrast: Spot-check hero text, dashboard stat labels, and lesson headers with the browser contrast inspector; prefer WCAG AA (4.5:1 for body text, 3:1 for large text).
- Color/focus regression watch: ensure the new focus rings do not get obscured by backgrounds; adjust `focus-ring` offsets or border colors if a new element hides them.
- Optional lint: `npm run lint` for basic JSX issues before release.
