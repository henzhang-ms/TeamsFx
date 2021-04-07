import { IAADApplication, IAADPassword } from "./interfaces/IAADApplication";
import { IBotRegistration } from "./interfaces/IBotRegistration";

import { AxiosInstance, default as axios } from "axios";
import { ProvisionException } from "../exceptions";
import { CommonStrings } from "../resources/strings";


const baseUrl = "https://dev.teams.microsoft.com";
let axiosInstance: AxiosInstance | undefined = undefined;

export async function init(accessToken: string): Promise<boolean> {
    if (axiosInstance) {
        return true;
    }

    if (accessToken) {
        axiosInstance = axios.create({
            headers: {
                post: {
                    "Authorization": `Bearer ${accessToken}`
                }
            }
        });
        return true;
    } else {
        return false;
    }
}

export async function createAADApp(aadApp: IAADApplication): Promise<IAADApplication> {
    if (!aadApp || !axiosInstance) {
        throw new ProvisionException(CommonStrings.AAD_APP);
    }

    let response = undefined;
    try {
        response = await axiosInstance.post(`${baseUrl}/api/aadapp`, aadApp);
    } catch (e) {
        throw new ProvisionException(CommonStrings.AAD_APP, e);
    }

    if (!response || !response.data) {
        throw new ProvisionException(CommonStrings.AAD_APP);
    }

    const app = response.data as IAADApplication;
    if (!app || !app.id || !app.objectId) {
        throw new ProvisionException(CommonStrings.AAD_APP);
    }

    return app;
}

export async function createAADAppPassword(aadAppObjectId?: string): Promise<IAADPassword> {
    if (!aadAppObjectId || !axiosInstance) {
        throw new ProvisionException(CommonStrings.AAD_CLIENT_SECRET);
    }

    let response = undefined;
    try {
        response = await axiosInstance.post(`${baseUrl}/api/aadapp/${aadAppObjectId}/passwords`);
    } catch (e) {
        throw new ProvisionException(CommonStrings.AAD_CLIENT_SECRET, e);
    }

    if (!response || !response.data) {
        throw new ProvisionException(CommonStrings.AAD_CLIENT_SECRET);
    }

    const app = response.data as IAADPassword;
    if (!app) {
        throw new ProvisionException(CommonStrings.AAD_CLIENT_SECRET);
    }

    return app;
}

export async function createBotRegistration(registration: IBotRegistration): Promise<void> {

    if (!registration || !axiosInstance) {
        throw new ProvisionException(CommonStrings.APPSTUDIO_BOT_REGISTRATION);
    }

    let response = undefined;
    try {
        response = await axios.post(`${baseUrl}/api/botframework`, registration);
    } catch (e) {
        throw new ProvisionException(CommonStrings.APPSTUDIO_BOT_REGISTRATION, e);
    }

    if (!response || !response.data) {
        throw new ProvisionException(CommonStrings.APPSTUDIO_BOT_REGISTRATION);
    }

    return;
}
