// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
export interface PluginError {
    name: string;
    message: (...args: string[]) => string;
}

export const NoConfigError: PluginError = {
    name: "NoConfigError",
    message: (pluginId, configKey) => `Failed to get config value of '${configKey}' from '${pluginId}'.`,
};

export const UnauthenticatedError: PluginError = {
    name: "UnauthenticatedError",
    message: () => "Failed to get user login information.",
};

export const CreateAppServicePlanError: PluginError = {
    name: "CreateAppServicePlanError",
    message: (message) => `Failed to create App Service Plan: ${message}`,
};

export const CreateWebAppError: PluginError = {
    name: "CreateWebAppError",
    message: (message) => `Failed to create Web App: ${message}`,
};

export const ZipDeployError: PluginError = {
    name: "ZipDeployError",
    message: (message) => `Failed to do Zip Deployment: ${message}`,
};

export const UpdateApplicationSettingsError: PluginError = {
    name: "UpdateApplicationSettingsError",
    message: (message) => `Failed to update Application Settings: ${message}`,
};

export const UnhandledError: PluginError = {
    name: "UnhandledError",
    message: (message) => `Unhandled Error: ${message}`,
};

export const EndpointInvalidError: PluginError = {
    name: "EndpointInvalidError",
    message: (endpoint, message) => `Failed to verify endpoint: ${endpoint}. Reason: ${message}`,
};
