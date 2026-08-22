# Shizuku WebADB

GitHub Pages-ready browser ADB interface based on Tango / ya-webadb.

## Deploy on GitHub Pages

1. Create a repository, for example `shizuku-webadb`.
2. Upload all files in this repository to the `main` branch.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, select **GitHub Actions**.
5. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually).
6. GitHub will publish the site at:
   `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

No PHP/server is required.

## Use

Open the published site in a Chromium browser such as Chrome or Edge.

- Enable USB debugging on Android.
- Connect the phone by USB.
- Click **Pick Android device**.
- Accept Android's USB debugging authorization prompt.
- Click **Shizuku**.

The button runs the browser-side equivalent of:

```text
adb shell sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh
```

The actual browser ADB call sends:

```text
sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh
```

through the already-established ADB connection.

## Browser requirements

WebUSB needs a supported Chromium-based browser and a secure context. GitHub Pages provides HTTPS.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production site is generated in `dist/`.
