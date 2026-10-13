import ExpoModulesCore
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Chat on Apple's on-device model (Foundation Models, iOS 26+, Apple Intelligence phones).
/// JS side: src/ai/appleChat.ts. Why: docs/decisions/009-apple-intelligence-chat.md.
///
/// One reply = one `start(id, …)`: a fresh session streams cumulative snapshots as `onChunk`,
/// then `onDone` (also after `stop`) or `onError` with a short code.
public class AppleChatModule: Module {
  private var tasks: [String: Task<Void, Never>] = [:]
  private let lock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("AppleChat")
    Events("onChunk", "onDone", "onError")

    /// "available" | "notEnabled" | "notReady" | "language" | "device", for the app language `lang`.
    Function("availability") { (lang: String) -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        let model = SystemLanguageModel.default
        switch model.availability {
        case .available:
          return model.supportsLocale(Locale(identifier: lang)) ? "available" : "language"
        case .unavailable(.appleIntelligenceNotEnabled):
          return model.supportsLocale(Locale(identifier: lang)) ? "notEnabled" : "language"
        case .unavailable(.modelNotReady):
          return "notReady"
        default:
          return "device"
        }
      }
      #endif
      return "device"
    }

    Function("start") { (id: String, instructions: String, prompt: String, temperature: Double, maxTokens: Int) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        // The module lives as long as the app, so the task holds it strongly. It starts under the
        // lock, so its own forget(id) can't run before it is stored.
        self.lock.withLock {
          self.tasks[id] = Task {
            do {
              let session = LanguageModelSession(instructions: instructions)
              let options = GenerationOptions(temperature: temperature, maximumResponseTokens: maxTokens)
              for try await snapshot in session.streamResponse(to: prompt, options: options) {
                try Task.checkCancellation()
                self.sendEvent("onChunk", ["id": id, "text": snapshot.content])
              }
              self.sendEvent("onDone", ["id": id])
            } catch is CancellationError {
              self.sendEvent("onDone", ["id": id])
            } catch {
              self.sendEvent("onError", ["id": id, "code": AppleChatModule.code(for: error)])
            }
            self.forget(id)
          }
        }
        return
      }
      #endif
      self.sendEvent("onError", ["id": id, "code": "unavailable"])
    }

    Function("stop") { (id: String) in
      self.lock.withLock { self.tasks.removeValue(forKey: id) }?.cancel()
    }
  }

  private func forget(_ id: String) {
    lock.withLock { _ = tasks.removeValue(forKey: id) }
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func code(for error: Error) -> String {
    #if compiler(>=6.4)
    // iOS 27 SDK: the newer error type (Xcode 26 doesn't have it).
    if #available(iOS 27.0, *), let e = error as? LanguageModelError {
      switch e {
      case .guardrailViolation, .refusal: return "guardrail"
      case .unsupportedLanguageOrLocale: return "language"
      case .contextSizeExceeded: return "context"
      default: return "other"
      }
    }
    #endif
    if let e = error as? LanguageModelSession.GenerationError {
      switch e {
      case .guardrailViolation, .refusal: return "guardrail"
      case .unsupportedLanguageOrLocale: return "language"
      case .exceededContextWindowSize: return "context"
      default: return "other"
      }
    }
    return "other"
  }
  #endif
}
