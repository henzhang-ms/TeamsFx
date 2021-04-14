// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

"use strict";

import * as vscode from "vscode";
import { initializeExtensionVariables } from "./extensionVariables";
import * as handlers from "./handlers";
import { ExtTelemetry } from "./telemetry/extTelemetry";
import { TelemetryEvent, TelemetryProperty } from "./telemetry/extTelemetryEvents";
import { TeamsfxTaskProvider } from "./debug/teamsfxTaskProvider";
import { TeamsfxDebugProvider } from "./debug/teamsfxDebugProvider";

export async function activate(context: vscode.ExtensionContext) {
  console.log("Teams Toolkit v2 extension is now active!");

  // Init context
  initializeExtensionVariables(context);

  context.subscriptions.push(new ExtTelemetry.Reporter(context));

  // 1.1 Register the creating command.
  const createCmd = vscode.commands.registerCommand(
    "fx-extension.create",
    handlers.createNewProjectHandler
  );
  context.subscriptions.push(createCmd);

  // 1.2 Register the creating command.
  const updateCmd = vscode.commands.registerCommand(
    "fx-extension.update",
    handlers.updateProjectHandler
  );
  context.subscriptions.push(updateCmd);

  // add capability
  const addCapCmd = vscode.commands.registerCommand(
    "fx-extension.addCapability",
    handlers.addCapabilityHandler
  );
  context.subscriptions.push(addCapCmd);

  // 1.3 Register the provision command.
  const provisionCmd = vscode.commands.registerCommand(
    "fx-extension.provision",
    handlers.provisionHandler
  );
  context.subscriptions.push(provisionCmd);

  // 1.5 Register the deploy command.
  const deployCmd = vscode.commands.registerCommand(
    "fx-extension.deploy",
    handlers.deployHandler
  );
  context.subscriptions.push(deployCmd);

  const publishCmd = vscode.commands.registerCommand(
    "fx-extension.publish",
    handlers.publishHandler
  );
  context.subscriptions.push(publishCmd);

  // 1.6 update aad command
  const updateAadCmd = vscode.commands.registerCommand(
    "fx-extension.updateAad",
    handlers.updateAADHandler
  );
  context.subscriptions.push(updateAadCmd);

  // 1.7 validate dependencies command (hide from UI)
  const validateDependenciesCmd = vscode.commands.registerCommand(
    "fx-extension.validate-dependencies",
    handlers.validateDependenciesHandler
  );
  context.subscriptions.push(validateDependenciesCmd);

  // 1.8 pre debug check command (hide from UI)
  const preDebugCheckCmd = vscode.commands.registerCommand(
    "fx-extension.pre-debug-check",
    handlers.preDebugCheckHandler
  );
  context.subscriptions.push(preDebugCheckCmd);

  // 1.9 Register backend extensions install command (hide from UI)
  const backendExtensionsInstallCmd = vscode.commands.registerCommand(
    "fx-extension.backend-extensions-install",
    handlers.backendExtensionsInstallHandler
  );
  context.subscriptions.push(backendExtensionsInstallCmd);

  // 1.10 Register teamsfx task provider
  const taskProvider: TeamsfxTaskProvider = new TeamsfxTaskProvider();
  context.subscriptions.push(
    vscode.tasks.registerTaskProvider(TeamsfxTaskProvider.type, taskProvider)
  );

  const mailtoCmd = vscode.commands.registerCommand(
    "fx-extension.mailto",
    handlers.mailtoHandler
  );
  context.subscriptions.push(mailtoCmd);

  const devProgramCmd = vscode.commands.registerCommand(
    "fx-extension.devProgram",
    handlers.devProgramHandler
  );
  context.subscriptions.push(devProgramCmd);

  const openWelcomeCmd = vscode.commands.registerCommand(
    "fx-extension.openWelcome",
    handlers.openWelcomeHandler
  );
  context.subscriptions.push(openWelcomeCmd);

  const openSamplesCmd = vscode.commands.registerCommand(
    "fx-extension.openSamples",
    handlers.openSamplesHandler
  );
  context.subscriptions.push(openSamplesCmd);

  const openDocumentCmd = vscode.commands.registerCommand(
    "fx-extension.openDocument",
    handlers.openDocumentHandler
  );
  context.subscriptions.push(openDocumentCmd);

  const openManifestCmd = vscode.commands.registerCommand(
    "fx-extension.openManifest",
    handlers.openManifestHandler
  );
  context.subscriptions.push(openManifestCmd);

  const openAppManagementCmd = vscode.commands.registerCommand(
    "fx-extension.openAppManagement",
    handlers.openAppManagement
  );
  context.subscriptions.push(openAppManagementCmd);

  const openBotManagementCmd = vscode.commands.registerCommand(
    "fx-extension.openBotManagement",
    handlers.openBotManagement
  );
  context.subscriptions.push(openBotManagementCmd);

  const openReportIssuesCmd = vscode.commands.registerCommand(
    "fx-extension.openReportIssues",
    handlers.openReportIssues
  );
  context.subscriptions.push(openReportIssuesCmd);
  
  // Register debug configuration provider
  const debugProvider: TeamsfxDebugProvider = new TeamsfxDebugProvider();
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider("pwa-chrome", debugProvider)
  );
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider("chrome", debugProvider)
  );
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider("pwa-msedge", debugProvider)
  );
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider("msedge", debugProvider)
  );

  await handlers.cmdHdlLoadTreeView(context);
  // 2. Call activate function of toolkit core.
  await handlers.activate();

  // Trigger telemetry when start debug session
  const debug = vscode.debug.onDidStartDebugSession((e) => {
    ExtTelemetry.sendTelemetryEvent(TelemetryEvent.F5Start, {
      [TelemetryProperty.DebugSessionId]: e.id
    });
  });
  context.subscriptions.push(debug);
}

// this method is called when your extension is deactivated
export function deactivate() {
  handlers.cmdHdlDisposeTreeView();
}
