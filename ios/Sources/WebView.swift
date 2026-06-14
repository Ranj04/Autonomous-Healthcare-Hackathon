import SwiftUI
import WebKit

/// Thin SwiftUI wrapper around WKWebView. This app renders NO native UI of its
/// own — it only loads the already-deployed web app over the network. No API
/// keys live here; all xAI calls stay server-side in the web app.
struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    @Binding var didFail: Bool
    let reloadToken: Int

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Let the agent's audio play without a tap, and inline (not fullscreen).
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        // The SwiftUI view is already inset to the safe area, so don't let the
        // scroll view add its own inset on top.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        // Avoid a white flash before the page paints; match the web background.
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear

        context.coordinator.webView = webView
        context.coordinator.lastReloadToken = reloadToken
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.parent = self
        // Retry tapped → token changed → reload.
        if context.coordinator.lastReloadToken != reloadToken {
            context.coordinator.lastReloadToken = reloadToken
            webView.load(URLRequest(url: url))
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: WebView
        weak var webView: WKWebView?
        var lastReloadToken = 0

        init(_ parent: WebView) { self.parent = parent }

        // MARK: Navigation state → loading / failure flags

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            setState(loading: true, failed: false)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            setState(loading: false, failed: false)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            handle(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            handle(error)
        }

        private func handle(_ error: Error) {
            // Code -999 is "cancelled" (e.g. a superseded navigation); not a real failure.
            if (error as NSError).code == NSURLErrorCancelled { return }
            setState(loading: false, failed: true)
        }

        private func setState(loading: Bool, failed: Bool) {
            DispatchQueue.main.async {
                self.parent.isLoading = loading
                self.parent.didFail = failed
            }
        }

        // MARK: Microphone / camera capture permission (iOS 15+)
        // Grant so the page's getUserMedia (voice agent mic) succeeds. The native
        // OS prompt is still governed by the Info.plist usage strings.
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            decisionHandler(.grant)
        }

        // <input type="file"> is handled by WebKit's built-in document/photo
        // picker — no extra delegate needed; the Info.plist camera/photo usage
        // strings cover it.
    }
}
