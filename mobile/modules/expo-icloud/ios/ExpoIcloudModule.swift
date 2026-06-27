import ExpoModulesCore
import Foundation

public class ExpoIcloudModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoIcloud")

    // Calls url(forUbiquityContainerIdentifier:) to initialize the iCloud container.
    // ExpoModulesCore runs AsyncFunction on a module-owned background queue, satisfying
    // Apple's requirement that this API must not be called on the main thread.
    // Returns the container's filesystem path, or nil if iCloud is unavailable.
    AsyncFunction("initContainer") { (containerId: String) -> String? in
      return FileManager.default.url(forUbiquityContainerIdentifier: containerId)?.path
    }
  }
}
