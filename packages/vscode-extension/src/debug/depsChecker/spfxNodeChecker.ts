import { nodeNotFoundHelpLink, nodeNotSupportedForSPFxHelpLink } from "./common";
import { NodeChecker } from "./nodeChecker";

export class SPFxNodeChecker extends NodeChecker {
    protected readonly _nodeNotFoundHelpLink = nodeNotFoundHelpLink;
    protected readonly _nodeNotSupportedHelpLink = nodeNotSupportedForSPFxHelpLink;
    protected readonly _supportedVersions: string[] = ["10", "12", "14"];
}