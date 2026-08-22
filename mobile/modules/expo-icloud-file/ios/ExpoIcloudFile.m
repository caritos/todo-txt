#import "ExpoIcloudFile.h"
#import <UIKit/UIKit.h>
#import <React/RCTUtils.h>

@interface ExpoIcloudFile () <UIDocumentPickerDelegate>
@property (nonatomic, copy, nullable) RCTPromiseResolveBlock pickResolve;
@property (nonatomic, copy, nullable) RCTPromiseRejectBlock pickReject;
@end

@implementation ExpoIcloudFile

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

#pragma mark - pickFolder

RCT_EXPORT_METHOD(pickFolder:(NSString *)sourcePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (self.pickResolve || self.pickReject) {
    reject(@"PICKER_BUSY", @"A folder picker is already open.", nil);
    return;
  }

  NSURL *sourceURL = [NSURL fileURLWithPath:sourcePath];
  UIDocumentPickerViewController *picker =
    [[UIDocumentPickerViewController alloc] initForExportingURLs:@[ sourceURL ]];
  picker.delegate = self;
  picker.modalPresentationStyle = UIModalPresentationFormSheet;

  self.pickResolve = resolve;
  self.pickReject = reject;

  UIViewController *root = RCTPresentedViewController();
  [root presentViewController:picker animated:YES completion:nil];
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller
  didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls
{
  RCTPromiseResolveBlock resolve = self.pickResolve;
  RCTPromiseRejectBlock reject = self.pickReject;
  self.pickResolve = nil;
  self.pickReject = nil;

  NSURL *fileURL = urls.firstObject;
  if (!fileURL) {
    if (reject) reject(@"PICK_FAILED", @"No file was picked.", nil);
    return;
  }

  NSError *bookmarkError = nil;
  NSData *bookmark = [fileURL bookmarkDataWithOptions:NSURLBookmarkCreationMinimalBookmark
                        includingResourceValuesForKeys:nil
                                         relativeToURL:nil
                                                 error:&bookmarkError];
  if (!bookmark) {
    if (reject) reject(@"BOOKMARK_FAILED", bookmarkError.localizedDescription ?: @"Could not create a bookmark for the picked file.", bookmarkError);
    return;
  }

  NSString *folderName = fileURL.URLByDeletingLastPathComponent.lastPathComponent;
  if (resolve) {
    resolve(@{
      @"bookmark": [bookmark base64EncodedStringWithOptions:0],
      @"name": folderName ?: @"iCloud Drive",
    });
  }
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller
{
  RCTPromiseRejectBlock reject = self.pickReject;
  self.pickResolve = nil;
  self.pickReject = nil;
  if (reject) reject(@"CANCELLED", @"The user cancelled the picker.", nil);
}

#pragma mark - Bookmark resolution

- (nullable NSURL *)resolveBookmark:(NSString *)base64Bookmark error:(NSError **)error
{
  NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Bookmark options:0];
  if (!data) {
    if (error) {
      *error = [NSError errorWithDomain:@"ExpoIcloudFile"
                                    code:1
                                userInfo:@{ NSLocalizedDescriptionKey: @"Malformed bookmark." }];
    }
    return nil;
  }
  BOOL isStale = NO;
  NSURL *url = [NSURL URLByResolvingBookmarkData:data
                                          options:0
                                    relativeToURL:nil
                              bookmarkDataIsStale:&isStale
                                            error:error];
  return url;
}

#pragma mark - readFile

RCT_EXPORT_METHOD(readFile:(NSString *)bookmark
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSError *resolveError = nil;
    NSURL *url = [self resolveBookmark:bookmark error:&resolveError];
    if (!url) {
      reject(@"BOOKMARK_STALE", resolveError.localizedDescription ?: @"Could not resolve the iCloud Drive location.", resolveError);
      return;
    }

    BOOL accessing = [url startAccessingSecurityScopedResource];

    if (![[NSFileManager defaultManager] fileExistsAtPath:url.path]) {
      if (accessing) [url stopAccessingSecurityScopedResource];
      reject(@"FILE_NOT_FOUND", @"The todo.txt file no longer exists at the saved location.", nil);
      return;
    }

    NSError *downloadError = nil;
    [[NSFileManager defaultManager] startDownloadingUbiquitousItemAtURL:url error:&downloadError];
    for (int i = 0; i < 60; i++) {
      id status = nil;
      [url getResourceValue:&status forKey:NSURLUbiquitousItemDownloadingStatusKey error:nil];
      if (status && ![status isEqual:NSURLUbiquitousItemDownloadingStatusNotDownloaded]) break;
      [NSThread sleepForTimeInterval:0.5];
    }

    NSFileCoordinator *coordinator = [[NSFileCoordinator alloc] initWithFilePresenter:nil];
    __block NSString *content = nil;
    __block NSError *readError = nil;
    NSError *coordinatorError = nil;
    [coordinator coordinateReadingItemAtURL:url options:0 error:&coordinatorError byAccessor:^(NSURL *newURL) {
      content = [NSString stringWithContentsOfURL:newURL encoding:NSUTF8StringEncoding error:&readError];
    }];

    if (accessing) [url stopAccessingSecurityScopedResource];

    NSError *finalError = coordinatorError ?: readError;
    if (finalError) {
      reject(@"READ_FAILED", finalError.localizedDescription, finalError);
      return;
    }
    resolve(content ?: @"");
  });
}

#pragma mark - writeFile

RCT_EXPORT_METHOD(writeFile:(NSString *)bookmark
                  content:(NSString *)content
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSError *resolveError = nil;
    NSURL *url = [self resolveBookmark:bookmark error:&resolveError];
    if (!url) {
      reject(@"BOOKMARK_STALE", resolveError.localizedDescription ?: @"Could not resolve the iCloud Drive location.", resolveError);
      return;
    }

    BOOL accessing = [url startAccessingSecurityScopedResource];

    NSFileCoordinator *coordinator = [[NSFileCoordinator alloc] initWithFilePresenter:nil];
    __block NSError *writeError = nil;
    NSError *coordinatorError = nil;
    [coordinator coordinateWritingItemAtURL:url
                                     options:NSFileCoordinatorWritingForReplacing
                                       error:&coordinatorError
                                  byAccessor:^(NSURL *newURL) {
      [content writeToURL:newURL atomically:NO encoding:NSUTF8StringEncoding error:&writeError];
    }];

    if (accessing) [url stopAccessingSecurityScopedResource];

    NSError *finalError = coordinatorError ?: writeError;
    if (finalError) {
      reject(@"WRITE_FAILED", finalError.localizedDescription, finalError);
      return;
    }
    resolve(nil);
  });
}

@end
