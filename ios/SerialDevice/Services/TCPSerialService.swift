import Combine
import Foundation
import Network

/// Connects to serial-over-IP bridges and telnet-style network serial servers.
final class TCPSerialService: ObservableObject {
    @Published private(set) var state: ConnectionState = .disconnected

    let incomingData = PassthroughSubject<Data, Never>()

    private var connection: NWConnection?
    private let queue = DispatchQueue(label: "com.serialdevice.tcp")

    func connect(host: String, port: Int) {
        disconnect()
        state = .connecting

        guard let nwPort = NWEndpoint.Port(rawValue: UInt16(port)) else {
            state = .error("Invalid port number.")
            return
        }

        let endpoint = NWEndpoint.hostPort(host: NWEndpoint.Host(host), port: nwPort)
        let connection = NWConnection(to: endpoint, using: .tcp)
        self.connection = connection

        connection.stateUpdateHandler = { [weak self] newState in
            DispatchQueue.main.async {
                self?.handleState(newState)
            }
        }

        connection.start(queue: queue)
        receiveNextChunk(on: connection)
    }

    func disconnect() {
        connection?.cancel()
        connection = nil
        state = .disconnected
    }

    func send(_ data: Data) {
        connection?.send(
            content: data,
            completion: .contentProcessed { [weak self] error in
                if let error {
                    DispatchQueue.main.async {
                        self?.state = .error(error.localizedDescription)
                    }
                }
            }
        )
    }

    private func handleState(_ newState: NWConnection.State) {
        switch newState {
        case .ready:
            state = .connected
        case .waiting(let error):
            state = .error(error.localizedDescription)
        case .failed(let error):
            state = .error(error.localizedDescription)
            disconnect()
        case .cancelled:
            state = .disconnected
        default:
            break
        }
    }

    private func receiveNextChunk(on connection: NWConnection) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] data, _, isComplete, error in
            if let data, !data.isEmpty {
                self?.incomingData.send(data)
            }

            if let error {
                DispatchQueue.main.async {
                    self?.state = .error(error.localizedDescription)
                }
                return
            }

            if isComplete {
                DispatchQueue.main.async {
                    self?.state = .disconnected
                }
                return
            }

            self?.receiveNextChunk(on: connection)
        }
    }
}
