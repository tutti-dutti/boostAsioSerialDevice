import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: ConnectionStore

    var body: some View {
        NavigationStack {
            Form {
                Section("Display") {
                    Picker("Incoming Format", selection: $store.settings.displayMode) {
                        ForEach(AppSettings.DisplayMode.allCases) { mode in
                            Text(mode.label).tag(mode)
                        }
                    }

                    Picker("Line Ending", selection: $store.settings.lineEnding) {
                        ForEach(AppSettings.LineEnding.allCases) { ending in
                            Text(ending.label).tag(ending)
                        }
                    }
                }

                Section("TCP / Network") {
                    TextField("Host", text: $store.settings.tcpHost)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)

                    Stepper(value: $store.settings.tcpPort, in: 1...65535) {
                        Text("Port: \(store.settings.tcpPort)")
                    }
                }

                Section("Behavior") {
                    Toggle("Auto Reconnect", isOn: $store.settings.autoReconnect)
                }

                Section {
                    Link(destination: URL(string: "https://github.com/tutti-dutti/boostAsioSerialDevice")!) {
                        Label("Project on GitHub", systemImage: "link")
                    }
                } footer: {
                    Text("Serial Device connects to BLE UART adapters and network serial bridges from your iPhone.")
                }
            }
            .navigationTitle("Settings")
            .onChange(of: store.settings) { _, _ in
                store.saveSettings()
            }
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(ConnectionStore())
}
