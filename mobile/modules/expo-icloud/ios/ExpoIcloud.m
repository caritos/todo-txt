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

// Reads an iCloud file using NSFileCoordinator, which triggers a download of evicted
// files and waits for completion before returning content. Without coordination,
// Expo FileSystem silently returns empty when the file hasn't been downloaded yet.
RCT_EXPORT_METHOD(readFile:(NSString *)path
                  containerId:(NSString *)containerId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    [fm URLForUbiquityContainerIdentifier:containerId];

    NSURL *fileURL = [NSURL fileURLWithPath:path];

    // Trigger download of evicted file (non-blocking; coordination will wait)
    [fm startDownloadingUbiquitousItemAtURL:fileURL error:nil];

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
      // File doesn't exist yet — return empty string so caller treats it as empty list
      resolve(@"");
    } else {
      resolve(content ?: @"");
    }
  });
}

@end
