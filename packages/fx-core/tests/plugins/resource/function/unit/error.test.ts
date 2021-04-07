// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import "mocha";
import { SystemError } from "fx-api";
import { UserError } from "fx-api";
import { expect } from "chai";

import { ErrorType, FunctionPluginError, runWithErrorCatchAndThrow } from "../../../../../src/plugins/resource/function/resources/errors";
import { FunctionPluginInfo } from "../../../../../src/plugins/resource/function/constants";

describe(FunctionPluginInfo.pluginName, async () => {
    describe("Error Catch Test", async () => {
        it("Test catch UserError", async () => {
            // Arrange
            const errorOld = new UserError("ut-name", "ut-msg", "ut-source");
            const errorNew = new FunctionPluginError(ErrorType.System, "ut-code", "ut-msg", []);
            // Act
            const res = runWithErrorCatchAndThrow(errorNew, () => new Promise((_, reject) => reject(errorOld)));

            // Assert
            expect(res).rejectedWith(errorOld);
        });

        it("Test catch SystemError", async () => {
            // Arrange
            const errorOld = new SystemError("ut-name", "ut-msg", "ut-source");
            const errorNew = new FunctionPluginError(ErrorType.System, "ut-code", "ut-msg", []);
            // Act
            const res = runWithErrorCatchAndThrow(errorNew, () => new Promise((_, reject) => reject(errorOld)));

            // Assert
            expect(res).rejectedWith(errorOld);
        });

        it("Test catch Error", async () => {
            // Arrange
            const errorOld = new Error("ut-name");
            const errorNew = new FunctionPluginError(ErrorType.System, "ut-code", "ut-msg", []);
            // Act
            const res = runWithErrorCatchAndThrow(errorNew, () => new Promise((_, reject) => reject(errorOld)));

            // Assert
            expect(res).rejectedWith(errorNew);
        });
    });
});