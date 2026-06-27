import ExpoModulesCore
import Foundation

public class ExpoIcloudModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoIcloud")

    // Returns the iCloud container path, or nil with a reason string.
    // ExpoModulesCore runs AsyncFunction on a module-owned background queue, satisfying
    // Apple's requirement that these APIs must not be called on the main thread.
    AsyncFunction("initContainer") { (containerId: String) -> [String: String?] in
      let identityToken = FileManager.default.ubiquityIdentityToken
      let containerUrl = FileManager.default.url(forUbiquityContainerIdentifier: containerId)
      return [
        "path": containerUrl?.path,
        "identityAvailable": identityToken != nil ? "yes" : "no"
      ]
    }
  }
}
