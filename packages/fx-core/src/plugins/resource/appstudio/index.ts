// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ConfigFolderName, FxError, NodeType, ok, Platform, Plugin, PluginContext, QTreeNode, Result, Stage } from "fx-api";
import { AppStudioPluginImpl } from "./plugin";
import { Constants } from "./constants";

export class AppStudioPlugin implements Plugin {
    private appStudioPluginImpl = new AppStudioPluginImpl();

    async getQuestions(
        stage: Stage,
        ctx: PluginContext
    ): Promise<Result<QTreeNode | undefined, FxError>> {
        const appStudioQuestions = new QTreeNode({
            type: NodeType.group
        });

        if (stage === Stage.publish) {
            if (ctx.platform !== Platform.VSCode) {
                const appPath = new QTreeNode({
                    type: NodeType.folder,
                    name: Constants.PUBLISH_PATH_QUESTION,
                    title: "Please select the folder contains manifest.json and icons",
                    default: `${ctx.root}/.${ConfigFolderName}`,
                    validation: {
                        required: true,
                    },
                });
                appStudioQuestions.addChild(appPath);

                const remoteTeamsAppId = new QTreeNode({
                    type: NodeType.text,
                    name: Constants.REMOTE_TEAMS_APP_ID,
                    title: "Please input the teams app id in App Studio"
                });
                appStudioQuestions.addChild(remoteTeamsAppId);
            }
        }

        return ok(appStudioQuestions);
    }
    
    /**
     * Validate manifest string against schema
     * @param {string} manifestString - the string of manifest.json file
     * @returns {string[]} an array of errors
     */
    public async validateManifest(ctx: PluginContext, manifestString: string): Promise<Result<string[], FxError>> {
        const validationResult = await this.appStudioPluginImpl.validateManifest(ctx, manifestString);
        return ok(validationResult);
    }

    /**
     * Build Teams Package
     * @param {string} appDirectory - The directory contains manifest.remote.json and two images
     * @returns {string} - Path of built appPackage.zip
     */
    public async buildTeamsPackage(appDirectory: string, manifestString: string): Promise<Result<string, FxError>> {
        const appPackagePath = await this.appStudioPluginImpl.buildTeamsAppPackage(appDirectory, manifestString);
        return ok(appPackagePath);
    }

    /**
     * Publish the app to Teams App Catalog
     * @param {PluginContext} ctx
     * @returns {string[]} - Teams App ID in Teams app catalog
     */
    public async publish(ctx: PluginContext): Promise<Result<string, FxError>> {
        const teamsAppId = await this.appStudioPluginImpl.publish(ctx);
        return ok(teamsAppId);
    }
}