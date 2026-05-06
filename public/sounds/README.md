# Notification sounds

Drop `notification.mp3` here (~1-2 second chime, < 50KB).

The `useNotifications` hook lazily loads `/sounds/notification.mp3`
and plays it at 50% volume on every fresh INSERT into the
`notifications` table (Phase 10.72).

If the file is missing the hook silently no-ops — no console errors,
no broken UI.

## Recommended sources

- https://freesound.org (CC0 / Attribution licenses)
- https://mixkit.co/free-sound-effects/notification/
- iOS/Android system chimes (royalty-free)

Place the final file at exactly:
`public/sounds/notification.mp3`
