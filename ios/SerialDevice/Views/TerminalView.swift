import SwiftUI

struct TerminalView: View {
    @EnvironmentObject private var store: ConnectionStore
    @State private var inputText = ""
    @FocusState private var isInputFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 8) {
                            if store.messages.isEmpty {
                                ContentUnavailableView(
                                    "No Data Yet",
                                    systemImage: "text.bubble",
                                    description: Text("Connect to a device and send a message to start.")
                                )
                                .frame(maxWidth: .infinity, minHeight: 280)
                            } else {
                                ForEach(store.messages) { message in
                                    MessageRow(message: message)
                                        .id(message.id)
                                }
                            }
                        }
                        .padding()
                    }
                    .onChange(of: store.messages.count) { _, _ in
                        if let last = store.messages.last {
                            withAnimation {
                                proxy.scrollTo(last.id, anchor: .bottom)
                            }
                        }
                    }
                }

                Divider()

                HStack(spacing: 12) {
                    TextField("Send message…", text: $inputText, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(1...4)
                        .focused($isInputFocused)
                        .disabled(!store.state.isConnected)
                        .onSubmit(sendMessage)

                    Button(action: sendMessage) {
                        Image(systemName: "paperplane.fill")
                            .font(.title3)
                    }
                    .disabled(!store.state.isConnected || inputText.isEmpty)
                }
                .padding()
                .background(.bar)
            }
            .navigationTitle("Terminal")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Clear") {
                        store.clearMessages()
                    }
                    .disabled(store.messages.isEmpty)
                }
            }
        }
    }

    private func sendMessage() {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        store.send(text: trimmed)
        inputText = ""
    }
}

private struct MessageRow: View {
    let message: TerminalMessage

    var body: some View {
        HStack(alignment: .top) {
            if message.direction == .outgoing {
                Spacer(minLength: 40)
            }

            VStack(alignment: message.direction == .outgoing ? .trailing : .leading, spacing: 4) {
                Text(message.text)
                    .font(.system(.body, design: .monospaced))
                    .padding(10)
                    .background(backgroundColor)
                    .foregroundStyle(foregroundColor)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                Text(message.timestamp.formatted(date: .omitted, time: .standard))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            if message.direction != .outgoing {
                Spacer(minLength: 40)
            }
        }
    }

    private var backgroundColor: Color {
        switch message.direction {
        case .incoming: Color(.systemGray5)
        case .outgoing: Color.accentColor.opacity(0.2)
        case .system: Color.orange.opacity(0.15)
        }
    }

    private var foregroundColor: Color {
        switch message.direction {
        case .system: .orange
        default: .primary
        }
    }
}

#Preview {
    TerminalView()
        .environmentObject(ConnectionStore())
}
