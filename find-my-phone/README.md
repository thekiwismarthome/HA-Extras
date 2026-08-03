Phone Setup — Companion App Notification Channel

For the max-volume/silent-override behaviour to work, the phone itself needs configuring. This is Android (the command_ringer_mode and alarm_stream_max features are Android-only; iOS handles this differently via Critical Alerts).

1. Notification permissions

Open Home Assistant Companion app → Settings → Companion app → Notification channels. After the automation fires at least once, a channel named find_my_phone will appear here.

2. Configure the channel

Tap find_my_phone and set:

Importance: Urgent (makes sound + pops on screen)
Sound: pick a loud, distinct tone
Override Do Not Disturb: enable if you want it to ring through DND
Vibration: On
3. Allow settings modification

For command_ringer_mode and command_volume_level to work, grant HA the permission:
Companion app → Settings → Companion app → Manage sensors isn't it — instead go to Android Settings → Apps → Home Assistant → Special app access → Modify system settings → Allow. Also grant Do Not Disturb access under the same Special access menu if you want to override silent mode.

4. Add the dashboard button to your phone

On the phone, open the dashboard, tap the button — or add a home-screen shortcut: long-press the HA app icon → the dashboard shortcut, or use the app's built-in widget (Add widget → Home Assistant → tap to pick the script.find_brents_phone action) so you can ring it straight from your home screen without opening the app.

5. Test it

Put the phone on silent, lock it, and tap the button (or say "find my phone"). It should switch off silent, ramp to full volume, vibrate, speak, and show a persistent notification with a "Found it" button.

Want me to save these to a Word doc or markdown file you can keep with your homelab notes?
