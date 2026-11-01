// El juego en un WKWebView. Se sirve desde la propia app como app://localhost/index.html (sin internet), así
// el guardado (localStorage) es estable y Firebase ve siempre el mismo origen.
// El puente es el mismo que el de Android (window.ChromaAndroid) con lo que ya funciona en iPhone: vibración,
// aviso de la racha, compartir, abrir enlaces y versión. Lo demás (compras, anuncios, Google) aún no está: el juego
// lo detecta y lo explica.
import UIKit
import WebKit
import UserNotifications

final class GameViewController: UIViewController, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate {
    private var web: WKWebView!

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .bottom }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        UIDevice.current.userInterfaceIdiom == .pad ? [.portrait, .portraitUpsideDown] : .portrait
    }

    override func loadView() {
        let cfg = WKWebViewConfiguration()
        cfg.setURLSchemeHandler(AppSchemeHandler(), forURLScheme: "app")
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        let ucc = WKUserContentController()
        ucc.add(WeakHandler(self), name: "rr")
        ucc.addUserScript(WKUserScript(source: Self.bridgeJS(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        cfg.userContentController = ucc

        web = WKWebView(frame: .zero, configuration: cfg)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0x1D / 255.0, green: 0x14 / 255.0, blue: 0x40 / 255.0, alpha: 1)
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never     // los márgenes de la muesca los pone el CSS (env(safe-area-inset-*))
        web.allowsLinkPreview = false
        web.uiDelegate = self
        web.navigationDelegate = self
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        web.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(pause), name: UIApplication.willResignActiveNotification, object: nil)
        nc.addObserver(self, selector: #selector(resume), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    @objc private func pause() { js("window.ChromaPause && window.ChromaPause()") }
    @objc private func resume() { js("window.ChromaResume && window.ChromaResume()") }
    private func js(_ code: String) { web?.evaluateJavaScript(code, completionHandler: nil) }

    // si el sistema cierra el motor de la página (poca memoria), se vuelve a cargar
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    // enlaces externos (privacidad, Play/App Store, soporte): en Safari
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let u = action.request.url, let s = u.scheme, s == "http" || s == "https" || s == "mailto", action.targetFrame?.isMainFrame ?? true {
            if action.navigationType == .linkActivated || action.targetFrame == nil { UIApplication.shared.open(u); decisionHandler(.cancel); return }
        }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = action.request.url { UIApplication.shared.open(u) }
        return nil
    }

    // ---------------- puente con el juego ----------------
    static func bridgeJS() -> String {
        let info = Bundle.main.infoDictionary ?? [:]
        let ver = "\(info["CFBundleShortVersionString"] as? String ?? "1.0").\(info["CFBundleVersion"] as? String ?? "0")"
        return """
        (function () {
          var post = function (m, a) { try { window.webkit.messageHandlers.rr.postMessage({ m: m, a: a || [] }); } catch (e) {} };
          window.ChromaPlatform = 'ios';
          window.ChromaAndroid = {
            vibrate: function (ms) { post('vibrate', [+ms || 0]); },
            scheduleReminder: function (at, title, text) { post('remind', [String(at), String(title || ''), String(text || '')]); },
            cancelReminder: function () { post('unremind'); },
            scheduleNotice: function (name, at, title, text) { post('notice', [String(name), String(at), String(title || ''), String(text || '')]); },
            cancelNotice: function (name) { post('unnotice', [String(name)]); },
            share: function (t) { post('share', [String(t || '')]); },
            openUrl: function (u) { post('open', [String(u || '')]); },
            askNotifications: function () { post('askNotif'); },
            version: function () { return '\(ver)'; }
          };
        })();
        """
    }

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let m = body["m"] as? String else { return }
        let a = body["a"] as? [Any] ?? []
        switch m {
        case "vibrate":
            let ms = (a.first as? NSNumber)?.doubleValue ?? 15
            let style: UIImpactFeedbackGenerator.FeedbackStyle = ms < 20 ? .light : ms < 60 ? .medium : .heavy
            let g = UIImpactFeedbackGenerator(style: style); g.prepare(); g.impactOccurred()
        case "remind":
            guard a.count >= 3, let at = Double(a[0] as? String ?? ""), let title = a[1] as? String, let text = a[2] as? String else { return }
            Reminder.schedule(at: Date(timeIntervalSince1970: at / 1000), title: title, text: text)
        case "unremind":
            Reminder.cancel()
        case "notice":
            guard a.count >= 4, let name = a[0] as? String, let at = Double(a[1] as? String ?? ""), let title = a[2] as? String, let text = a[3] as? String else { return }
            Reminder.schedule(id: name, at: Date(timeIntervalSince1970: at / 1000), title: title, text: text)
        case "unnotice":
            if let name = a.first as? String { Reminder.cancel(id: name) }
        case "askNotif":
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        case "share":
            let text = a.first as? String ?? ""
            let vc = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            if let pop = vc.popoverPresentationController {           // iPad: sale como globo en el centro
                pop.sourceView = view; pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1); pop.permittedArrowDirections = []
            }
            present(vc, animated: true)
        case "open":
            if let s = a.first as? String, let u = URL(string: s) { UIApplication.shared.open(u) }
        default: break
        }
    }
}

// evita que el WKWebView y la pantalla se retengan entre sí
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ t: WKScriptMessageHandler) { target = t }
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(ucc, didReceive: message)
    }
}

// aviso local de la racha diaria (lo programa el juego, como en Android)
enum Reminder {
    static let id = "racha"
    static func schedule(at: Date, title: String, text: String) { schedule(id: id, at: at, title: title, text: text) }
    static func cancel() { cancel(id: id) }
    static func schedule(id: String, at: Date, title: String, text: String) {
        let c = UNMutableNotificationContent(); c.title = title; c.body = text; c.sound = .default
        let s = max(5, at.timeIntervalSinceNow)
        let req = UNNotificationRequest(identifier: id, content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: s, repeats: false))
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [id])
        center.add(req, withCompletionHandler: nil)
    }
    static func cancel(id: String) { UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id]) }
}

// sirve los archivos del juego (carpeta www de la app) en app://localhost/…
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root = Bundle.main.resourceURL!.appendingPathComponent("www")
    private static let types = ["html": "text/html", "js": "text/javascript", "css": "text/css", "json": "application/json", "png": "image/png",
                                "jpg": "image/jpeg", "svg": "image/svg+xml", "mp3": "audio/mpeg", "ogg": "audio/ogg", "wav": "audio/wav", "woff2": "font/woff2"]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path; if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(root.standardizedFileURL.path), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist)); return
        }
        let mime = Self.types[file.pathExtension.lowercased()] ?? "application/octet-stream"
        let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                   headerFields: ["Content-Type": mime + (mime.hasPrefix("text") ? "; charset=utf-8" : ""), "Content-Length": "\(data.count)", "Cache-Control": "no-cache"])!
        task.didReceive(resp); task.didReceive(data); task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
