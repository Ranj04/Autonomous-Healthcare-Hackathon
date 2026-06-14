# Paperwork Advocate — iOS wrapper

A **thin** native iOS app (SwiftUI + WebKit, iOS 16+) that loads the already‑deployed
web app full‑screen in a `WKWebView`. It does **not** reimplement any UI natively and
holds **no API keys** — every xAI call stays server‑side in the web app. It only loads:

```
https://autonomous-healthcare-hackathon.vercel.app/
```

To point it elsewhere, change the single constant at the top of
[`Sources/ContentView.swift`](Sources/ContentView.swift):

```swift
let APP_URL = "https://autonomous-healthcare-hackathon.vercel.app/"
```

This folder is **fully standalone** — it does not import from or affect the Next.js
web app in the repo root. Vercel never builds it (Vercel only runs `next build`).

## What's inside

| File | Purpose |
|------|---------|
| `project.yml` | XcodeGen spec (target, Info.plist keys, deployment target 16.0). |
| `Sources/PaperworkAdvocateApp.swift` | SwiftUI `@main` entry. |
| `Sources/ContentView.swift` | Root view: `APP_URL`, loading spinner, "Couldn't connect" + Retry. |
| `Sources/WebView.swift` | `UIViewRepresentable` around `WKWebView` (audio autoplay, mic grant, failure handling). |
| `Resources/Assets.xcassets` | Placeholder app icon (solid blue 1024) + launch background color. |

## How it was created (path taken: XcodeGen)

XcodeGen (prebuilt binary, no Homebrew needed) generated the `.xcodeproj` from
`project.yml`. The project **is committed** so you can open it in Xcode directly.

### Run it from the command line

```bash
cd ios

# (Re)generate the Xcode project from project.yml — only needed if you edit project.yml.
# If you don't have xcodegen: brew install xcodegen  (or grab the release binary).
xcodegen generate

# Build to a simulator
xcodebuild -project PaperworkAdvocate.xcodeproj -scheme PaperworkAdvocate \
  -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build

# Boot + install + launch
xcrun simctl boot "iPhone 17"
open -a Simulator
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/PaperworkAdvocate.app
xcrun simctl launch booted com.paperworkadvocate.app
```

### Or just open it in Xcode

Open `ios/PaperworkAdvocate.xcodeproj`, pick a simulator (or your device), press ⌘R.

## Running on a physical device (required to test VOICE)

The iOS Simulator has **no microphone**, so the voice agent's `getUserMedia` cannot be
exercised there — you must use a real iPhone:

1. Open `ios/PaperworkAdvocate.xcodeproj` in Xcode.
2. Select the **PaperworkAdvocate** target → **Signing & Capabilities** → set your
   **Team** (a free personal Apple ID works). Xcode auto‑manages the signing cert.
3. Plug in your iPhone, select it as the run destination, press ⌘R.
4. First launch: trust the developer profile under **Settings → General → VPN & Device
   Management** on the phone.
5. In the app, go to **Talk**, tap **Connect voice agent**, then **Hold to talk**. iOS
   shows the **microphone permission prompt** (text from `NSMicrophoneUsageDescription`).
   Tap **Allow** → the page's mic request is granted (the app's `WKUIDelegate` returns
   `.grant`) and the agent's audio plays back inline.

## Notes

- No third‑party Swift packages. Pure SwiftUI + WebKit.
- `ios/build/` and other Xcode output are git‑ignored.
- App icon / launch screen are intentionally a solid‑blue placeholder.
