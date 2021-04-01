// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { NodeType, Question, SingleSelectQuestion } from "teamsfx-api";

export enum CoreQuestionNames {
    AppName = "app-name",
    Foler = "folder",
    Solution = "solution",
    Stage = "stage",
    SubStage = "substage",
}

export const QuestionAppName: Question = {
    type: NodeType.text,
    name: CoreQuestionNames.AppName,
    title: "App Name",
    validation: {
        pattern: "^[\\da-zA-Z]+$",
    },
    default: "myapp",
};

export const QuestionRootFolder: Question = {
    type: NodeType.folder,
    name: CoreQuestionNames.Foler,
    title: "Select root folder of the project",
    validation: {
        namespace: "",
        method: "validateFolder",
    },
};

export const QuestionSelectSolution: SingleSelectQuestion = {
    type: NodeType.singleSelect,
    name: CoreQuestionNames.Solution,
    title: "Select a solution",
    option: [],
};