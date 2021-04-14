// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AccessToken, ManagedIdentityCredential, GetTokenOptions } from "@azure/identity";
import { assert, use as chaiUse, expect } from "chai";
import chaiPromises from "chai-as-promised";
import sinon from "sinon";
import mockedEnv from "mocked-env";
import {
  loadConfiguration,
  DefaultTediousConnectionConfiguration,
  ErrorCode,
  ErrorWithCode,
  setLogLevel,
  LogLevel
} from "../../../../src";

chaiUse(chaiPromises);
let restore: () => void;

describe("TediousSQLConectConfig - node", () => {
  // fake configuration for sql.
  const fakeSQLServerEndpoint = "xxx.database.windows.net";
  const fakeSQLUserName = "fake_name";
  const fakeSQLPassword = "fake_password";
  const fakeSQLIdentityId = "fake_identity_id";
  const fakeSQLDataName = "fake_data_name";
  const fakeToken = "fake_token";
  const defaultAuthenticationType = "default";
  const tokenAuthenticationType = "azure-active-directory-access-token";

  // error code.
  const INVALID_CONFIGURATION = "InvalidConfiguration";

  before(() => {
    setLogLevel(LogLevel.Verbose);
  });
  after(() => {
    setLogLevel(LogLevel.Info);
  });
  afterEach(function() {
    restore();
  });

  it("getConfig success with username and password", async function() {
    restore = mockedEnv({
      SQL_ENDPOINT: fakeSQLServerEndpoint,
      SQL_DATABASE: fakeSQLDataName,
      SQL_USER_NAME: fakeSQLUserName,
      SQL_PASSWORD: fakeSQLPassword
    });
    loadConfiguration();

    const sqlConnector = new DefaultTediousConnectionConfiguration();
    const tediousConnectConfig = await sqlConnector.getConfig();

    assert.isNotNull(tediousConnectConfig);
    assert.isNotNull(tediousConnectConfig.authentication);
    assert.strictEqual(tediousConnectConfig.authentication!.type, defaultAuthenticationType);
    assert.strictEqual(tediousConnectConfig.server, fakeSQLServerEndpoint);
    assert.strictEqual(tediousConnectConfig.authentication!.options.userName, fakeSQLUserName);
    assert.strictEqual(tediousConnectConfig.authentication!.options.password, fakeSQLPassword);
  });

  it("getConfig success with access token", async function() {
    restore = mockedEnv({
      SQL_ENDPOINT: fakeSQLServerEndpoint,
      SQL_DATABASE: fakeSQLDataName,
      IDENTITY_ID: fakeSQLIdentityId
    });
    loadConfiguration();

    const identityManager_GetToken = sinon.stub(ManagedIdentityCredential.prototype, "getToken");
    identityManager_GetToken.callsFake(
      async (scopes: string | string[], options?: GetTokenOptions) => {
        return new Promise<AccessToken>((resolve) => {
          resolve({
            token: fakeToken,
            expiresOnTimestamp: 12345678
          });
        });
      }
    );

    const sqlConnector = new DefaultTediousConnectionConfiguration();
    const tediousConnectConfig = await sqlConnector.getConfig();

    assert.isNotNull(tediousConnectConfig);
    assert.isNotNull(tediousConnectConfig.authentication);
    assert.strictEqual(tediousConnectConfig.authentication!.type, tokenAuthenticationType);
    assert.strictEqual(tediousConnectConfig.server, fakeSQLServerEndpoint);
    assert.strictEqual(tediousConnectConfig.authentication!.options.token, fakeToken);

    sinon.restore();
  });

  it("getConfig failed without host name", async function() {
    restore = mockedEnv({
      SQL_DATABASE: fakeSQLDataName,
      SQL_USER_NAME: fakeSQLUserName,
      SQL_PASSWORD: fakeSQLPassword
    });
    loadConfiguration();

    const sqlConnector = new DefaultTediousConnectionConfiguration();
    await expect(sqlConnector.getConfig())
      .to.eventually.be.rejectedWith(ErrorWithCode)
      .and.property("code", INVALID_CONFIGURATION);
  });

  it("getConfig fail without username, password or identity id", async function() {
    restore = mockedEnv({
      SQL_ENDPOINT: fakeSQLServerEndpoint,
      SQL_DATABASE: fakeSQLDataName
    });
    loadConfiguration();

    const sqlConnector = new DefaultTediousConnectionConfiguration();
    await expect(sqlConnector.getConfig())
      .to.eventually.be.rejectedWith(ErrorWithCode)
      .and.property("code", INVALID_CONFIGURATION);
  });
});
