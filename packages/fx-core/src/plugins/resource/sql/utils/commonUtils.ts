// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import jwtDecode from "jwt-decode";

export enum UserType {
    User = "User",
    ServicePrincipal = "ServicePrincipal",
}

export class TokenInfo {
    name: string;
    objectId: string;
    userType: UserType;

    constructor(name: string, objectId: string, userType: UserType) {
        this.name = name;
        this.objectId = objectId;
        this.userType = userType;
    }
}

export function parseToken(accessToken: string): TokenInfo {
    const jwt = jwtDecode(accessToken) as any;
    let authType: string;
    if (jwt.ver === "1.0") {
        authType = jwt.appidacr;
    } else if (jwt.ver === "2.0") {
        authType = jwt.azpacr;
    } else {
        throw new Error("invalide token");
    }

    if (authType === "0") {
        return new TokenInfo(jwt.name, jwt.oid, UserType.User);
    } else {
        return new TokenInfo(jwt.appid, jwt.oid, UserType.ServicePrincipal);
    }
}

export function formatEndpoint(endpoint: string): string {
    endpoint = endpoint.toLowerCase();
    endpoint = endpoint.replace(/[^a-z0-9-]/gi, "");
    if (endpoint[0] === "-") {
        endpoint = endpoint.slice(1);
    }
    return endpoint;
}