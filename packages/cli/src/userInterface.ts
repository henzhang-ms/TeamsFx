// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

"use strict";

import open from "open";

import {
  IMessage,
  MsgLevel,
  IQuestion,
  QuestionType,
  DialogMsg,
  DialogType,
  Dialog,
  IProgress,
  Result,
  FxError,
  IProgressStatus,
  IProgressHandler,
  ConfigMap,
  LogLevel,
} from "@microsoft/teamsfx-api";
import inquirer from "inquirer";
import CLILogProvider from "./commonlib/log";
import { ProgressHandler } from "./progressHandler";
import { NotSupportedQuestionType } from "./error";

export class DialogManager implements Dialog {
  private static instance: DialogManager;

  public static answers: ConfigMap;

  /**
   * Gets instance
   * @returns instance
   */
  public static getInstance(): DialogManager {
    if (!DialogManager.instance) {
      DialogManager.instance = new DialogManager();
    }

    return DialogManager.instance;
  }

  /**
   * CLI does the right thing according to the dialog message's type and return a dialog message.
   * // TODO: this may change to an error handling.
   * @param msg
   * @returns dialog msg
   */
  public async communicate(msg: DialogMsg): Promise<DialogMsg> {
    switch (msg.dialogType) {
      case DialogType.Ask: {
        const answer: string | undefined = await this.askQuestion(msg.content as IQuestion);
        return new DialogMsg(DialogType.Answer, answer);
      }
      case DialogType.Show: {
        const result = await this.showMessage(msg.content as IMessage);
        return new DialogMsg(DialogType.Answer, result);
      }
      case DialogType.Output: {
        this.showMessage(msg.content as IMessage);
        return new DialogMsg(DialogType.Show, {
          description: "Output successfully",
          level: MsgLevel.Info,
        });
      }
      case DialogType.ShowProgress: {
        const result = await this.showProgress(msg.content as IProgress);
        if (result.isErr()) {
          return new DialogMsg(DialogType.Show, {
            description: result.error.source,
            level: MsgLevel.Error,
          });
        }
        return new DialogMsg(DialogType.Show, {
          description: "Show Progress Successfully!",
          level: MsgLevel.Info,
        });
      }
      default: {
        return new DialogMsg(DialogType.Show, {
          description: "Wrong dialog Type",
          level: MsgLevel.Error,
        });
      }
    }
  }

  public createProgressBar(title: string, totalSteps: number): IProgressHandler {
    const handler = new ProgressHandler(title, totalSteps);
    return handler;
  }

  public presetAnswers(answers: ConfigMap) {
    DialogManager.answers = answers;
  }

  private async showProgress(prog: IProgress): Promise<Result<null, FxError>> {
    let currentStatus: IteratorResult<
      IProgressStatus,
      Result<null, FxError>
    > = await prog.progressIter.next();
    while (!currentStatus.done) {
      currentStatus = await prog.progressIter.next();
    }
    return currentStatus.value;
  }

  private static async askListQuestion(
    options: string[],
    questionDescription: string
  ): Promise<string | undefined> {
    const ciEnabled = process.env.CI_ENABLED;
    if (ciEnabled) {
      return options[0];
    }
    const questionName = "dialog_list_question";
    const answers = await inquirer.prompt([
      {
        name: questionName,
        type: "list",
        message: questionDescription,
        choices: options,
      },
    ]);
    if (questionName in answers) {
      return answers[questionName];
    } else {
      return undefined;
    }
  }

  private static async askConfirmQuestion(confirmOption: string, questionDescription: string) {
    const ciEnabled = process.env.CI_ENABLED;
    if (ciEnabled) {
      return confirmOption;
    }
    const answers = await inquirer.prompt([
      {
        name: QuestionType.Confirm,
        type: "confirm",
        message: questionDescription,
      },
    ]);
    if (answers[QuestionType.Confirm]) {
      return confirmOption;
    } else {
      return undefined;
    }
  }

  private async askQuestion(question: IQuestion): Promise<string | undefined> {
    if (question.description.includes("subscription")) {
      let sub: string;
      const subscriptions = question.options as string[];
      if (subscriptions.length === 0) {
        throw new Error(
          "Your Azure account has no active subscriptions. Please switch an Azure account."
        );
      } else if (subscriptions.length === 1) {
        sub = subscriptions[0];
        CLILogProvider.necessaryLog(
          LogLevel.Warning,
          `Your Azure account only has one subscription (${sub}). Use it as default.`
        );
      } else {
        const answers = await inquirer.prompt([
          {
            name: "subscription",
            type: "list",
            message: question.description,
            choices: subscriptions,
          },
        ]);
        sub = answers["subscription"];
      }

      return sub;
    }
    switch (question.type) {
      case QuestionType.Confirm:
        if (question.options && question.options.length === 1) {
          return await DialogManager.askConfirmQuestion(question.options[0], question.description);
        } else if (question.options && question.options.length > 1) {
          // Need to add "Cancel" option for confirm question.
          return await DialogManager.askListQuestion(
            question.options.concat("Cancel"),
            question.description
          );
        }
        break;
      case QuestionType.OpenExternal:
        open(question.description);
        return undefined;
      case QuestionType.OpenFolder:
        return undefined;
      /// TODO: remove this part of hard code
      case QuestionType.Text:
        break;
    }
    throw NotSupportedQuestionType(question);
  }

  private async showMessage(msg: IMessage): Promise<string | undefined> {
    if (msg.items && msg.items.length === 1) {
      return await DialogManager.askConfirmQuestion(msg.items[0], msg.description);
    } else if (msg.items && msg.items.length > 1) {
      // if modal, vsc will append "cancel" item so the plugin won't define "cancel" in dialog items.
      if (msg.modal) {
        return await DialogManager.askListQuestion(msg.items.concat("Cancel"), msg.description);
      } else {
        return await DialogManager.askListQuestion(msg.items, msg.description);
      }
    } else {
      switch (msg.level) {
        case MsgLevel.Info:
          CLILogProvider.necessaryLog(LogLevel.Info, msg.description);
          break;
        case MsgLevel.Warning:
          CLILogProvider.necessaryLog(LogLevel.Warning, msg.description);
          break;
        case MsgLevel.Error:
          CLILogProvider.necessaryLog(LogLevel.Error, msg.description);
          break;
      }
    }
    return "Show successfully";
  }
}

export default DialogManager.getInstance();
