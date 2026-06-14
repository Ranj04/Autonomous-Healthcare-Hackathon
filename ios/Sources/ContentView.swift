import SwiftUI

// Change this one line to point the wrapper at a different deployment.
let APP_URL = "https://autonomous-healthcare-hackathon.vercel.app/"

// Matches the web app's "paper" background so the safe-area strips (status bar /
// home indicator) blend with the page instead of flashing white.
private let paperColor = Color(red: 243 / 255, green: 236 / 255, blue: 224 / 255)
private let brandAccent = Color(red: 207 / 255, green: 69 / 255, blue: 32 / 255)

struct ContentView: View {
    @State private var isLoading = true
    @State private var didFail = false
    // Bumping this asks the WebView to reload (used by the Retry button).
    @State private var reloadToken = 0

    var body: some View {
        ZStack {
            // Background fills the whole screen (incl. notch/home-indicator
            // strips). The web view above stays within the safe area.
            paperColor.ignoresSafeArea()

            WebView(
                url: URL(string: APP_URL)!,
                isLoading: $isLoading,
                didFail: $didFail,
                reloadToken: reloadToken
            )

            if didFail {
                failureView
            } else if isLoading {
                ProgressView()
                    .progressViewStyle(.circular)
                    .scaleEffect(1.4)
                    .tint(brandAccent)
            }
        }
    }

    private var failureView: some View {
        ZStack {
            paperColor.ignoresSafeArea()
            VStack(spacing: 18) {
                Text("Couldn't connect — check your network")
                    .font(.system(.body, design: .monospaced))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                Button {
                    didFail = false
                    isLoading = true
                    reloadToken += 1
                } label: {
                    Text("Retry")
                        .font(.system(.subheadline, design: .monospaced).weight(.semibold))
                        .textCase(.uppercase)
                        .tracking(2)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 28)
                        .padding(.vertical, 14)
                        .background(brandAccent)
                }
            }
        }
    }
}
