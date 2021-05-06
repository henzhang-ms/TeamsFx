// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as util from "util";
import commonlibLogger, { VsCodeLogProvider } from "../../commonlib/log";
import { OutputChannel } from "vscode";
import { LogLevel, ConfigFolderName } from "fx-api";
import { IDepsLogger } from "./checker";

const appendFile = util.promisify(fs.appendFile);

export class VSCodeLogger implements IDepsLogger {
  private static checkerLogFileName = "env-checker.log";
  private static globalConfigFolder = path.join(os.homedir(), `.${ConfigFolderName}`);

  public outputChannel: OutputChannel;
  private logger: VsCodeLogProvider;

  public constructor(logger: VsCodeLogProvider) {
    this.outputChannel = logger.outputChannel;
    this.logger = logger;

    fs.mkdirSync(VSCodeLogger.globalConfigFolder, { recursive: true });
  }

  async debug(message: string): Promise<boolean> {
    await this.writeLog(LogLevel.Debug, message);
    return true;
  }

  async info(message: string): Promise<boolean> {
    await this.writeLog(LogLevel.Info, message);
    return await this.logger.info(message);
  }

  async warning(message: string): Promise<boolean> {
    await this.writeLog(LogLevel.Warning, message);
    return await this.logger.warning(message);
  }

  async error(message: string): Promise<boolean> {
    await this.writeLog(LogLevel.Error, message);
    return await this.logger.error(message);
  }

  private async writeLog(level: LogLevel, message: string): Promise<void> {
    const line = `${LogLevel[level]} ${new Date().toISOString()}: ${message}` + os.EOL;
    const logFilePath = path.join(VSCodeLogger.globalConfigFolder, VSCodeLogger.checkerLogFileName);
    await appendFile(logFilePath, line);
  }
}

export const vscodeLogger = new VSCodeLogger(commonlibLogger);