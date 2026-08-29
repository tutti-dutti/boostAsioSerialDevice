import Combine
import CoreBluetooth
import Foundation

struct BluetoothDevice: Identifiable, Equatable {
    let id: UUID
    let name: String
    let rssi: Int
    let peripheral: CBPeripheral

    static func == (lhs: BluetoothDevice, rhs: BluetoothDevice) -> Bool {
        lhs.id == rhs.id
    }
}

/// Communicates with BLE UART-style serial adapters (Nordic UART, HM-10, etc.).
final class BluetoothSerialService: NSObject, ObservableObject {
    static let uartServiceUUID = CBUUID(string: "6E400001-B5A3-F393-E0A9-E50E24DCCA9E")
    static let uartRXUUID = CBUUID(string: "6E400002-B5A3-F393-E0A9-E50E24DCCA9E")
    static let uartTXUUID = CBUUID(string: "6E400003-B5A3-F393-E0A9-E50E24DCCA9E")

    @Published private(set) var state: ConnectionState = .disconnected
    @Published private(set) var discoveredDevices: [BluetoothDevice] = []

    let incomingData = PassthroughSubject<Data, Never>()

    private(set) var connectedDeviceName: String?

    private var central: CBCentralManager!
    private var connectedPeripheral: CBPeripheral?
    private var txCharacteristic: CBCharacteristic?
    private var isScanning = false

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: .main)
    }

    func startScanning() {
        guard central.state == .poweredOn else {
            state = .error("Bluetooth is unavailable.")
            return
        }
        discoveredDevices = []
        isScanning = true
        central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
    }

    func stopScanning() {
        guard isScanning else { return }
        isScanning = false
        central.stopScan()
    }

    func connect(to device: BluetoothDevice) {
        stopScanning()
        state = .connecting
        connectedPeripheral = device.peripheral
        connectedDeviceName = device.name
        device.peripheral.delegate = self
        central.connect(device.peripheral, options: nil)
    }

    func disconnect() {
        stopScanning()
        if let peripheral = connectedPeripheral {
            central.cancelPeripheralConnection(peripheral)
        }
        resetConnection()
    }

    func send(_ data: Data) {
        guard
            let peripheral = connectedPeripheral,
            let characteristic = txCharacteristic
        else { return }

        let writeType: CBCharacteristicWriteType = characteristic.properties.contains(.writeWithoutResponse)
            ? .withoutResponse
            : .withResponse
        peripheral.writeValue(data, for: characteristic, type: writeType)
    }

    private func resetConnection() {
        connectedPeripheral = nil
        txCharacteristic = nil
        connectedDeviceName = nil
        state = .disconnected
    }
}

extension BluetoothSerialService: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            if isScanning { startScanning() }
        case .unauthorized:
            state = .error("Bluetooth permission denied.")
        case .poweredOff:
            state = .error("Bluetooth is turned off.")
        default:
            state = .error("Bluetooth is unavailable.")
        }
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let name = peripheral.name
            ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String
            ?? "Unknown Device"

        let device = BluetoothDevice(
            id: peripheral.identifier,
            name: name,
            rssi: RSSI.intValue,
            peripheral: peripheral
        )

        if let index = discoveredDevices.firstIndex(where: { $0.id == device.id }) {
            discoveredDevices[index] = device
        } else {
            discoveredDevices.append(device)
        }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.discoverServices([Self.uartServiceUUID])
    }

    func centralManager(
        _ central: CBCentralManager,
        didFailToConnect peripheral: CBPeripheral,
        error: Error?
    ) {
        state = .error(error?.localizedDescription ?? "Connection failed.")
        resetConnection()
    }

    func centralManager(
        _ central: CBCentralManager,
        didDisconnectPeripheral peripheral: CBPeripheral,
        error: Error?
    ) {
        if let error {
            state = .error(error.localizedDescription)
        } else {
            state = .disconnected
        }
        resetConnection()
    }
}

extension BluetoothSerialService: CBPeripheralDelegate {
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error {
            state = .error(error.localizedDescription)
            disconnect()
            return
        }

        guard let service = peripheral.services?.first(where: { $0.uuid == Self.uartServiceUUID }) else {
            state = .error("UART service not found on this device.")
            disconnect()
            return
        }

        peripheral.discoverCharacteristics([Self.uartRXUUID, Self.uartTXUUID], for: service)
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverCharacteristicsFor service: CBService,
        error: Error?
    ) {
        if let error {
            state = .error(error.localizedDescription)
            disconnect()
            return
        }

        guard let characteristics = service.characteristics else {
            state = .error("No UART characteristics found.")
            disconnect()
            return
        }

        for characteristic in characteristics {
            if characteristic.uuid == Self.uartTXUUID {
                txCharacteristic = characteristic
            }
            if characteristic.uuid == Self.uartRXUUID {
                peripheral.setNotifyValue(true, for: characteristic)
            }
        }

        guard txCharacteristic != nil else {
            state = .error("TX characteristic not found.")
            disconnect()
            return
        }

        state = .connected
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        if let error {
            state = .error(error.localizedDescription)
            return
        }

        guard characteristic.uuid == Self.uartRXUUID, let data = characteristic.value else { return }
        incomingData.send(data)
    }
}
