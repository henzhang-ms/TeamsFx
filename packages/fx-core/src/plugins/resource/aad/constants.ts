// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { RequiredResourceAccess } from "./interfaces/IAADDefinition";

export class Constants {
  static teamsMobileDesktopAppId = "1fec8e78-bce4-4aaf-ab1b-5451cc387264";
  static teamsWebAppId = "5e3ce6c0-2b1f-4285-8d4b-75ee78787346";
  static oauthAuthorityPrefix = "https://login.microsoftonline.com/";
  static aadAppMaxLength = 120;
  static aadAppPasswordDisplayName = "default";

  static localDebugPrefix = "local_";

  static AskForEnv = "Which Azure AD app do you want to update permission for?";
  static AskForEnvName = "aad-env";

  static readonly telemetryComponent = "component";

  static defaultPermissions: RequiredResourceAccess = {
    resourceAppId: "00000003-0000-0000-c000-000000000000",
    resourceAccess: [
      {
        // permission: email
        id: "64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0",
        type: "Scope",
      },
      {
        // permission: offline_access
        id: "7427e0e9-2fba-42fe-b0c0-848c9e6a8182",
        type: "Scope",
      },
      {
        // permission: openid
        id: "37f7f235-527c-4136-accd-4a02d197296e",
        type: "Scope",
      },
      {
        // permission: profile
        id: "14dad69e-099b-42c9-810b-d002981feec1",
        type: "Scope",
      },
      {
        // permission: User.Read
        id: "e1fe6dd8-ba31-4d61-89e7-88639da4683d",
        type: "Scope",
      },
    ],
  };
}

export class Plugins {
  static pluginName = "Aad App for Teams App";
  static pluginNameComplex = "fx-resource-aad-app-for-teams";
  static pluginNameShort = "aad";
  static frontendHosting = "fx-resource-frontend-hosting";
  static teamsBot = "fx-resource-teamsbot";
  static localDebug = "fx-resource-local-debug";
  static solution = "solution";
}

export class ConfigKeys {
  static applicationIdUri = "applicationIdUris";
  static clientId = "clientId";
  static clientSecret = "clientSecret";
  static objectId = "objectId";
  static oauth2PermissionScopeId = "oauth2PermissionScopeId";
  static teamsMobileDesktopAppId = "teamsMobileDesktopAppId";
  static teamsWebAppId = "teamsWebAppId";
  static domain = "domain";
  static endpoint = "endpoint";
  static oauthAuthority = "oauthAuthority";
  static oauthHost = "oauthHost";
  static tenantId = "tenantId";
  static skip = "skipProvision";
}

export class ConfigKeysOfOtherPlugin {
  static frontendHostingDomain = "domain";
  static frontendHostingEndpoint = "endpoint";
  static teamsBotId = "botId";
  static teamsBotIdLocal = "localBotId";
  static teamsBotEndpoint = "siteEndpoint";
  static localDebugTabDomain = "localTabDomain";
  static localDebugTabEndpoint = "localTabEndpoint";
  static localDebugBotEndpoint = "localBotEndpoint";
  static solutionPermissionRequest = "permissionRequest";
}

export interface Messages {
  log: string;
  telemetry: string;
}

export class Messages {
  public static readonly getLog = (log: string) =>
    `[${Plugins.pluginName}] ${log}`;
  private static readonly getEventName = (eventName: string) =>
    `${Plugins.pluginName}/${eventName}`;

  static readonly StartProvision: Messages = {
    log: Messages.getLog("Start to provision"),
    telemetry: Messages.getEventName("provision-start"),
  };

  static readonly EndProvision: Messages = {
    log: Messages.getLog("Successfully provision"),
    telemetry: Messages.getEventName("provision"),
  };

  static readonly StartLocalDebug: Messages = {
    log: Messages.getLog("Start to local debug"),
    telemetry: Messages.getEventName("local-debug-start"),
  };

  static readonly EndLocalDebug: Messages = {
    log: Messages.getLog("Successfully local debug"),
    telemetry: Messages.getEventName("local-debug"),
  };

  static readonly StartPostProvision: Messages = {
    log: Messages.getLog("Start to post-provision"),
    telemetry: Messages.getEventName("post-provision-start"),
  };

  static readonly EndPostProvision: Messages = {
    log: Messages.getLog("Successfully post-provision"),
    telemetry: Messages.getEventName("post-provision"),
  };

  static readonly StartPostLocalDebug: Messages = {
    log: Messages.getLog("Start to post local debug"),
    telemetry: Messages.getEventName("post-local-debug-start"),
  };

  static readonly EndPostLocalDebug: Messages = {
    log: Messages.getLog("Successfully post local debug"),
    telemetry: Messages.getEventName("post-local-debug"),
  };

  static readonly StartUpdatePermission: Messages = {
    log: Messages.getLog("Start to update permission"),
    telemetry: Messages.getEventName("update-permission-start"),
  };

  static readonly EndUpdatePermission: Messages = {
    log: Messages.getLog("Successfully update permission"),
    telemetry: Messages.getEventName("update-permission"),
  };

  static readonly GetAadAppSuccess = "Successfully get Azure AD app.";
  static readonly CreateAadAppSuccess = "Successfully created Azure AD app.";
  static readonly CreateAadAppPasswordSuccess =
    "Successfully created password for Azure AD app.";
  static readonly UpdatePermissionSuccess =
    "Successfully updated permission for Azure AD app.";
  static readonly SetAppIdUriSuccess =
    "Successfully created application id uri for Azure AD app.";
  static readonly UpdateRedirectUriSuccess =
    "Successfully updated redirect uri for Azure AD app.";
  static readonly UpdateAppIdUriSuccess =
    "Successfully updated application id uri for Azure AD app.";
  static readonly ParsePermissionSuccess = "Successfully parsed permissions.";
  static readonly NoSelection =
    "No Azure AD app found. Will not update permissions. You need to run provision or local debug first.";
  static readonly UserCancelled = "Selection is cancelled by user.";
  static readonly UpdatePermissionSuccessMessage =
    "Successfully updated permission for Azure AD app. You can go to Azure Portal to check the permission or grant admin consent.";
  static readonly SkipProvision = "Azure AD app provision skipped. You need to mannual provision and config Azure AD app.";
}

export class ProgressTitle {
  static readonly Provision = "Provisioning Azure AD app";
  static readonly ProvisionSteps = 3;
  static readonly PostProvision = "Configuring Azure AD app";
  static readonly PostProvisionSteps = 2;
  static readonly UpdatePermission = "Updating permission for Azure AD app";
  static readonly UpdatePermissionSteps = 1;
}

export class ProgressDetail {
  static readonly Starting = "Starting";

  static readonly ProvisionAadApp = "Provision Azure AD app";
  static readonly CreateAadAppSecret = "Create secret for Azure AD app";
  static readonly GetAadApp = "Get Azure AD app";

  static readonly UpdateRedirectUri = "Update redirect uri for Azure AD app";
  static readonly UpdateAppIdUri = "Update application id uri for Azure AD app";

  static readonly UpdatePermission = "Update permission for Azure AD app";
}
