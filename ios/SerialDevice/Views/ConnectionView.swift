import SwiftUI

struct ConnectionView: View {
    @EnvironmentObject private var store: ConnectionStore

    var body: some View {
        NavigationStack {
            List {
                Section("Connection Type") {
                    Picker("Type", selection: Binding(
                        get: { store.connectionType },
                        set: { store.setConnectionType($0) }
                    )) {
                        ForEach(ConnectionType.allCases) { type in
                            Label(type.displayName, systemImage: type.systemImage)
                                .tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                }

                Section("Status") {
                    HStack {
                        StatusIndicator(state: store.state)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(store.state.label)
                                .font(.headline)
                            if let name = store.activeServiceName, store.state.isConnected {
                                Text(name)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    if store.state.isConnected {
                        Button("Disconnect", role: .destructive) {
                            store.disconnect()
                        }
                    }
                }

                switch store.connectionType {
                case .bluetooth:
                    bluetoothSection
                case .tcp:
                    tcpSection
                }
            }
            .navigationTitle("Serial Device")
        }
    }

    @ViewBuilder
    private var bluetoothSection: some View {
        Section {
            if store.isScanning {
                Button("Stop Scanning") {
                    store.stopBluetoothScan()
                }
            } else {
                Button("Scan for Devices") {
                    store.startBluetoothScan()
                }
                .disabled(store.state.isConnected)
            }
        } header: {
            Text("Bluetooth LE")
        } footer: {
            Text("Supports Nordic UART and similar BLE serial adapters.")
        }

        if !store.discoveredBluetoothDevices.isEmpty {
            Section("Nearby Devices") {
                ForEach(store.discoveredBluetoothDevices) { device in
                    Button {
                        store.connectBluetooth(device: device)
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(device.name)
                                    .foregroundStyle(.primary)
                                Text("RSSI: \(device.rssi) dBm")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if store.state == .connecting {
                                ProgressView()
                            }
                        }
                    }
                    .disabled(store.state.isConnected || store.state == .connecting)
                }
            }
        }
    }

    @ViewBuilder
    private var tcpSection: some View {
        Section {
            LabeledContent("Host") {
                Text(store.settings.tcpHost)
                    .foregroundStyle(.secondary)
            }
            LabeledContent("Port") {
                Text("\(store.settings.tcpPort)")
                    .foregroundStyle(.secondary)
            }

            Button("Connect to TCP Server") {
                store.connectTCP()
            }
            .disabled(store.state.isConnected || store.state == .connecting)
        } header: {
            Text("Network Serial")
        } footer: {
            Text("Connect to a serial-over-IP bridge or telnet server. Edit host and port in Settings.")
        }
    }
}

private struct StatusIndicator: View {
    let state: ConnectionState

    var color: Color {
        switch state {
        case .disconnected: .gray
        case .connecting: .orange
        case .connected: .green
        case .error: .red
        }
    }

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 12, height: 12)
            .accessibilityHidden(true)
    }
}

#Preview {
    ConnectionView()
        .environmentObject(ConnectionStore())
}
