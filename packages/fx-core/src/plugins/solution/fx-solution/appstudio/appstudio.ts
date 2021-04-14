/* eslint-disable @typescript-eslint/no-namespace */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { IBotRegistration, IAADApplication, IAADPassword, IAppDefinition } from "./interface";
import { TeamsAppManifest, ConfigMap, LogProvider, IBot, IComposeExtension } from "fx-api";
import { AzureSolutionQuestionNames, BotOptionItem, HostTypeOptionAzure, MessageExtensionItem } from "../question";
import { TEAMS_APP_MANIFEST_TEMPLATE } from "../constants";
import axios, { AxiosInstance } from "axios";

export namespace AppStudio {
    const baseUrl = "https://dev.teams.microsoft.com";

    // Creates a new axios instance to call app studio to prevent setting the accessToken
    // on global instance.
    function createRequesterWithToken(appStudioToken: string): AxiosInstance {
        const instance = axios.create({
            baseURL: baseUrl,
        });
        instance.defaults.headers.common["Authorization"] = `Bearer ${appStudioToken}`;
        return instance;
    }

    // Creates an app registration in app studio with the given configuration and returns the Teams app id.
    export async function createApp(
        appDefinition: IAppDefinition,
        appStudioToken: string,
        logProvider?: LogProvider,
    ): Promise<string | undefined> {
        if (appDefinition && appStudioToken) {
            try {
                const requester = createRequesterWithToken(appStudioToken);
                const response = await requester.post(`/api/appdefinitions/import`, appDefinition);
                if (response && response.data) {
                    const app = <IAppDefinition>response.data;
                    await logProvider?.debug(`recieved data from app studio ${JSON.stringify(app)}`);

                    if (app && app.teamsAppId) {
                        return app.teamsAppId;
                    }
                }
            } catch (e) {
                if (e instanceof Error) {
                    await logProvider?.warning(`failed to create app due to ${e.name}: ${e.message}`);
                }
                return undefined;
            }
        }

        await logProvider?.warning(`invalid appDefinition or appStudioToken`);
        return undefined;
    }

    // Updates an existing app if it exists with the configuration given.  Returns whether or not it was successful.
    export async function updateApp(
        teamsAppId: string,
        appDefinition: IAppDefinition,
        appStudioToken: string,
        logProvider?: LogProvider,
    ): Promise<boolean> {
        if (appDefinition && appStudioToken) {
            try {
                const requester = createRequesterWithToken(appStudioToken);
                const response = await requester.post(`/api/appdefinitions/${teamsAppId}`, appDefinition);
                if (response && response.data) {
                    const app = <IAppDefinition>response.data;

                    if (app && app.teamsAppId && app.teamsAppId === teamsAppId) {
                        return true;
                    } else {
                        await logProvider?.error(`teamsAppId mismatch. Input: ${teamsAppId}. Got: ${app.teamsAppId}`);
                    }
                }
            } catch (e) {
                if (e instanceof Error) {
                    await logProvider?.warning(`failed to create app due to ${e.name}: ${e.message}`);
                }
                return false;
            }
        }

        return false;
    }

    export async function createBotRegistration(
        registration: IBotRegistration,
        appStudioToken: string,
    ): Promise<boolean> {
        if (registration && appStudioToken) {
            try {
                const requester = createRequesterWithToken(appStudioToken);
                const response = await requester.post(`/api/botframework`, registration);
                if (response && response.data) {
                    return true;
                }
            } catch {
                return false;
            }
        }

        return false;
    }

    export async function updateBotRegistration(
        registration: IBotRegistration,
        appStudioToken: string,
    ): Promise<boolean> {
        if (registration && appStudioToken) {
            try {
                const requester = createRequesterWithToken(appStudioToken);
                const response = await requester.post(`/api/botframework/${registration.botId}`, registration);
                if (response && response.data) {
                    console.log(`Bot update succeed: ${response.data}`);
                    return true;
                }
            } catch (e) {
                console.log(`Bot update failed: ${e}`);
                return false;
            }
        }

        return false;
    }

    export async function createAADApp(
        aadApp: IAADApplication,
        appStudioToken: string,
    ): Promise<IAADApplication | undefined> {
        if (aadApp && appStudioToken) {
            try {
                const requester = createRequesterWithToken(appStudioToken);
                const response = await requester.post(`${baseUrl}/api/aadapp`, aadApp);
                if (response && response.data) {
                    const app = <IAADApplication>response.data;

                    if (app) {
                        return app;
                    }
                }
            } catch {
                return undefined;
            }
        }

        return undefined;
    }

    export async function createAADAppPassword(
        aadAppObjectId: string,
        appStudioToken: string,
    ): Promise<IAADPassword | undefined> {
        if (aadAppObjectId && appStudioToken) {
            try {
                const requester = createRequesterWithToken(appStudioToken);
                const response = await requester.post(`/api/aadapp/${aadAppObjectId}/passwords`);
                if (response && response.data) {
                    const app = <IAADPassword>response.data;

                    if (app) {
                        return app;
                    }
                }
            } catch {
                return undefined;
            }
        }

        return undefined;
    }

    /**
     * ask app common questions to generate app manifest
     */
    export async function createManifest(answers?: ConfigMap): Promise<TeamsAppManifest | undefined> {
        const type = answers?.getString(AzureSolutionQuestionNames.HostType);
        const capabilities = answers?.getStringArray(AzureSolutionQuestionNames.Capabilities);

        if (
            HostTypeOptionAzure.label === type ||
            capabilities?.includes(BotOptionItem.label) ||
            capabilities?.includes(MessageExtensionItem.label)
        ) {
            let manifestString = TEAMS_APP_MANIFEST_TEMPLATE;
            const appName = answers?.getString(AzureSolutionQuestionNames.AppName);
            if (appName) {
                manifestString = replaceConfigValue(manifestString, "appName", appName);
            }
            manifestString = replaceConfigValue(manifestString, "version", "1.0.0");
            const manifest: TeamsAppManifest = JSON.parse(manifestString);
            return manifest;
        }

        return undefined;
    }

    /**
     * Find and replace all id values in the manifest and replace
     * with another value.
     * @param config config file content
     * @param id Id to find and replace with a value
     * @param value Value to put in place of the id
     */
    function replaceConfigValue(config: string, id: string, value: string): string {
        if (config && id && value) {
            const idTag = `{${id}}`;
            while (config.includes(idTag)) {
                config = config.replace(idTag, value);
            }
        }

        return config;
    }

    export function getDevAppDefinition(
        manifest: string,
        appId: string,
        domains: string[],
        webApplicationInfoResource: string,
        tabEndpoint?: string,
        appName?: string,
        version?: string,
        bots?: string,
        composeExtensions?: string,
    ): [IAppDefinition, TeamsAppManifest] {
        if (appName) {
            manifest = replaceConfigValue(manifest, "appName", appName);
        }
        if (version) {
            manifest = replaceConfigValue(manifest, "version", version);
        }
        manifest = replaceConfigValue(manifest, "baseUrl", tabEndpoint ? tabEndpoint : "https://localhost:3000");
        manifest = replaceConfigValue(manifest, "appClientId", appId);
        manifest = replaceConfigValue(manifest, "appid", appId);
        manifest = replaceConfigValue(manifest, "webApplicationInfoResource", webApplicationInfoResource);

        const updatedManifest = JSON.parse(manifest) as TeamsAppManifest;

        if (bots) {
            updatedManifest.bots = JSON.parse(bots) as IBot[];
        }

        if (composeExtensions) {
            updatedManifest.composeExtensions = JSON.parse(composeExtensions) as IComposeExtension[];
        }

        for (const domain of domains) {
            updatedManifest.validDomains?.push(domain);
        }

        return [convertToAppDefinition(updatedManifest), updatedManifest];
    }

    export function convertToAppDefinition(appManifest: TeamsAppManifest): IAppDefinition {
        const appDefinition: IAppDefinition = {
            appName: appManifest.name.short,
            validDomains: appManifest.validDomains,
        };

        appDefinition.appName = appManifest.name.short;
        appDefinition.shortName = appManifest.name.short;
        appDefinition.version = appManifest.version;

        appDefinition.packageName = appManifest.packageName;
        appDefinition.websiteUrl = appManifest.developer.websiteUrl;
        appDefinition.privacyUrl = appManifest.developer.privacyUrl;
        appDefinition.termsOfUseUrl = appManifest.developer.termsOfUseUrl;

        appDefinition.shortDescription = appManifest.description.short;
        appDefinition.longDescription = appManifest.description.full;

        appDefinition.developerName = appManifest.developer.name;

        appDefinition.staticTabs = appManifest.staticTabs;
        appDefinition.configurableTabs = appManifest.configurableTabs;

        appDefinition.bots = appManifest.bots;
        appDefinition.messagingExtensions = appManifest.composeExtensions;

        if (appManifest.webApplicationInfo) {
            appDefinition.webApplicationInfoId = appManifest.webApplicationInfo.id;
            appDefinition.webApplicationInfoResource = appManifest.webApplicationInfo.resource;
        }

        return appDefinition;
    }
}
