#import "ExpoIcloud.h"
#import <Foundation/Foundation.h>

@implementation ExpoIcloud

RCT_EXPORT_MODULE()

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

@end
