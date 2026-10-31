# Firebase setup

This guide connects Grow to Firebase for Google sign-in and cloud storage (Firestore). Skip it if you only use Guest mode.

You will:

1. Create a Firebase project.
2. Register a web app and copy its config.
3. Enable Google sign-in.
4. Create a Firestore database and publish the security rules.
5. Add the config to `.env` and test.

Time needed: about 15 minutes.

---

## 1. Create a Firebase project

1. Open <https://console.firebase.google.com> and sign in with your Google account.
2. Click **Create a project** (or **Add project**).
3. Enter a project name, for example `grow-learning`. Firebase creates a **Project ID** from it, such as `grow-learning-12345`. Note this ID.
4. Google Analytics is optional. You can turn it off.
5. Click **Create project**, wait for it to finish, then click **Continue**.

## 2. Register a web app and copy its config

1. On the project overview, click the **Web** icon (`</>`). If you don't see it, open **Project settings** (the gear icon) and scroll to **Your apps**.
2. Enter an app nickname, such as `grow-web`. Leave **Firebase Hosting** unchecked.
3. Click **Register app**.
4. Firebase shows a `firebaseConfig` object like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "grow-learning-12345.firebaseapp.com",
     projectId: "grow-learning-12345",
     storageBucket: "grow-learning-12345.firebasestorage.app",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef123456"
   };
   ```

5. Keep this page open. You will copy these values in step 5. You can also return later from **Project settings → General → Your apps**.

## 3. Enable Google sign-in

1. In the left menu, open **Build → Authentication**.
2. Click **Get started** (first time only).
3. Open the **Sign-in method** tab.
4. Click **Google**, switch **Enable** on, and choose a **Project support email** (your Gmail address).
5. Click **Save**.

Check the **Authorized domains** list (under **Settings** in Authentication). `localhost` is there by default. When you deploy Grow, add your domain here, or sign-in will fail with `auth/unauthorized-domain`.

Firebase creates the Google OAuth client for you. You do not need to enter a client ID or secret for this. See [`google-oauth-credentials.md`](google-oauth-credentials.md) if you need them for other purposes.

## 4. Create the Firestore database

1. In the left menu, open **Build → Firestore Database**.
2. Click **Create database**.
3. Choose a location close to you (it cannot be changed later). A region such as `asia-south1` or `europe-west1` is fine.
4. Select **Start in production mode**. Grow ships its own rules, which you publish in the next step.
5. Click **Create**.

Grow creates its collections automatically on first write. You do not need to create them by hand:

```
users/{uid}/entries/{entryId}           learnings, books, mentor sessions, workshops
users/{uid}/knowledgeBuckets/{bucketId} your learning buckets (the name is kept from before the rename)
```

## 5. Publish the security rules

The rules in [`firestore.rules`](../firestore.rules) allow each signed-in user to read and write only their own `users/{uid}/...` data.

**Option A: Firebase console (simplest)**

1. In **Firestore Database**, open the **Rules** tab.
2. Replace the contents with the text of `firestore.rules` from this project.
3. Click **Publish**.

**Option B: Firebase CLI**

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # choose your project
firebase deploy --only firestore:rules
```

Run these from the project folder. If you use the CLI, Firebase may ask to create `firebase.json` and `.firebaserc`. These are not needed to run the app.

## 6. Add the config to `.env`

1. In the project folder, copy the example file:

   ```bash
   cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
   ```

2. Open `.env` and fill in the `VITE_FIREBASE_*` values from step 2:

   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=grow-learning-12345.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=grow-learning-12345
   VITE_FIREBASE_STORAGE_BUCKET=grow-learning-12345.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
   VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
   ```

3. Leave the `VITE_AI_*` lines as they are unless you want a real AI provider.

`.env` is listed in `.gitignore`, so it is never committed. Only `.env.example` (with blank values) goes to GitHub.

The Firebase web config is not a secret. It identifies your project. Your data is protected by the security rules in step 5, not by hiding these values.

## 7. Run and test

1. Restart the dev server so it picks up `.env`:

   ```bash
   npm run dev
   ```

2. Open <http://localhost:5173>, go to **Settings**, and click **Continue with Google**.
3. Pick your Google account and allow access.
4. Add a learning. Then open **Firestore Database → Data** in the Firebase console. You should see `users → <your uid> → entries`.

If you already have Guest entries, Settings offers to import them into your account.

## 8. Deploying (optional)

Hosting providers such as Vercel or Netlify need the same `VITE_FIREBASE_*` values set as environment variables before the build. Then:

1. Add your live domain under **Authentication → Settings → Authorized domains**.
2. Add the same domain under **Google Cloud Console → APIs & Services → Credentials** if you created an OAuth client yourself (see the Google guide).

---

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| The Google button is greyed out, or you see “Firebase is not configured” | `.env` is missing or incomplete, or you did not restart `npm run dev`. The first four keys (`API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`) are required. |
| `auth/operation-not-allowed` | Google sign-in is not enabled. See step 3. |
| `auth/unauthorized-domain` | The domain you are using is not in **Authorized domains**. Add it. |
| `auth/popup-blocked` or the popup closes at once | Allow pop-ups for the site, then try again. |
| `Missing or insufficient permissions` | The rules are not published, or you are signed in with a different account. Publish `firestore.rules` again (step 5). |
| `The query requires an index` | Not expected for Grow, which does not use compound queries. If it appears, follow the link in the error to create the index. |
| Data does not sync between devices | Confirm you are signed in on both devices with the same Google account. |

## Quick reference

- Console: <https://console.firebase.google.com>
- Rules file: [`firestore.rules`](../firestore.rules)
- Env template: [`.env.example`](../.env.example)
