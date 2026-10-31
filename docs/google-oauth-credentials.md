# Google OAuth client ID and client secret

This guide shows how to find or create the OAuth **Client ID** and **Client secret** in Google Cloud Console.

## Do you need them?

| You want to… | Need a client ID and secret? |
| --- | --- |
| Sign in to Grow with Google through Firebase | **No.** Firebase creates and manages the OAuth client for you. Follow [`firebase-setup.md`](firebase-setup.md). |
| Call a Google API directly (Calendar, Drive, Sheets) | **Yes.** Create a client as below. |
| Run your own backend that signs users in with Google, such as the AI proxy | **Yes.** The secret stays on the server. |

The Firebase project already has a Google Cloud project behind it, so you can use the same one.

> **Keep the client secret private.** Anything with a `VITE_` prefix is bundled into the browser build and is visible to everyone. Put the secret only in server-side configuration, a secrets manager, or a local `.env` file with no `VITE_` prefix. Never commit it to GitHub.

---

## 1. Open the right Google Cloud project

1. Go to <https://console.cloud.google.com>.
2. Click the project picker at the top and select the project that Firebase created (same name as the Firebase project, such as `grow-learning-12345`).
   - To use a new project, click **New project**, name it, and click **Create**.

## 2. Turn on the required APIs (only if you call a Google API)

For Firebase sign-in this step is not needed.

1. Open **APIs & Services → Library**.
2. Search for the API you need, for example **Google Calendar API**.
3. Click it, then click **Enable**.

## 3. Configure the consent screen

Google calls this screen the **OAuth consent screen**. In newer versions of the console it is under **Google Auth Platform**, with the tabs **Branding**, **Audience** and **Data access**.

1. Open **APIs & Services → OAuth consent screen** (or **Google Auth Platform**).
2. If asked, click **Get started**.
3. **App information:** enter an app name (`Grow`), a user support email, and a developer contact email. Save.
4. **Audience:** choose **External**. While the app is in **Testing**, add your own Google account under **Test users**. Only test users can sign in until you publish the app.
5. **Scopes:** add only the scopes you need. Grow's sign-in needs only the basic profile and email scopes.
6. Review the summary and save.

## 4. Create the OAuth client ID

1. Open **APIs & Services → Credentials** (or **Google Auth Platform → Clients**).
2. Click **+ Create credentials → OAuth client ID** (or **+ Create client**).
3. **Application type:** choose **Web application**.
4. **Name:** for example `Grow web`.
5. **Authorized JavaScript origins:** add each origin the app runs on, with no trailing slash:
   - `http://localhost:5173` (local development)
   - `https://your-live-domain.example` (after you deploy)
6. **Authorized redirect URIs:** add each callback URL:
   - For Firebase sign-in: `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`
   - For your own backend: its callback, for example `http://localhost:3000/auth/callback`
7. Click **Create**.

## 5. Copy the Client ID and Client secret

A dialog shows:

- **Client ID**, which ends in `.apps.googleusercontent.com`
- **Client secret**, a string such as `GOCSPX-...`

Copy both now. Click **Download JSON** to save a backup. Store the JSON somewhere safe, outside the project folder.

If you close the dialog without copying the secret:

1. Open the client from the **Credentials** list.
2. Under **Client secrets**, add a new secret and copy it straight away.
3. Delete the old secret once the new one works.

## 6. Use them in the project

For a backend or script, put them in a local `.env` file, without the `VITE_` prefix so they stay on the server:

```
GOOGLE_CLIENT_ID=123456789012-abc...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

Do not add these lines to `.env.example` with real values. Keep the example file blank.

## Notes

- **Do not delete** the client named *Web client (auto created by Google Service)*. Firebase uses it for sign-in.
- Changes to origins or redirect URIs can take a few minutes to apply.
- Error `redirect_uri_mismatch` means the URI in your request does not exactly match one in **Authorized redirect URIs**. Check for a trailing slash, `http` vs `https`, and the port.
- Error `access_blocked` or `unverified app` means the app is still in Testing, or your account is not a test user.

## Quick reference

- Google Cloud Console: <https://console.cloud.google.com>
- Credentials page: **APIs & Services → Credentials**
- Consent screen: **APIs & Services → OAuth consent screen** (or **Google Auth Platform**)
