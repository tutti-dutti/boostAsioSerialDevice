# boostAsioSerialDevice

An iOS companion app for communicating with serial devices from your iPhone.

## Serial Device (iOS)

The `ios/` directory contains a native SwiftUI app that lets you connect to serial hardware from iOS using the connection methods iOS supports:

- **Bluetooth LE** — Nordic UART and similar BLE serial adapters
- **TCP / Network** — serial-over-IP bridges and telnet-style servers

### Features

- Scan and connect to nearby BLE UART devices
- Connect to network serial servers by host and port
- Terminal-style send/receive with timestamps
- Text or hex display for incoming data
- Configurable line endings (None, LF, CR, CRLF)

### Requirements

- macOS with **Xcode 15+**
- iPhone or iPad running **iOS 17+**
- Apple Developer account (for device deployment)

### Run on Your iPhone

1. Clone this repository on your Mac:
   ```bash
   git clone https://github.com/tutti-dutti/boostAsioSerialDevice.git
   cd boostAsioSerialDevice/ios
   ```

2. Open the project in Xcode:
   ```bash
   open SerialDevice.xcodeproj
   ```

3. In Xcode, select the **SerialDevice** target → **Signing & Capabilities** and choose your Team.

4. Connect your iPhone via USB (or use wireless debugging).

5. Select your phone as the run destination and press **Run** (⌘R).

6. When prompted on your iPhone, allow **Bluetooth** access.

### Project Structure

```
ios/
├── SerialDevice.xcodeproj
└── SerialDevice/
    ├── SerialDeviceApp.swift      # App entry point
    ├── ContentView.swift          # Tab navigation
    ├── Models/                    # Connection state & settings
    ├── Services/                  # Bluetooth & TCP transport
    ├── Views/                     # Connect, Terminal, Settings screens
    └── Assets.xcassets
```

### Notes

iOS does not expose raw USB serial ports to third-party apps. This app uses **Core Bluetooth** for BLE UART adapters and the **Network** framework for TCP serial bridges — the standard approaches for serial communication on iPhone.

For desktop or embedded serial work with Boost.Asio, this repository can be extended with a C++ library target in a future update.

## License

MIT (suggested — add a LICENSE file if needed)
