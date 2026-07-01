#import "ExpoIcloud.h"
#import <Foundation/Foundation.h>

@implementation ExpoIcloud

RCT_EXPORT_MODULE()

// Initializes the iCloud ubiquity container. Must be called on a background thread.
RCT_EXPORT_METHOD(initContainer:(NSString *)containerId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    NSURL *url = [fm URLForUbiquityContainerIdentifier:containerId];
    if (url) {
      resolve(url.path);
    } else if (!fm.ubiquityIdentityToken) {
      reject(@"NOT_SIGNED_IN", @"NOT_SIGNED_IN", nil);
    } else {
      reject(@"CONTAINER_UNAVAILABLE", @"CONTAINER_UNAVAILABLE", nil);
    }
  });
}

// Writes content to an iCloud path using NSFileCoordinator, which is required for
// all iCloud container writes. Expo FileSystem does not use file coordination, so
// direct writes to iCloud paths fail with "not writable".
RCT_EXPORT_METHOD(writeFile:(NSString *)path
                  content:(NSString *)content
                  containerId:(NSString *)containerId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];

    // Ensure the ubiquity container is initialized
    [fm URLForUbiquityContainerIdentifier:containerId];

    NSURL *fileURL = [NSURL fileURLWithPath:path];
    NSURL *dirURL = [fileURL URLByDeletingLastPathComponent];

    // Create parent directory (Documents/ inside the container)
    NSError *mkdirError = nil;
    [fm createDirectoryAtURL:dirURL
 withIntermediateDirectories:YES
                  attributes:nil
                       error:&mkdirError];
    // Non-fatal: if it already exists, error is nil or can be ignored

    // Write with file coordination (required for iCloud paths)
    NSFileCoordinator *coordinator = [[NSFileCoordinator alloc] initWithFilePresenter:nil];
    __block NSError *writeError = nil;
    NSError *coordinatorError = nil;

    [coordinator coordinateWritingItemAtURL:fileURL
                                    options:NSFileCoordinatorWritingForReplacing
                                      error:&coordinatorError
                                 byAccessor:^(NSURL *newURL) {
      [content writeToURL:newURL
              atomically:NO
                encoding:NSUTF8StringEncoding
                   error:&writeError];
    }];

    if (coordinatorError) {
      reject(@"COORDINATOR_ERROR", coordinatorError.localizedDescription, coordinatorError);
    } else if (writeError) {
      reject(@"WRITE_ERROR", writeError.localizedDescription, writeError);
    } else {
      resolve(nil);
    }
  });
}

// Reads an iCloud file, waiting for it to download if it's a cloud-only stub.
// startDownloadingUbiquitousItemAtURL is non-blocking, so we poll the download
// status (up to 30s) before reading with NSFileCoordinator.
RCT_EXPORT_METHOD(readFile:(NSString *)path
                  containerId:(NSString *)containerId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    NSURL *containerURL = [fm URLForUbiquityContainerIdentifier:containerId];
    if (!containerURL) {
      // Container unavailable — missing ubiquity-container-identifiers entitlement or iCloud not signed in
      if (!fm.ubiquityIdentityToken) {
        reject(@"NOT_SIGNED_IN", @"NOT_SIGNED_IN", nil);
      } else {
        reject(@"CONTAINER_UNAVAILABLE", @"CONTAINER_UNAVAILABLE", nil);
      }
      return;
    }

    NSURL *fileURL = [NSURL fileURLWithPath:path];

    // File doesn't exist at all — return empty
    if (![fm fileExistsAtPath:path]) {
      resolve(@"");
      return;
    }

    // Trigger download and poll until the file is on-device (max 30s)
    [fm startDownloadingUbiquitousItemAtURL:fileURL error:nil];
    for (NSInteger i = 0; i < 60; i++) {
      NSString *status = nil;
      [fileURL getResourceValue:&status
                         forKey:NSURLUbiquitousItemDownloadingStatusKey
                          error:nil];
      if (status && ![status isEqualToString:NSURLUbiquitousItemDownloadingStatusNotDownloaded]) {
        break;
      }
      [NSThread sleepForTimeInterval:0.5];
    }

    NSFileCoordinator *coordinator = [[NSFileCoordinator alloc] initWithFilePresenter:nil];
    __block NSString *content = nil;
    __block NSError *readError = nil;
    NSError *coordinatorError = nil;

    [coordinator coordinateReadingItemAtURL:fileURL
                                    options:0
                                      error:&coordinatorError
                                 byAccessor:^(NSURL *newURL) {
      content = [NSString stringWithContentsOfURL:newURL
                                         encoding:NSUTF8StringEncoding
                                            error:&readError];
    }];

    if (coordinatorError) {
      reject(@"COORDINATOR_ERROR", coordinatorError.localizedDescription, coordinatorError);
    } else if (readError) {
      resolve(@"");
    } else {
      resolve(content ?: @"");
    }
  });
}

@end
