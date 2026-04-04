# ISPD7 System Hub

A customizable front-end hub for system profiles, headmates, chat, journaling, history, innerworld tracking, and account management.

## Front-end quick start

Open `index.html` in a browser, or use a local static server.

## Publish the front end with GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `style.css`, `app.js`, and `config.js`.
3. Commit and push to `main`.
4. In **Settings -> Pages**, choose:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main`
   - **Folder:** `/root`
5. Save and wait for the Pages URL.

## Backend setup

A starter API is included in `backend/`.

```bash
cd backend
npm install
copy .env.example .env
npm start
```

Then update `config.js`:

```js
window.APP_CONFIG = {
  apiBaseUrl: 'http://localhost:3000',
  useBackendAuth: true
};
```

## Deploy backend

You can deploy the backend to:
- Render
- Railway
- Fly.io
- Azure App Service

Once it is deployed, replace `apiBaseUrl` in `config.js` with the live backend URL.
