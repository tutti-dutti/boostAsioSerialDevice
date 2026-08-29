import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            ConnectionView()
                .tabItem {
                    Label("Connect", systemImage: "antenna.radiowaves.left.and.right")
                }

            TerminalView()
                .tabItem {
                    Label("Terminal", systemImage: "terminal")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(ConnectionStore())
}
