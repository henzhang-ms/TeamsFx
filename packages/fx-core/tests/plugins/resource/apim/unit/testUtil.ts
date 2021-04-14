// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { TokenCredentialsBase } from "@azure/ms-rest-nodeauth";
import {
    Dialog,
    DialogMsg,
    AzureAccountProvider,
    GraphTokenProvider,
    PluginContext,
    ConfigMap,
    TeamsAppManifest,
    IProgressHandler,
    OptionItem,
} from "fx-api";
import { BuildError, NotImplemented } from "../../../../../src/plugins/resource/apim/src/error";
import { TokenCredential } from "@azure/core-auth";
import { AsyncFunc, Func } from "mocha";
import * as msRestNodeAuth from "@azure/ms-rest-nodeauth";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { AssertNotEmpty } from "../../../../../src/plugins/resource/apim/src/error";
import {
    IAadPluginConfig,
    IFunctionPluginConfig,
    ISolutionConfig,
} from "../../../../../src/plugins/resource/apim/src/model/config";
import { TeamsToolkitComponent } from "../../../../../src/plugins/resource/apim/src/constants";

export class MockAzureAccountProvider implements AzureAccountProvider {
    setStatusChangeCallback(
        statusChange: (status: string, token?: string, accountInfo?: Record<string, unknown>) => Promise<void>
    ): Promise<boolean> {
        throw BuildError(NotImplemented);
    }
    signout(): Promise<boolean> {
        throw BuildError(NotImplemented);
    }

    private credentials: TokenCredentialsBase | undefined;

    async login(clientId: string, secret: string, tenantId: string): Promise<void> {
        this.credentials = await msRestNodeAuth.loginWithServicePrincipalSecretWithAuthResponse(clientId, secret, tenantId).then((authres) => {
            return authres.credentials;
        });
    }

    async getAccountCredentialAsync(): Promise<TokenCredentialsBase | undefined> {
        return this.credentials;
    }

    getIdentityCredentialAsync(): Promise<TokenCredential | undefined> {
        throw BuildError(NotImplemented);
    }

    getAccountCredential(): TokenCredentialsBase | undefined {
        return this.credentials;
    }

    getIdentityCredential(): TokenCredential | undefined {
        throw BuildError(NotImplemented);
    }
}

export class MockGraphTokenProvider implements GraphTokenProvider {
    private readonly clientId: string;
    private readonly tenantId: string;
    private readonly clientSecret: string;

    constructor(tenantId: string, clientId: string, clientSecret: string) {
        this.tenantId = tenantId;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }
    getJsonObject(showDialog?: boolean): Promise<Record<string, unknown>> {
        throw BuildError(NotImplemented);
    }
    setStatusChangeCallback(
        statusChange: (status: string, token?: string, accountInfo?: Record<string, unknown>) => Promise<void>
    ): Promise<boolean> {
        throw BuildError(NotImplemented);
    }
    signout(): Promise<boolean> {
        throw BuildError(NotImplemented);
    }

    async getAccessToken(): Promise<string> {
        const config = {
            auth: {
                clientId: this.clientId,
                authority: `https://login.microsoftonline.com/${this.tenantId}`,
                clientSecret: this.clientSecret,
            },
        };

        const clientCredentialRequest = {
            scopes: ["https://graph.microsoft.com/.default"], // replace with your resource
        };

        const cca = new ConfidentialClientApplication(config);
        const credential = await cca.acquireTokenByClientCredential(clientCredentialRequest);
        return AssertNotEmpty("accessToken", credential?.accessToken);
    }
}

export class MockPluginContext implements PluginContext {
    configOfOtherPlugins: Map<string, Map<string, string>>;
    config: ConfigMap;
    app: Readonly<TeamsAppManifest> = {
        manifestVersion: "",
        version: "",
        id: "",
        developer: {
            name: "",
            websiteUrl: "",
            privacyUrl: "",
            termsOfUseUrl: "",
        },
        name: {
            short: "",
        },
        description: {
            short: "",
        },
        icons: {
            color: "",
            outline: "",
        },
        accentColor: "",
    };
    root = "./test/scaffold";
    azureAccountProvider: MockAzureAccountProvider;
    graphTokenProvider: MockGraphTokenProvider;
    answers: ConfigMap | undefined;

    private clientId: string;
    private clientSecret: string;
    private tenantId: string;

    constructor(
        appName: string,
        tenantId: string,
        clientId: string,
        clientSecret: string,
        solutionConfig: ISolutionConfig,
        aadConfig?: IAadPluginConfig,
        functionConfig?: IFunctionPluginConfig,
        answers?: { [key: string]: OptionItem | string }
    ) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.tenantId = tenantId;
        this.graphTokenProvider = new MockGraphTokenProvider(tenantId, clientId, clientSecret);
        this.azureAccountProvider = new MockAzureAccountProvider();
        this.config = new ConfigMap();
        this.configOfOtherPlugins = new Map<string, Map<string, string>>();
        this.configOfOtherPlugins.set(TeamsToolkitComponent.Solution, new Map(Object.entries(solutionConfig)));
        this.app.name.short = appName;

        if (aadConfig) {
            this.configOfOtherPlugins.set(TeamsToolkitComponent.AadPlugin, new Map(Object.entries(aadConfig)));
        }

        if (functionConfig) {
            this.configOfOtherPlugins.set(TeamsToolkitComponent.FunctionPlugin, new Map(Object.entries(functionConfig)));
        }

        if (answers) {
            this.answers = new ConfigMap(Object.entries(answers));
        }
    }

    async init(): Promise<void> {
        await this.azureAccountProvider.login(this.clientId, this.clientSecret, this.tenantId);
    }
}

export function skip_if(condition: boolean, name: string, callback: Func | AsyncFunc): void {
    const fn = condition ? it.skip : it;
    fn(name, callback);
}
