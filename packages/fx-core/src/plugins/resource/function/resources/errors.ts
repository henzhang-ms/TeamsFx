// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { ConfigFolderName, SystemError, UserError } from "fx-api";

import { FunctionPluginPathInfo } from "../constants";
import { Logger } from "../utils/logger";

export enum ErrorType {
    User,
    System
}

const tips = {
    recoverTeamsfxConfigFiles: `If you manually updated configuration files (under directory .${ConfigFolderName}), recover them.`,
    recreateProject: "If you can not recover configuration files, start a new project.",
    checkNetwork: "Check your network connection.",
    retryRequest: "Retry the command after network connection is restored.",
    chooseAnotherCompose: "Create a project with another template.",
    resolveWithLog: "Check log for error.",
    reportIssue: "Report an issue with information from the error log.",
    checkDiskLock: "Check log to see whether there is a file locked by some process.",
    checkPathAccess: "Check log to see whether target path exists and you have write access to it.",
    checkSubscriptionId: "Check whether you choose the correct Azure subscription.",
    checkCredit: "Check Azure subscription credit.",
    checkLog: "Read log for more information.",
    recreateStorageAccount: "Remove your Azure Storage account instance and re-run provision.",
    dotnetVersionUpdate: "Install .NET Core 3.1 or 5.0.",
    checkPackageJson: "Check that package.json is valid.",
    checkCredential: "Check that you have logged in to Azure with the correct account.",
    doFullDeploy: `Remove ${FunctionPluginPathInfo.solutionFolderName}/${FunctionPluginPathInfo.funcDeploymentFolderName}.`,
    doScaffold: "Run 'Start a new project'.",
    doProvision: "Run 'Provision'."
};

export class FunctionPluginError extends Error {
    public code: string;
    public message: string;
    public suggestions: string[];
    public errorType: ErrorType;

    constructor (errorType: ErrorType, code: string, message: string, suggestions: string[]) {
        super(message);
        this.code = code;
        this.message = message;
        this.suggestions = [ tips.checkLog ].concat(suggestions);
        this.errorType = errorType;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }

    getMessage() {
        return `${this.message} Suggestions: ${this.suggestions.join("\n")}`;
    }
}

export class NoFunctionNameFromAnswerError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.System,
            "NoFunctionNameFromAnswer",
            "Failed to find function name.",
            [
                tips.reportIssue
            ]
        );
    }
}

export class FunctionNameConflictError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.User,
            "FunctionNameConflict",
            "Function already exists, please choose another name.",
            []
        );
    }
}

export class NotScaffoldError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.User,
            "NotScaffoldError",
            "Scaffold has not completed successfully.",
            [
                tips.doScaffold
            ]
        );
    }
}

export class NotProvisionError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.User,
            "NotProvisionError",
            "Provision has not completed successfully.",
            [
                tips.doProvision
            ]
        );
    }
}

export class FetchConfigError extends FunctionPluginError {
    constructor(key: string) {
        super(
            ErrorType.User,
            "FetchConfigError",
            `Failed to find ${key} from configuration.`,
            [
                tips.recoverTeamsfxConfigFiles,
                tips.recreateProject
            ]
        );
    }
}

export class ValidationError extends FunctionPluginError {
    constructor(key: string) {
        super(
            ErrorType.User,
            "FetchConfigError",
            `Invalid ${key}.`,
            [
                tips.recoverTeamsfxConfigFiles,
                tips.recreateProject
            ]
        );
    }
}

export class TemplateManifestNetworkError extends FunctionPluginError {
    constructor(url: string) {
        super(
            ErrorType.User,
            "TemplateManifestNetworkError",
            `Failed to retrieve template package list from ${url}.`,
            [
                tips.checkNetwork,
                tips.retryRequest
            ]
        );
    }
}

export class TemplateZipNetworkError extends FunctionPluginError {
    constructor(url: string) {
        super(
            ErrorType.User,
            "TemplateZipNetworkError",
            `Failed to download zip package from ${url}.`,
            [
                tips.checkNetwork,
                tips.retryRequest
            ]
        );
    }
}

export class TemplateZipFallbackError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.User,
            "TemplateZipFallbackError",
            "Failed to open local zip package.",
            [
                tips.checkNetwork,
                tips.retryRequest
            ]
        );
    }
}


export class BadTemplateManifestError extends FunctionPluginError {
    constructor(compose: string) {
        super(
            ErrorType.User,
            "BadTemplateManifestError",
            `Failed to find template for ${compose}.`,
            [
                tips.chooseAnotherCompose,
            ]
        );
    }
}

export class UnzipError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.User,
            "UnzipError",
            "Failed to unzip templates and write to disk.",
            [
                tips.checkDiskLock,
                tips.checkPathAccess
            ]
        );
    }
}

export class ProvisionError extends FunctionPluginError {
    constructor(resource: string) {
        super(
            ErrorType.User,
            "ProvisionError",
            `Failed to check/create '${resource}' for function app.`,
            [
                tips.checkSubscriptionId,
                tips.checkCredit,
                tips.checkNetwork,
                tips.retryRequest
            ]
        );
    }
}

export class GetConnectionStringError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.System,
            "GetConnectionStringError",
            "Failed to get connection string of Azure Storage account.",
            [
                tips.recreateStorageAccount,
                tips.checkNetwork,
                tips.retryRequest,
            ]
        );
    }
}

export class ConfigFunctionAppError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.System,
            "ConfigFunctionAppError",
            "Failed to retrieve function app settings.",
            [
                tips.checkSubscriptionId,
                tips.checkNetwork,
                tips.retryRequest,
                tips.reportIssue
            ]
        );
    }
}

export class FunctionAppOpError extends FunctionPluginError {
    constructor(op: string) {
        super(
            ErrorType.System,
            "RestartFunctionAppError",
            `Failed to execute '${op}' on the function app.`,
            [
                tips.checkNetwork,
                tips.retryRequest
            ]
        );
    }
}

export class DotnetVersionError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.User,
            "DotnetVersionError",
            "Failed to check .NET Core version.",
            [
                tips.dotnetVersionUpdate
            ]
        );
    }
}

export class InstallTeamsfxBindingError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.User,
            "InstallTeamsfxBindingError",
            "Failed to install Azure Functions bindings.",
            [
                tips.dotnetVersionUpdate
            ]
        );
    }
}

export class InstallNpmPackageError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.User,
            "InstallNpmPackageError",
            "Failed to install NPM packages.",
            [
                tips.checkPackageJson
            ]
        );
    }
}

export class InitAzureSDKError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.User,
            "InitAzureSDKError",
            "Failed to initialize Azure SDK Client.",
            [
                tips.checkCredential,
                tips.checkSubscriptionId
            ]
        );
    }
}

export class ZipError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.User,
            "ZipError",
            "Failed to generate zip package.",
            [
                tips.checkDiskLock,
                tips.checkPathAccess,
                tips.doFullDeploy
            ]
        );
    }
}

export class PublishCredentialError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.User,
            "PublishCredentialError",
            "Failed to retrieve publish credential.",
            [
                tips.checkCredential,
                tips.checkSubscriptionId,
                tips.checkNetwork,
                tips.retryRequest,
                tips.doProvision
            ]
        );
    }
}

export class UploadZipError extends FunctionPluginError {
    constructor() {
        super(
            ErrorType.System,
            "UploadZipError",
            "Failed to upload zip package.",
            [
                tips.checkNetwork,
                tips.retryRequest
            ]
        );
    }
}

export async function runWithErrorCatchAndThrow<T>(error: FunctionPluginError, fn: () => T | Promise<T>): Promise<T> {
    try {
        const res = await Promise.resolve(fn());
        return res;
    } catch(e) {
        if (e instanceof UserError || e instanceof SystemError) {
            throw e;
        }
        Logger.error(e.toString());
        throw error;
    }
}