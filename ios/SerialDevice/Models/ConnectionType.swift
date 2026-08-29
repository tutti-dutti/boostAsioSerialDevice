import Foundation

enum ConnectionType: String, CaseIterable, Identifiable, Codable {
    case bluetooth
    case tcp

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .bluetooth: "Bluetooth LE"
        case .tcp: "TCP / Network"
        }
    }

    var systemImage: String {
        switch self {
        case .bluetooth: "dot.radiowaves.left.and.right"
        case .tcp: "network"
        }
    }
}

enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case error(String)

    var label: String {
        switch self {
        case .disconnected: "Disconnected"
        case .connecting: "Connecting…"
        case .connected: "Connected"
        case .error(let message): message
        }
    }

    var isConnected: Bool {
        if case .connected = self { return true }
        return false
    }
}

struct TerminalMessage: Identifiable, Equatable {
    enum Direction {
        case incoming
        case outgoing
        case system
    }

    let id = UUID()
    let timestamp: Date
    let direction: Direction
    let text: String
    let rawData: Data?

    init(direction: Direction, text: String, rawData: Data? = nil) {
        self.timestamp = Date()
        self.direction = direction
        self.text = text
        self.rawData = rawData
    }
}

struct AppSettings: Codable, Equatable {
    var lineEnding: LineEnding = .crlf
    var displayMode: DisplayMode = .text
    var tcpHost: String = "192.168.1.100"
    var tcpPort: Int = 23
    var autoReconnect: Bool = false

    enum LineEnding: String, CaseIterable, Identifiable, Codable {
        case none
        case lf
        case cr
        case crlf

        var id: String { rawValue }

        var label: String {
            switch self {
            case .none: "None"
            case .lf: "LF"
            case .cr: "CR"
            case .crlf: "CRLF"
            }
        }

        var bytes: Data {
            switch self {
            case .none: Data()
            case .lf: Data([0x0A])
            case .cr: Data([0x0D])
            case .crlf: Data([0x0D, 0x0A])
            }
        }
    }

    enum DisplayMode: String, CaseIterable, Identifiable, Codable {
        case text
        case hex

        var id: String { rawValue }

        var label: String {
            switch self {
            case .text: "Text"
            case .hex: "Hex"
            }
        }
    }
}
