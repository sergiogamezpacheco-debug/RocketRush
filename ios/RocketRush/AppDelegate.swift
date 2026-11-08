// Rocket Rush para iPhone y iPad: una sola pantalla con el juego (el mismo index.html que la app de Android).
import UIKit
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        let w = UIWindow(frame: UIScreen.main.bounds)
        w.backgroundColor = UIColor.black
        w.rootViewController = GameViewController()
        w.makeKeyAndVisible()
        window = w
        return true
    }

    // con el juego abierto, el aviso de la racha no hace falta
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([])
    }
}
