# Manlung Recovery — APK update signing setup

## Why this is required

The APK workflow generates a Capacitor Android wrapper on a clean GitHub Actions runner. A new Android package must be signed with the same permanent signing key as the previous package to install over it. A temporary debug keystore is not a safe update channel because its signing identity can change between fresh runners.

Website and PWA content updates do not require an APK reinstall. The Android wrapper opens the live website. A new APK is only needed for native wrapper/plugin changes or Android package updates.

## One-time setup

1. Create a permanent signing keystore on a trusted computer and keep an encrypted offline backup. Never commit the keystore or passwords to Git.
2. On a computer with Java's `keytool`, run:

   ```bash
   keytool -genkeypair -v -keystore manlung-release-key.jks -alias manlung-release -keyalg RSA -keysize 4096 -validity 10000
   ```

   Choose a strong keystore password and key password. Do not lose this file or these passwords; future APK updates must use the same key.

3. Base64-encode the keystore file into one line:
   - Linux: `base64 -w 0 manlung-release-key.jks`
   - macOS: `base64 manlung-release-key.jks | tr -d '\\n'`
   - PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("manlung-release-key.jks"))`

4. In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**, and add:
   - `ANDROID_KEYSTORE_BASE64`: the one-line base64 value
   - `ANDROID_KEYSTORE_PASSWORD`: the keystore password
   - `ANDROID_KEY_ALIAS`: `manlung-release` (or the alias you chose)
   - `ANDROID_KEY_PASSWORD`: the key password

5. Run the **Build Manlung Recovery Android APK** workflow manually once and confirm it publishes the release notes containing `Version-Code` and `Signing-Key: stable`.

## Important for existing APK users

The existing release workflow used a debug APK. If earlier APK copies were signed with temporary keys, Android may refuse to install the first permanent-key release over those copies. That first transition is explicitly flagged in the app update prompt. Affected users may need to uninstall the old APK and then install the new signed APK. Account records are server-side, but local preferences can reset on uninstall. After the permanent key is in use, future signed APK updates can install over the existing app normally (with Android's approval).

Until these secrets are configured, the workflow deliberately does **not** replace the published APK with another temporary-key build. Website/PWA deployments can still proceed independently.


## Android social sign-in return URL

The Android app opens Google, GitHub, and Discord sign-in in the system browser. The provider returns first to the website callback, which then opens the installed app using the Android deep link.

In the Supabase project used by Manlung Recovery, open **Authentication → URL Configuration → Redirect URLs** and allow:

```
https://manlungrecovery.manlungshop.co.ke/oauth-callback.html?native=1
```

Keep the existing website callback URL too. The Android app handles this deep link internally:

```
co.manlungrecovery.app://auth/callback
```

The Android build workflow registers that URI in the generated manifest. The custom URI is the app handoff after the HTTPS callback; the Supabase OAuth redirect target is the HTTPS URL above. Also confirm Google, GitHub, and Discord are enabled under **Authentication → Providers** and that each provider's OAuth app is configured with the Supabase callback URL shown in its provider settings.
