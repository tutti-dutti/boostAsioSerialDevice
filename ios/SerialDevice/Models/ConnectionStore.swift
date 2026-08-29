import Combine
import Foundation

@MainActor
final class ConnectionStore: ObservableObject {
    @Published private(set) var connectionType: ConnectionType = .bluetooth
    @Published private(set) var state: ConnectionState = .disconnected
    @Published private(set) var messages: [TerminalMessage] = []
    @Published var settings = AppSettings()
    @Published private(set) var discoveredBluetoothDevices: [BluetoothDevice] = []
    @Published private(set) var isScanning = false

    private let bluetoothService = BluetoothSerialService()
    private let tcpService = TCPSerialService()
    private var cancellables = Set<AnyCancellable>()

    init() {
        loadSettings()
        bindServices()
    }

    var activeServiceName: String? {
        switch connectionType {
        case .bluetooth:
            bluetoothService.connectedDeviceName
        case .tcp:
            "\(settings.tcpHost):\(settings.tcpPort)"
        }
    }

    func setConnectionType(_ type: ConnectionType) {
        guard type != connectionType else { return }
        disconnect()
        connectionType = type
    }

    func startBluetoothScan() {
        discoveredBluetoothDevices = []
        isScanning = true
        bluetoothService.startScanning()
    }

    func stopBluetoothScan() {
        isScanning = false
        bluetoothService.stopScanning()
    }

    func connectBluetooth(device: BluetoothDevice) {
        stopBluetoothScan()
        state = .connecting
        bluetoothService.connect(to: device)
    }

    func connectTCP() {
        state = .connecting
        tcpService.connect(host: settings.tcpHost, port: settings.tcpPort)
    }

    func connect() {
        switch connectionType {
        case .bluetooth:
            appendSystemMessage("Select a Bluetooth device to connect.")
        case .tcp:
            connectTCP()
        }
    }

    func disconnect() {
        bluetoothService.disconnect()
        tcpService.disconnect()
        state = .disconnected
    }

    func send(text: String) {
        let payload = text.data(using: .utf8) ?? Data()
        let data = payload + settings.lineEnding.bytes
        send(data: data, preview: text)
    }

    func send(data: Data, preview: String) {
        guard state.isConnected else {
            appendSystemMessage("Not connected.")
            return
        }

        appendMessage(TerminalMessage(direction: .outgoing, text: preview, rawData: data))

        switch connectionType {
        case .bluetooth:
            bluetoothService.send(data)
        case .tcp:
            tcpService.send(data)
        }
    }

    func clearMessages() {
        messages.removeAll()
    }

    func saveSettings() {
        guard let encoded = try? JSONEncoder().encode(settings) else { return }
        UserDefaults.standard.set(encoded, forKey: "AppSettings")
    }

    private func bindServices() {
        bluetoothService.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                guard self?.connectionType == .bluetooth else { return }
                self?.state = state
            }
            .store(in: &cancellables)

        bluetoothService.$discoveredDevices
            .receive(on: DispatchQueue.main)
            .sink { [weak self] devices in
                self?.discoveredBluetoothDevices = devices
            }
            .store(in: &cancellables)

        bluetoothService.incomingData
            .receive(on: DispatchQueue.main)
            .sink { [weak self] data in
                guard self?.connectionType == .bluetooth else { return }
                self?.handleIncoming(data)
            }
            .store(in: &cancellables)

        tcpService.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                guard self?.connectionType == .tcp else { return }
                self?.state = state
            }
            .store(in: &cancellables)

        tcpService.incomingData
            .receive(on: DispatchQueue.main)
            .sink { [weak self] data in
                guard self?.connectionType == .tcp else { return }
                self?.handleIncoming(data)
            }
            .store(in: &cancellables)
    }

    private func handleIncoming(_ data: Data) {
        let text: String
        switch settings.displayMode {
        case .text:
            text = String(data: data, encoding: .utf8) ?? data.hexString
        case .hex:
            text = data.hexString
        }
        appendMessage(TerminalMessage(direction: .incoming, text: text, rawData: data))
    }

    private func appendSystemMessage(_ text: String) {
        appendMessage(TerminalMessage(direction: .system, text: text))
    }

    private func appendMessage(_ message: TerminalMessage) {
        messages.append(message)
    }

    private func loadSettings() {
        guard
            let data = UserDefaults.standard.data(forKey: "AppSettings"),
            let decoded = try? JSONDecoder().decode(AppSettings.self, from: data)
        else { return }
        settings = decoded
    }
}

extension Data {
    var hexString: String {
        map { String(format: "%02X", $0) }.joined(separator: " ")
    }
}
