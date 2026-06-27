import ExpoModulesCore
import Foundation

public class ExpoIcloudModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoIcloud")

    // Calls url(forUbiquityContainerIdentifier:) on a background thread (required by Apple).
    // Returns the container's filesystem path, or nil if iCloud is unavailable.
    AsyncFunction("initContainer") { (containerId: String) async throws -> String? in
      return await withCheckedContinuation { continuation in
        DispatchQueue.global(qos: .userInitiated).async {
          let url = FileManager.default.url(forUbiquityContainerIdentifier: containerId)
          continuation.resume(returning: url?.path)
        }
      }
    }
  }
}
