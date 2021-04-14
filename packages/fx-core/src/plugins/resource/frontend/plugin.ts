// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { PluginContext, ok, Stage, NodeType, QTreeNode, FxError, Result } from "fx-api";
import path from "path";

import { AzureStorageClient } from "./clients";
import {
    CreateStorageAccountError,
    EnableStaticWebsiteError,
    GetTemplateError,
    NoResourceGroupError,
    NoStorageError,
    NotProvisionError,
    NotScaffoldError,
    StaticWebsiteDisabledError,
    UnzipTemplateError,
    runWithErrorCatchAndThrow,
} from "./resources/errors";
import {
    DependentPluginInfo,
    FrontendConfigInfo,
    FrontendPathInfo,
    FrontendPluginInfo,
    FrontendPluginInfo as PluginInfo,
} from "./constants";
import { FrontendConfig } from "./configs";
import { FrontendDeployment } from "./ops/deploy";
import { AADEnvironment, FrontendProvision, FunctionEnvironment, RuntimeEnvironment } from "./ops/provision";
import { Logger } from "./utils/logger";
import { Messages } from "./resources/messages";
import { FrontendScaffold as Scaffold, TemplateInfo } from "./ops/scaffold";
import { TeamsFxResult } from "./error-factory";
import { PreDeploySteps, ProgressHelper, ProvisionSteps, ScaffoldSteps } from "./utils/progress-helper";
import { tabScopeQuestion } from "./resources/questions";
import { ManifestVariables } from "./resources/tabScope";

export class FrontendPluginImpl {
    config?: FrontendConfig;
    azureStorageClient?: AzureStorageClient;

    private setConfigIfNotExists(ctx: PluginContext, key: string, value: string): void {
        if (ctx.config.get(key)) {
            return;
        }
        ctx.config.set(key, value);
    }

    public getQuestions(stage: Stage, ctx: PluginContext): Result<QTreeNode | undefined, FxError> {
        const res = new QTreeNode({
            type: NodeType.group
        });

        if (stage === Stage.create) {
            res.addChild(tabScopeQuestion);
        }

        return ok(res);
    }

    public async scaffold(ctx: PluginContext): Promise<TeamsFxResult> {
        Logger.info(Messages.StartScaffold(PluginInfo.DisplayName));
        const progressHandler = await ProgressHelper.startScaffoldProgressHandler(ctx);
        await progressHandler?.next(ScaffoldSteps.Scaffold);

        const templateInfo = new TemplateInfo();
        const functionPlugin = ctx.configOfOtherPlugins.get(DependentPluginInfo.FunctionPluginName);
        if (functionPlugin) {
            templateInfo.scenario = FrontendPluginInfo.TemplateWithFunctionScenario;
        }

        const zip = await runWithErrorCatchAndThrow(
            new GetTemplateError(),
            async () => await Scaffold.getTemplateZip(ctx, templateInfo),
        );
        await runWithErrorCatchAndThrow(
            new UnzipTemplateError(),
            async () => await Scaffold.scaffoldFromZip(zip, path.join(ctx.root, FrontendPathInfo.WorkingDir)),
        );

        await ProgressHelper.endScaffoldProgress();
        Logger.info(Messages.EndScaffold(PluginInfo.DisplayName));
        return ok(undefined);
    }

    public async preProvision(ctx: PluginContext): Promise<TeamsFxResult> {
        Logger.info(Messages.StartPreProvision(PluginInfo.DisplayName));

        this.config = await FrontendConfig.fromPluginContext(ctx);
        this.azureStorageClient = new AzureStorageClient(this.config);

        const resourceGroupExists: boolean = await this.azureStorageClient.doesResourceGroupExists();
        if (!resourceGroupExists) {
            throw new NoResourceGroupError();
        }

        Logger.info(Messages.EndPreProvision(PluginInfo.DisplayName));
        return ok(this.config);
    }

    public async provision(ctx: PluginContext): Promise<TeamsFxResult> {
        Logger.info(Messages.StartProvision(PluginInfo.DisplayName));
        const progressHandler = await ProgressHelper.startProvisionProgressHandler(ctx);

        const client = this.azureStorageClient;
        const storageName = this.config?.storageName;
        if (!storageName || !client) {
            throw new NotScaffoldError();
        }

        await progressHandler?.next(ProvisionSteps.CreateStorage);
        const endpoint = await runWithErrorCatchAndThrow(
            new CreateStorageAccountError(),
            async () => await client.createStorageAccount(),
        );

        await progressHandler?.next(ProvisionSteps.Configure);
        await runWithErrorCatchAndThrow(
            new EnableStaticWebsiteError(),
            async () => await client.enableStaticWebsite()
        );

        const hostname = new URL(endpoint).hostname;
        this.setConfigIfNotExists(ctx, FrontendConfigInfo.Endpoint, endpoint);
        this.setConfigIfNotExists(ctx, FrontendConfigInfo.Hostname, hostname);
        this.setConfigIfNotExists(ctx, FrontendConfigInfo.StorageName, storageName);

        await ProgressHelper.endProvisionProgress();
        Logger.info(Messages.EndProvision(PluginInfo.DisplayName));
        return ok(this.config);
    }

    public async postProvision(ctx: PluginContext): Promise<TeamsFxResult> {
        let functionEnv: FunctionEnvironment | undefined;
        let runtimeEnv: RuntimeEnvironment | undefined;
        let aadEnv: AADEnvironment | undefined;

        const functionPlugin = ctx.configOfOtherPlugins.get(DependentPluginInfo.FunctionPluginName);
        if (functionPlugin) {
            functionEnv = {
                defaultName: functionPlugin.get(DependentPluginInfo.FunctionDefaultName) as string,
                endpoint: functionPlugin.get(DependentPluginInfo.FunctionEndpoint) as string,
            };
        }

        const authPlugin = ctx.configOfOtherPlugins.get(DependentPluginInfo.RuntimePluginName);
        if (authPlugin) {
            runtimeEnv = {
                endpoint: authPlugin.get(DependentPluginInfo.RuntimeEndpoint) as string,
                startLoginPageUrl: DependentPluginInfo.StartLoginPageURL,
            };
        }

        const aadPlugin = ctx.configOfOtherPlugins.get(DependentPluginInfo.AADPluginName);
        if (aadPlugin) {
            aadEnv = {
                clientId: aadPlugin.get(DependentPluginInfo.ClientID) as string,
            };
        }

        if (functionEnv || runtimeEnv || aadEnv) {
            await FrontendProvision.setEnvironments(
                path.join(ctx.root, FrontendPathInfo.WorkingDir, FrontendPathInfo.TabEnvironmentFilePath),
                functionEnv,
                runtimeEnv,
                aadEnv,
            );
        }

        const variables: ManifestVariables = {
            baseUrl: ctx.config.get(FrontendConfigInfo.Endpoint) as string
        };

        FrontendProvision.setTabScope(ctx, variables);

        return ok(this.config);
    }

    public async preDeploy(ctx: PluginContext): Promise<TeamsFxResult> {
        Logger.info(Messages.StartPreDeploy(PluginInfo.DisplayName));
        const progressHandler = await ProgressHelper.createPreDeployProgressHandler(ctx);

        this.config = await FrontendConfig.fromPluginContext(ctx);
        this.azureStorageClient = new AzureStorageClient(this.config);

        await progressHandler?.next(PreDeploySteps.CheckStorage);

        const resourceGroupExists: boolean = await this.azureStorageClient.doesResourceGroupExists();
        if (!resourceGroupExists) {
            throw new NoResourceGroupError();
        }

        const storageExists: boolean = await this.azureStorageClient.doesStorageAccountExists();
        if (!storageExists) {
            throw new NoStorageError();
        }

        const storageAvailable: boolean | undefined = await this.azureStorageClient.isStorageStaticWebsiteEnabled();
        if (!storageAvailable) {
            throw new StaticWebsiteDisabledError();
        }

        ProgressHelper.endPreDeployProgress();
        Logger.info(Messages.EndPreDeploy(PluginInfo.DisplayName));
        return ok(this.config);
    }

    public async deploy(ctx: PluginContext): Promise<TeamsFxResult> {
        Logger.info(Messages.StartDeploy(PluginInfo.DisplayName));
        const progressHandler = await ProgressHelper.startDeployProgressHandler(ctx);

        const client = this.azureStorageClient;
        if (!client) {
            throw new NotProvisionError();
        }

        const componentPath: string = path.join(ctx.root, FrontendPathInfo.WorkingDir);

        await FrontendDeployment.doFrontendBuild(componentPath);
        await FrontendDeployment.doFrontendDeployment(client, componentPath);

        await ProgressHelper.endDeployProgress();
        Logger.info(Messages.EndDeploy(PluginInfo.DisplayName));
        return ok(this.config);
    }

    public async postDebug(ctx: PluginContext): Promise<TeamsFxResult> {
        Logger.info(Messages.StartPostDebug(PluginInfo.DisplayName));

        const localDebugPlugin = ctx.configOfOtherPlugins.get(DependentPluginInfo.LocalDebugPluginName);
        const localTabEndpoint = localDebugPlugin?.get(DependentPluginInfo.LocalTabEndpoint) as string;

        const variables: ManifestVariables = {
            baseUrl: localTabEndpoint
        };

        FrontendProvision.setTabScope(ctx, variables);

        return ok(this.config);
    }
}
