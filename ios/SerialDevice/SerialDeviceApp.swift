import SwiftUI

@main
struct SerialDeviceApp: App {
    @StateObject private var connectionStore = ConnectionStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(connectionStore)
        }
    }
}
