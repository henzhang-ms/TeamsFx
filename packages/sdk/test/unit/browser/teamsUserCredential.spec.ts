// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AccessToken, GetTokenOptions } from "@azure/core-auth";
import { assert, expect, use as chaiUse } from "chai";
import chaiPromises from "chai-as-promised";
import { loadConfiguration, TeamsUserCredential } from "../../../src";
import sinon from "sinon";
import { ErrorCode, ErrorMessage, ErrorWithCode } from "../../../src/core/errors";

chaiUse(chaiPromises);

describe("TeamsUserCredential - browser", () => {
  const token = "fake_access_token";
  const scopes = "fake_scope";
  const userId = "fake_user";
  const tenantId = "fake_tenant_id";
  const clientId = "fake_client_id";
  const loginUrl = "fake_login_url";
  const authEndpoint = "fake_auth_endpoint";

  /** Fake sso token payload
   * {
   *  "oid": "fake-oid",
   *  "name": "fake-name",
   *  "ver": "1.0",
   *  "upn": "fake-upn"
   *  }
   */
  const fakeSSOTokenV1 =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvaWQiOiJmYWtlLW9pZCIsIm5hbWUiOiJmYWtlLW5hbWUiLCJ2ZXIiOiIxLjAiLCJ1cG4iOiJmYWtlLXVwbiJ9.hztwdsbSQAYWthch_n2V21r4tIPBp22e6Xh_ATbOzWQ";

  /** Fake sso token v2 payload
   * {
   *  "oid": "fake-oid",
   *  "name": "fake-name",
   *  "ver": "2.0",
   *  "preferred_username": "fake-preferred_username"
   *  }
   */
  const fakeSSOTokenV2 =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvaWQiOiJmYWtlLW9pZCIsIm5hbWUiOiJmYWtlLW5hbWUiLCJ2ZXIiOiIyLjAiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJmYWtlLXByZWZlcnJlZF91c2VybmFtZSJ9.h8NmD0OZGWbyIuTanHoehLMDOhwxD17mp2-MKuLo4QI";

  /**
   * {
   * "oid": "fake-oid",
   *  "name": "fake-name",
   *  "ver": "1.0",
   *  "upn": "fake-upn",
   *  "tid": "fake-tid",
   *  "aud": "fake-aud"
     }
   */
  const fakeSSOTokenFull =
    "eyJhbGciOiJIUzI1NiJ9.eyJvaWQiOiJmYWtlLW9pZCIsIm5hbWUiOiJmYWtlLW5hbWUiLCJ2ZXIiOiIxLjAiLCJ1cG4iOiJmYWtlLXVwbiIsInRpZCI6ImZha2UtdGlkIiwiYXVkIjoiZmFrZS1hdWQifQ.1zHw8mK44l4iu1zlHvOGd6R7YZDBtEtmtDugpVZEyEA";

  const invalidSSOToken = "invalid-sso-token";

  const fakeAccessToken = "fake-access-token";

  function loadDefaultConfig() {
    loadConfiguration({
      authentication: {
        initiateLoginEndpoint: loginUrl,
        simpleAuthEndpoint: authEndpoint,
        clientId: clientId
      }
    });
  }

  it("token cache save and read cache", async function() {
    const expiresOnTimestamp: number = Date.now() + 10 * 60 * 1000;
    const accessToken: AccessToken = {
      token,
      expiresOnTimestamp
    };

    loadDefaultConfig();
    const credential: any = new TeamsUserCredential();

    const key = credential.getAccessTokenCacheKey(userId, clientId, tenantId, scopes);
    credential.setTokenCache(key, accessToken);
    const accessTokenFromCache = credential.getTokenCache(key);

    assert.isNotNull(accessTokenFromCache);
    if (accessTokenFromCache) {
      assert.strictEqual(accessTokenFromCache.token, accessToken.token);
      assert.strictEqual(accessTokenFromCache.expiresOnTimestamp, accessToken.expiresOnTimestamp);
    }
  });

  it("token cache read expired cache", async function() {
    const expiresOnTimestamp: number = Date.now();
    const accessToken: AccessToken = {
      token,
      expiresOnTimestamp
    };

    loadDefaultConfig();
    const credential: any = new TeamsUserCredential();

    const key = credential.getAccessTokenCacheKey(userId, clientId, tenantId, scopes);

    credential.setTokenCache(key, accessToken);

    const accessTokenFromCache = credential.getTokenCache(key);

    assert.isNotNull(accessTokenFromCache);
    if (accessTokenFromCache) {
      const isNearExpired = credential.isAccessTokenNearExpired(
        accessTokenFromCache.expiresOnTimestamp
      );
      assert.isTrue(isNearExpired);
    }
  });

  it("getUserInfo should throw exception when get SSO token failed", async function() {
    sinon.stub(TeamsUserCredential.prototype, <any>"getSSOToken").callsFake(
      (scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> => {
        throw new ErrorWithCode(
          "Get SSO token failed with error: failed to get sso token",
          ErrorCode.InternalError
        );
      }
    );

    loadDefaultConfig();
    const credential: TeamsUserCredential = new TeamsUserCredential();

    await expect(credential.getUserInfo())
      .to.eventually.be.rejectedWith(ErrorWithCode)
      .and.property("code", ErrorCode.InternalError);

    sinon.restore();
  });

  it("getUserInfo should throw exception when get empty SSO token", async function() {
    sinon.stub(TeamsUserCredential.prototype, <any>"getSSOToken").callsFake(
      (scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> => {
        throw new ErrorWithCode("SSO token is empty", ErrorCode.InternalError);
      }
    );

    loadDefaultConfig();
    const credential: TeamsUserCredential = new TeamsUserCredential();

    await expect(credential.getUserInfo())
      .to.eventually.be.rejectedWith(ErrorWithCode)
      .and.property("code", ErrorCode.InternalError);

    sinon.restore();
  });

  it("getUserInfo should throw exception when get invalid sso token", async function() {
    sinon.stub(TeamsUserCredential.prototype, <any>"getSSOToken").callsFake(
      (scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> => {
        return new Promise((resolve, reject) => {
          resolve({
            token: invalidSSOToken,
            expiresOnTimestamp: Date.now()
          });
        });
      }
    );

    loadDefaultConfig();
    const credential: TeamsUserCredential = new TeamsUserCredential();

    await expect(credential.getUserInfo())
      .to.eventually.be.rejectedWith(ErrorWithCode)
      .and.property("code", ErrorCode.InternalError);

    sinon.restore();
  });

  it("get user information", async function() {
    const TeamsUserCredentialStub_GetToken = sinon.stub(
      TeamsUserCredential.prototype,
      <any>"getSSOToken"
    );

    TeamsUserCredentialStub_GetToken.onCall(0).callsFake(
      (scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> => {
        const token: AccessToken = {
          token: fakeSSOTokenV1,
          expiresOnTimestamp: Date.now()
        };
        return new Promise((resolve, reject) => {
          resolve(token);
        });
      }
    );

    TeamsUserCredentialStub_GetToken.onCall(1).callsFake(
      (scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> => {
        const token: AccessToken = {
          token: fakeSSOTokenV2,
          expiresOnTimestamp: Date.now()
        };
        return new Promise((resolve, reject) => {
          resolve(token);
        });
      }
    );

    loadDefaultConfig();
    const credential: any = new TeamsUserCredential();

    const userInfo1 = await credential.getUserInfo();
    assert.strictEqual(userInfo1.displayName, "fake-name");
    assert.strictEqual(userInfo1.objectId, "fake-oid");
    assert.strictEqual(userInfo1.preferredUserName, "fake-upn");

    const userInfo2 = await credential.getUserInfo();
    assert.strictEqual(userInfo2.displayName, "fake-name");
    assert.strictEqual(userInfo2.objectId, "fake-oid");
    assert.strictEqual(userInfo2.preferredUserName, "fake-preferred_username");

    sinon.restore();
  });

  it("should throw error when configuration is not valid", async function() {
    loadConfiguration({
      authentication: undefined
    });

    expect(() => {
      new TeamsUserCredential();
    })
      .to.throw(ErrorWithCode, ErrorMessage.AuthenticationConfigurationNotExists)
      .with.property("code", ErrorCode.InvalidConfiguration);

    loadConfiguration({
      authentication: {
        simpleAuthEndpoint: authEndpoint
      }
    });

    expect(() => {
      new TeamsUserCredential();
    })
      .to.throw(
        ErrorWithCode,
        "initiateLoginEndpoint, clientId in configuration is invalid: undefined."
      )
      .with.property("code", ErrorCode.InvalidConfiguration);

    loadConfiguration({
      authentication: {
        initiateLoginEndpoint: loginUrl
      }
    });

    expect(() => {
      new TeamsUserCredential();
    })
      .to.throw(ErrorWithCode, "clientId in configuration is invalid: undefined.")
      .with.property("code", ErrorCode.InvalidConfiguration);
  });

  it("get SSO token", async function() {
    sinon.stub(TeamsUserCredential.prototype, <any>"getSSOToken").callsFake(
      (scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> => {
        const token: AccessToken = {
          token: fakeSSOTokenV1,
          expiresOnTimestamp: Date.now() + 10 * 1000 * 60
        };
        return new Promise((resolve, reject) => {
          resolve(token);
        });
      }
    );

    loadDefaultConfig();
    const credential = new TeamsUserCredential();
    const ssoToken = await credential.getToken("");
    assert.isNotNull(ssoToken);
    if (ssoToken) {
      assert.strictEqual(ssoToken.token, fakeSSOTokenV1);
    }

    sinon.restore();
  });

  it("get access token cache from local", async function() {
    sinon.stub(TeamsUserCredential.prototype, <any>"getSSOToken").callsFake(
      (scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> => {
        const token: AccessToken = {
          token: fakeSSOTokenFull,
          expiresOnTimestamp: Date.now() + 10 * 1000 * 60
        };
        return new Promise((resolve, reject) => {
          resolve(token);
        });
      }
    );

    loadDefaultConfig();
    const credential: any = new TeamsUserCredential();
    const scopeStr = "user.read";
    const cacheKey = await credential.getAccessTokenCacheKey(scopeStr);
    sinon
      .stub(TeamsUserCredential.prototype, <any>"getTokenCache")
      .callsFake((key: string): AccessToken | null => {
        if (key === cacheKey) {
          return {
            token: fakeAccessToken,
            expiresOnTimestamp: Date.now() + 10 * 60 * 1000
          };
        }

        return null;
      });

    const accessToken = await credential.getToken(scopeStr);
    assert.isNotNull(accessToken);
    if (accessToken) {
      assert.strictEqual(accessToken.token, fakeAccessToken);
    }

    sinon.restore();
  });

  it("get access token cache from remote server", async function() {
    sinon.stub(TeamsUserCredential.prototype, <any>"getSSOToken").callsFake(
      (scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> => {
        const token: AccessToken = {
          token: fakeSSOTokenFull,
          expiresOnTimestamp: Date.now() + 10 * 1000 * 60
        };
        return new Promise((resolve, reject) => {
          resolve(token);
        });
      }
    );

    loadDefaultConfig();
    const credential: any = new TeamsUserCredential();
    const scopeStr = "user.read";
    sinon
      .stub(TeamsUserCredential.prototype, <any>"getAndCacheAccessTokenFromSimpleAuthServer")
      .callsFake(
        async (scopesStr: string): Promise<AccessToken> => {
          return new Promise((resolve, reject) => {
            resolve({
              token: fakeAccessToken,
              expiresOnTimestamp: Date.now() + 10 * 60 * 1000
            });
          });
        }
      );

    const accessToken = await credential.getToken(scopeStr);

    assert.isNotNull(accessToken);
    if (accessToken) {
      assert.strictEqual(accessToken.token, fakeAccessToken);
    }

    sinon.restore();
  });

  it("should failed when get access token without login", async function() {
    sinon.stub(TeamsUserCredential.prototype, <any>"getSSOToken").callsFake(
      (scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> => {
        const token: AccessToken = {
          token: fakeSSOTokenFull,
          expiresOnTimestamp: Date.now() + 10 * 1000 * 60
        };
        return new Promise((resolve, reject) => {
          resolve(token);
        });
      }
    );

    loadDefaultConfig();
    const credential: any = new TeamsUserCredential();
    const scopeStr = "user.read";
    sinon
      .stub(TeamsUserCredential.prototype, <any>"getAndCacheAccessTokenFromSimpleAuthServer")
      .callsFake(
        async (scopesStr: string): Promise<AccessToken> => {
          throw new ErrorWithCode(
            `Failed to get access token cache from authentication server, please login first: you need login first before get access token`,
            ErrorCode.UiRequiredError
          );
        }
      );

    await expect(credential.getToken(scopeStr))
      .to.eventually.be.rejectedWith(ErrorWithCode)
      .and.property("code", ErrorCode.UiRequiredError);

    sinon.restore();
  });

  it("get access token after login", async function() {
    sinon.stub(TeamsUserCredential.prototype, <any>"getSSOToken").callsFake(
      (scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> => {
        const token: AccessToken = {
          token: fakeSSOTokenFull,
          expiresOnTimestamp: Date.now() + 10 * 1000 * 60
        };
        return new Promise((resolve, reject) => {
          resolve(token);
        });
      }
    );

    loadDefaultConfig();
    const credential: any = new TeamsUserCredential();
    const scopeStr = "user.read";

    sinon.stub(TeamsUserCredential.prototype, <any>"login").callsFake(
      async (scopes: string | string[]): Promise<void> => {
        const key = await credential.getAccessTokenCacheKey(scopeStr);
        credential.setTokenCache(key, {
          token: fakeAccessToken,
          expiresOnTimestamp: Date.now() + 10 * 1000 * 60
        });
      }
    );

    await credential.login(scopeStr);
    const accessToken = await credential.getToken(scopeStr);

    assert.isNotNull(accessToken);
    if (accessToken) {
      assert.strictEqual(accessToken.token, fakeAccessToken);
    }

    sinon.restore();
  });
});
