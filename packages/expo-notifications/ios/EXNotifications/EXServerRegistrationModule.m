// Copyright 2018-present 650 Industries. All rights reserved.

#import <EXNotifications/EXServerRegistrationModule.h>

static NSString * const kEXDeviceInstallUUIDKey = @"EXDeviceInstallUUIDKey";
static NSString * const kEXLastRegistrationInfoKey = @"EXLastRegistrationInfoKey";

@implementation EXServerRegistrationModule

UM_EXPORT_MODULE(NotificationsServerRegistrationModule)

UM_EXPORT_METHOD_AS(getInstallationIdAsync, getInstallationIdAsyncWithResolver:(UMPromiseResolveBlock)resolve rejecter:(UMPromiseRejectBlock)reject)
{
  resolve([self getInstallationId]);
}

- (NSString *)getInstallationId
{
  NSString *uuid = [[NSUserDefaults standardUserDefaults] stringForKey:kEXDeviceInstallUUIDKey];
  if (!uuid) {
    uuid = [[NSUUID UUID] UUIDString];
    [[NSUserDefaults standardUserDefaults] setObject:uuid forKey:kEXDeviceInstallUUIDKey];
  }
  return uuid;
}

UM_EXPORT_METHOD_AS(getLastRegistrationInfoAsync, getLastRegistrationInfoAsyncWithResolver:(UMPromiseResolveBlock)resolve rejecter:(UMPromiseRejectBlock)reject)
{
  resolve([[NSUserDefaults standardUserDefaults] stringForKey:kEXLastRegistrationInfoKey]);
}

UM_EXPORT_METHOD_AS(setLastRegistrationInfoAsync, setLastRegistrationInfoAsync:(NSString *)lastRegistrationInfo resolver:(UMPromiseResolveBlock)resolve rejecter:(UMPromiseRejectBlock)reject)
{
  [[NSUserDefaults standardUserDefaults] setObject:lastRegistrationInfo forKey:kEXLastRegistrationInfoKey];
  resolve(nil);
}

@end
