// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import * as fs from "fs-extra";
import * as os from "os";
import {
    AzureAccountProvider,
    ConfigMap,
    Context,
    Core,
    Dialog,
    DialogMsg,
    DialogType,
    err,
    Func,
    GraphTokenProvider,
    LogProvider,
    NodeType,
    ok,
    Platform,
    QTreeNode,
    QuestionType,
    Result,
    returnSystemError,
    Solution,
    SolutionConfig,
    SolutionContext,
    Stage,
    TeamsAppManifest,
    TelemetryReporter,
    AppStudioTokenProvider,
    TreeProvider,
    returnUserError,
    SystemError,
    UserError,
    SingleSelectQuestion,
    StringValidation,
    FxError,
    ProductName,
} from "teamsfx-api";
import * as path from "path";
// import * as Bundles from '../resource/bundles.json';
import * as error from "./error";
import { Loader, Meta } from "./loader";
import { mapToJson, objectToConfigMap, objectToMap } from "./tools";
import { VscodeManager } from "./vscodeManager";
import { Settings } from "./settings";
import { CoreQuestionNames, QuestionAppName, QuestionRootFolder, QuestionSelectSolution } from "./question";
import * as jsonschema from "jsonschema";

class CoreImpl implements Core {
    private target?: CoreImpl;

    private app: TeamsAppManifest;

    private configs: Map<string, SolutionConfig>;
    private env: string;

    /*
     * Context will hold necessary info for the whole process for developing a Teams APP.
     */
    ctx: Context;

    private globalSolutions: Map<string, Solution & Meta>;
    private globalFxFolder: string;

    private selectedSolution?: Solution & Meta;

    private globalConfig?: ConfigMap;

    /**
     * constructor will be private to make it singleton.
     */
    constructor() {
        this.globalSolutions = new Map();

        this.app = new TeamsAppManifest();
        this.env = "default";
        this.configs = new Map();
        this.configs.set(this.env, new Map());

        this.ctx = {
            root: os.homedir() + "/teams_app/",
        };  
        this.globalFxFolder = os.homedir() + `/.${ProductName}/`;
    }

    async localDebug(answers?: ConfigMap): Promise<Result<null, FxError>> {
        const result = await this.selectedSolution!.localDebug(this.solutionContext(answers));
        return result;
    }

    /**
     * by huajie
     * @param stage
     */
    async getQuestions(stage: Stage, platform: Platform): Promise<Result<QTreeNode | undefined, FxError>> {
        this.ctx.platform = platform;
        const answers = new ConfigMap();
        answers.set("stage", stage);
        answers.set("substage", "getQuestions");
        const node = new QTreeNode({ type: NodeType.group });
        if (stage === Stage.create) {
            node.addChild(new QTreeNode(QuestionAppName));

            //make sure that global solutions are loaded
            const solutionNames: string[] = [];
            for (const k of this.globalSolutions.keys()) {
                solutionNames.push(k);
            }
            const selectSolution: SingleSelectQuestion = QuestionSelectSolution;
            selectSolution.option = solutionNames;
            const select_solution = new QTreeNode(selectSolution);
            node.addChild(select_solution);

            for (const [k, v] of this.globalSolutions) {
                if (v.getQuestions) {
                    const res = await v.getQuestions(stage, this.solutionContext(answers));
                    if (res.isErr()) return res;
                    const solutionNode = res.value as QTreeNode;
                    solutionNode.condition = { equals: k };
                    if (solutionNode.data) select_solution.addChild(solutionNode);
                }
            }
            node.addChild(new QTreeNode(QuestionRootFolder));
        } else if (this.selectedSolution) {
            const res = await this.selectedSolution.getQuestions(stage, this.solutionContext(answers));
            if (res.isErr()) return res;
            const child = res.value as QTreeNode;
            if (child.data) node.addChild(child);
        }
        return ok(node);
    }

    async getQuestionsForUserTask(func: Func, platform: Platform): Promise<Result<QTreeNode | undefined, FxError>> {
        const namespace = func.namespace;
        const array = namespace.split("/");
        if ("" !== namespace && array.length > 0) {
            const solutionName = array[0];
            const solution = this.globalSolutions.get(solutionName);
            if (solution && solution.getQuestionsForUserTask) {
                const solutioContext = this.solutionContext();
                return await solution.getQuestionsForUserTask(func, solutioContext);
            }
        }
        return err(
            returnUserError(
                new Error(`getQuestionsForUserTaskRouteFailed:${JSON.stringify(func)}`),
                error.CoreSource,
                error.CoreErrorNames.getQuestionsForUserTaskRouteFailed,
            ),
        );
    }
    async executeUserTask(func: Func, answer?: ConfigMap): Promise<Result<QTreeNode | undefined, FxError>> {
        const namespace = func.namespace;
        const array = namespace.split("/");
        if ("" !== namespace && array.length > 0) {
            const solutionName = array[0];
            const solution = this.globalSolutions.get(solutionName);
            if (solution && solution.executeUserTask) {
                const solutioContext = this.solutionContext(answer);
                return await solution.executeUserTask(func, solutioContext);
            }
        }
        return err(
            returnUserError(
                new Error(`executeUserTaskRouteFailed:${JSON.stringify(func)}`),
                error.CoreSource,
                error.CoreErrorNames.executeUserTaskRouteFailed,
            ),
        );
    }

    async validateFolder(folder: string, answer?: ConfigMap): Promise<Result<any, FxError>> {
        const appName = answer?.getString(CoreQuestionNames.AppName);
        if (!appName) return ok(undefined);
        const projectPath = path.resolve(folder, appName);
        const exists = await fs.pathExists(projectPath);
        if (exists) return ok(`Project folder already exists:${projectPath}, please change a different folder.`);
        return ok(undefined);
    }

    async callFunc(func: Func, answer?: ConfigMap): Promise<Result<any, FxError>> {
        const namespace = func.namespace;
        const array = namespace.split("/");
        if ("" === namespace || array.length === 0) {
            if (func.method === "validateFolder") {
                if (!func.params || !func.params[0]) return ok(undefined);
                return await this.validateFolder(func.params![0] as string, answer);
            }
        } else {
            const solutionName = array[0];
            const solution = this.globalSolutions.get(solutionName);
            if (solution && solution.callFunc) {
                const solutioContext = this.solutionContext(answer);
                return await solution.callFunc(func, solutioContext);
            }
        }
        return err(
            returnUserError(
                new Error(`CallFuncRouteFailed:${JSON.stringify(func)}`),
                error.CoreSource,
                error.CoreErrorNames.CallFuncRouteFailed,
            ),
        );
    }

    /**
     * create
     */
    public async create(answers?: ConfigMap): Promise<Result<null, FxError>> {
        if (!this.ctx.dialog) {
            return err(error.InvalidContext());
        }
        this.ctx.logProvider?.info(`[Core] create - create target object`);
        this.target = new CoreImpl();
        this.target.ctx.dialog = this.ctx.dialog;
        this.target.ctx.azureAccountProvider = this.ctx.azureAccountProvider;
        this.target.ctx.graphTokenProvider = this.ctx.graphTokenProvider;
        this.target.ctx.telemetryReporter = this.ctx.telemetryReporter;
        this.target.ctx.logProvider = this.ctx.logProvider;
        this.target.ctx.platform = this.ctx.platform;
        this.target.ctx.answers = answers;

        const appName = answers?.getString(QuestionAppName.name);
        const validateResult = jsonschema.validate(appName, {
            pattern: (QuestionAppName.validation as StringValidation).pattern,
        });
        if (validateResult.errors && validateResult.errors.length > 0) {
            return err(
                new UserError(
                    error.CoreErrorNames.InvalidInput,
                    `${validateResult.errors[0].message}`,
                    error.CoreSource,
                ),
            );
        }
        const folder = answers?.getString(QuestionRootFolder.name);

        const projFolder = path.resolve(`${folder}/${appName}`);
        const folderExist = await fs.pathExists(projFolder);
        if (folderExist) {
            return err(
                new UserError(
                    error.CoreErrorNames.ProjectFolderExist,
                    `Project folder exsits:${projFolder}`,
                    error.CoreSource,
                ),
            );
        }
        this.target.ctx.root = projFolder;

        const solutionName = answers?.getString(QuestionSelectSolution.name);
        this.ctx.logProvider?.info(`[Core] create - select solution`);
        for (const s of this.globalSolutions.values()) {
            if (s.name === solutionName) {
                this.target.selectedSolution = s;
                break;
            }
        }

        const targetFolder = path.resolve(this.target.ctx.root);

        await fs.ensureDir(targetFolder);
        await fs.ensureDir(`${targetFolder}/.${ProductName}`);

        this.ctx.logProvider?.info(`[Core] create - call solution.create()`);
        const result = await this.target.selectedSolution!.create(this.target.solutionContext(answers));
        if (result.isErr()) {
            this.ctx.logProvider?.info(`[Core] create - call solution.create() failed!`);
            return result;
        }
        this.ctx.logProvider?.info(`[Core] create - call solution.create() success!`);

        const createResult = await this.createBasicFolderStructure(answers);
        if (createResult.isErr()) {
            return createResult;
        }

        // await this.writeAnswersToFile(targetFolder, answers);

        // await this.target.writeConfigs();

        this.ctx.logProvider?.info(`[Core] create - create basic folder with configs`);

        this.ctx.logProvider?.info(`[Core] scaffold start!`);
        const scaffoldRes = await this.target.scaffold(answers);

        if (scaffoldRes.isErr()) {
            this.ctx.logProvider?.info(`[Core] scaffold failed!`);
            return scaffoldRes;
        }

        await this.target.writeConfigs();

        this.ctx.logProvider?.info(`[Core] scaffold success! open target folder:${targetFolder}`);

        await this.ctx.dialog?.communicate(
            new DialogMsg(DialogType.Ask, {
                type: QuestionType.OpenFolder,
                description: targetFolder,
            }),
        );

        return ok(null);
    }

    public async update(answers?: ConfigMap): Promise<Result<null, FxError>> {
        return await this.selectedSolution!.update(this.solutionContext(answers));
    }

    /**
     * open an existing project
     */
    public async open(workspace?: string): Promise<Result<null, FxError>> {
        if (!workspace) {
            return ok(null);
        }

        this.ctx.root = workspace;

        const supported = await this.isSupported();
        if (!supported) {
            this.ctx.logProvider?.warning(`non Teams project:${workspace}`);
            return ok(null);
        }

        // update selectedSolution
        const result = await Loader.loadSelectSolution(this.ctx, this.ctx.root);

        if (result.isErr()) {
            return err(result.error);
        }

        for (const entry of this.globalSolutions.entries()) {
            if (entry[0] === result.value.name) {
                this.selectedSolution = entry[1];
                break;
            }
        }

        if (this.selectedSolution === undefined) {
            return ok(null);
        }

        this.env = "default";

        const readRes = await this.readConfigs();
        if (readRes.isErr()) {
            return readRes;
        }

        return await this.selectedSolution.open(this.solutionContext());
    }

    public async isSupported(workspace?: string): Promise<boolean> {
        let p = this.ctx.root;
        if (workspace) {
            p = workspace;
        }
        // some validation
        const checklist: string[] = [
            p,
            `${p}/package.json`,
            `${p}/.${ProductName}`,
            `${p}/.${ProductName}/settings.json`,
            `${p}/.${ProductName}/env.default.json`,
        ];
        for (const fp of checklist) {
            if (!(await fs.pathExists(path.resolve(fp)))) {
                return false;
            }
        }
        return true;
    }

    public async readConfigs(): Promise<Result<null, FxError>> {
        if (!fs.existsSync(`${this.ctx.root}/.${ProductName}`)) {
            this.ctx.logProvider?.warning(`[Core] readConfigs() silent pass, folder not exist:${this.ctx.root}/.${ProductName}`);
            return ok(null);
        }
        try {
            // load env
            const reg = /env\.(\w+)\.json/;
            for (const file of fs.readdirSync(`${this.ctx.root}/.${ProductName}`)) {
                const slice = reg.exec(file);
                if (!slice) {
                    continue;
                }
                const filePath = `${this.ctx.root}/.${ProductName}/${file}`;
                this.ctx.logProvider?.info(`[Core] read config file:${filePath} start ... `);
                const config: SolutionConfig = await fs.readJson(filePath);
                this.configs.set(slice[1], objectToMap(config));
                this.ctx.logProvider?.info(`[Core] read config file:${filePath} success! `);
            }

            // read answers
            this.ctx.answers = await this.readAnswersFromFile(this.ctx.root);
        } catch (e) {
            return err(error.ReadFileError(e));
        }
        return ok(null);
    }

    public async writeConfigs(): Promise<Result<null, FxError>> {
        if (!fs.existsSync(`${this.ctx.root}/.${ProductName}`)) {
            this.ctx.logProvider?.warning(`[Core] writeConfigs() silent pass, folder not exist:${this.ctx.root}/.${ProductName}`);
            return ok(null);
        }
        try {
            for (const entry of this.configs.entries()) {
                const filePath = `${this.ctx.root}/.${ProductName}/env.${entry[0]}.json`;
                this.ctx.logProvider?.info(`[Core] write config file:${filePath} start ... `);
                const content = JSON.stringify(mapToJson(entry[1]), null, 4);
                await fs.writeFile(filePath, content);
                this.ctx.logProvider?.info(`[Core] write config file:${filePath} success! content: \n${content}`);
            }
            await this.writeAnswersToFile(this.ctx.root, this.ctx.answers);
        } catch (e) {
            return err(error.WriteFileError(e));
        }
        return ok(null);
    }

    /**
     * provision
     */
    public async provision(answers?: ConfigMap): Promise<Result<null, FxError>> {
        return await this.selectedSolution!.provision(this.solutionContext(answers));
    }

    /**
     * deploy
     */
    public async deploy(answers?: ConfigMap): Promise<Result<null, FxError>> {
        return await this.selectedSolution!.deploy(this.solutionContext(answers));
    }

    /**
     * publish app
     */
    public async publish(): Promise<Result<null, FxError>> {
        return ok(null);
    }

    /**
     * create an environment
     */
    public async createEnv(env: string): Promise<Result<null, FxError>> {
        if (this.configs.has(env)) {
            return err(error.EnvAlreadyExist(env));
        } else {
            this.configs.set(env, new Map());
        }
        return ok(null);
    }

    /**
     * remove an environment
     */
    public async removeEnv(env: string): Promise<Result<null, FxError>> {
        if (!this.configs.has(env)) {
            return err(error.EnvNotExist(env));
        } else {
            this.configs.delete(env);
        }
        return ok(null);
    }

    /**
     * switch environment
     */
    public async switchEnv(env: string): Promise<Result<null, FxError>> {
        if (this.configs.has(env)) {
            this.env = env;
        } else {
            return err(error.EnvNotExist(env));
        }
        return ok(null);
    }

    /**
     * switch environment
     */
    public async listEnvs(): Promise<Result<string[], FxError>> {
        return ok(Array.from(this.configs.keys()));
    }

    private async readAnswersFromFile(projectFolder: string): Promise<ConfigMap | undefined> {
        const file = `${projectFolder}/.${ProductName}/answers.json`;
        const exist = await fs.pathExists(file);
        if (!exist) return undefined;
        this.ctx.logProvider?.info(`[Core] read answer file:${file} start ... `);
        const answersObj: any = await fs.readJSON(file);
        const answers = objectToConfigMap(answersObj) as ConfigMap;
        this.ctx.logProvider?.info(`[Core] read answer file:${file} success! `);
        return answers;
    }

    private async writeAnswersToFile(projectFolder: string, answers?: ConfigMap): Promise<void> {
        const file = `${projectFolder}/.${ProductName}/answers.json`;
        const answerObj = answers ? mapToJson(answers as Map<any, any>) : {};
        this.ctx.logProvider?.info(`[Core] write answers file:${file} start ... `);
        await fs.writeFile(file, JSON.stringify(answerObj, null, 4));
        this.ctx.logProvider?.info(`[Core] write answers file:${file} success！ `);
    }

    public async scaffold(answers?: ConfigMap): Promise<Result<null, FxError>> {
        return await this.selectedSolution!.scaffold(this.solutionContext(answers));
    }

    public async withDialog(dialog: Dialog): Promise<Result<null, FxError>> {
        this.ctx.dialog = dialog;
        return ok(null);
    }

    public async withTelemetry(telemetry: TelemetryReporter): Promise<Result<null, FxError>> {
        this.ctx.telemetryReporter = telemetry;
        return ok(null);
    }

    public async withLogger(logger: LogProvider): Promise<Result<null, FxError>> {
        this.ctx.logProvider = logger;
        return ok(null);
    }

    public async withAzureAccount(azureAccount: AzureAccountProvider): Promise<Result<null, FxError>> {
        this.ctx.azureAccountProvider = azureAccount;
        return ok(null);
    }

    public async withGraphToken(graphToken: GraphTokenProvider): Promise<Result<null, FxError>> {
        this.ctx.graphTokenProvider = graphToken;
        return ok(null);
    }

    public async withAppStudioToken(appStudioToken: AppStudioTokenProvider): Promise<Result<null, FxError>> {
        this.ctx.appStudioToken = appStudioToken;
        return ok(null);
    }
    public async withTreeProvider(treeProvider: TreeProvider): Promise<Result<null, FxError>> {
        this.ctx.treeProvider = treeProvider;
        return ok(null);
    }

    /**
     * init
     */
    public async init(globalConfig?: ConfigMap): Promise<Result<null, FxError>> {
        this.globalConfig = globalConfig;

        // const that = this;

        // let initResult: Result<null, FxError> = ok(null);

        const loadResult = await Loader.loadSolutions(this.ctx);
        if (loadResult.isErr()) {
            return err(loadResult.error);
        }
        this.globalSolutions = loadResult.value;
 
        this.ctx.logProvider?.info("[Teams Toolkit] Initialized");
        return ok(null);
    }

    private async createBasicFolderStructure(answers?: ConfigMap): Promise<Result<null, FxError>> {
        if (!this.target) {
            return ok(null);
        }
        try {
            const settings: Settings = {
                selectedSolution: {
                    name: this.target.selectedSolution!.name,
                    version: this.target.selectedSolution!.version,
                },
            };

            await fs.writeFile(`${this.target.ctx.root}/.${ProductName}/settings.json`, JSON.stringify(settings, null, 4));
            const appName = answers?.getString(QuestionAppName.name);
            await fs.writeFile(
                `${this.target.ctx.root}/package.json`,
                JSON.stringify(
                    {
                        name: appName,
                        version: "0.0.1",
                        description: "",
                        author: "",
                        scripts: {
                            test: "echo \"Error: no test specified\" && exit 1",
                        },
                        license: "MIT",
                    },
                    null,
                    4,
                ),
            );
        } catch (e) {
            return err(error.WriteFileError(e));
        }
        return ok(null);
    }

    private mergeConfigMap(source?: ConfigMap, target?: ConfigMap): ConfigMap {
        const map = new ConfigMap();
        if (source) {
            for (const entry of source) {
                map.set(entry[0], entry[1]);
            }
        }
        if (target) {
            for (const entry of target) {
                map.set(entry[0], entry[1]);
            }
        }
        return map;
    }

    private solutionContext(answers?: ConfigMap): SolutionContext {
        answers = this.mergeConfigMap(this.globalConfig, answers);
        const stage = answers?.getString(CoreQuestionNames.Stage);
        const substage = answers?.getString(CoreQuestionNames.SubStage);
        let ctx: SolutionContext;
        if ("create" === stage && ("getQuestions" === substage || "askQuestions" === substage)) {
            // for create stage, SolutionContext is new and clean
            ctx = {
                ...this.ctx,
                answers: answers,
                app: new TeamsAppManifest(),
                config: new Map<string, ConfigMap>(),
                dotVsCode: VscodeManager.getInstance(),
                root: os.homedir() + "/teams_app/",
            };
        } else {
            ctx = {
                ...this.ctx,
                answers: this.mergeConfigMap(this.ctx.answers, answers),
                app: this.app,
                config: this.configs.get(this.env)!,
                dotVsCode: VscodeManager.getInstance(),
            };
        }
        return ctx;
    }
}

/*
 * Core is a singleton which will provide primary API for UI layer component to implement
 * business logic.
 */
export class CoreProxy implements Core {
    /*
     * Core only will be initialized once by this funcion.
     */
    public static initialize() {
        if (!CoreProxy.instance) {
            CoreProxy.instance = new CoreProxy();
        }
    }

    /*
     * this is the only entry to get Core instance.
     */
    public static getInstance(): CoreProxy {
        CoreProxy.initialize();
        return CoreProxy.instance;
    }

    /*
     * The instance will be set as private so that it won't be modified from outside.
     */
    private static instance: CoreProxy;

    private coreImpl: CoreImpl;

    constructor() {
        this.coreImpl = new CoreImpl();
    }

    private async runWithErrorHandling<T>(
        name: string,
        checkAndConfig: boolean,
        notSupportedRes: Result<T, FxError>,
        fn: () => Promise<Result<T, FxError>>,
    ): Promise<Result<T, FxError>> {
        this.coreImpl.ctx.logProvider?.info(`[Core] run task name：${name}, checkAndConfig:${checkAndConfig}`);
        try {
            // check if this project is supported
            if (checkAndConfig) {
                const supported = await this.coreImpl.isSupported();
                if (!supported) {
                    return notSupportedRes;
                }
            }
            // this.coreImpl.ctx.logProvider?.info(`[Core] run task ${name} start!`);

            // reload configurations before run lifecycle api
            if (checkAndConfig) {
                const readRes = await this.coreImpl.readConfigs();
                if (readRes.isErr()) {
                    return err(readRes.error);
                }
            }

            // do it
            const res = await fn();

            this.coreImpl.ctx.logProvider?.info(`[Core] run task ${name} finish, isOk: ${res.isOk()}!`);
            return res;
        } catch (e) {
            this.coreImpl.ctx.logProvider?.error(
                `[Core] run task ${name} finish, isOk: false, throw error:${JSON.stringify(e)}`,
            );
            if (
                e instanceof UserError ||
                e instanceof SystemError ||
                (e.constructor &&
                    e.constructor.name &&
                    (e.constructor.name === "SystemError" || e.constructor.name === "UserError"))
            ) {
                return err(e);
            }
            return err(returnSystemError(e, error.CoreSource, error.CoreErrorNames.UncatchedError));
        } finally {
            // persist configurations
            if (checkAndConfig) {
                const writeRes = await this.coreImpl.writeConfigs();
                if (writeRes.isErr()) {
                    this.coreImpl.ctx.logProvider?.info(`[Core] persist config failed:${writeRes.error}!`);
                    return err(writeRes.error);
                }
                this.coreImpl.ctx.logProvider?.info(`[Core] persist config success!`);
            }
        }
    }
    withDialog(dialog: Dialog): Promise<Result<null, FxError>> {
        return this.coreImpl.withDialog(dialog);
    }
    withLogger(logger: LogProvider): Promise<Result<null, FxError>> {
        return this.coreImpl.withLogger(logger);
    }
    withAzureAccount(azureAccount: AzureAccountProvider): Promise<Result<null, FxError>> {
        return this.coreImpl.withAzureAccount(azureAccount);
    }
    withGraphToken(graphToken: GraphTokenProvider): Promise<Result<null, FxError>> {
        return this.coreImpl.withGraphToken(graphToken);
    }
    withAppStudioToken(appStudioToken: AppStudioTokenProvider): Promise<Result<null, FxError>> {
        return this.coreImpl.withAppStudioToken(appStudioToken);
    }
    withTelemetry(logger: TelemetryReporter): Promise<Result<null, FxError>> {
        return this.coreImpl.withTelemetry(logger);
    }
    withTreeProvider(treeProvider: TreeProvider): Promise<Result<null, FxError>> {
        return this.coreImpl.withTreeProvider(treeProvider);
    }
    async init(globalConfig?: ConfigMap): Promise<Result<null, FxError>> {
        return await this.runWithErrorHandling<null>("init", false, ok(null), () => this.coreImpl.init(globalConfig));
    }
    async getQuestions(stage: Stage, platform: Platform): Promise<Result<QTreeNode | undefined, FxError>> {
        const checkAndConfig = !(stage === Stage.create);
        return await this.runWithErrorHandling<QTreeNode | undefined>(
            "getQuestions",
            checkAndConfig,
            ok(undefined),
            () => this.coreImpl.getQuestions(stage, platform),
        );
    }
    async getQuestionsForUserTask(func: Func, platform: Platform): Promise<Result<QTreeNode | undefined, FxError>> {
        return await this.runWithErrorHandling<QTreeNode | undefined>(
            "getQuestionsForUserTask",
            true,
            err(error.NotSupportedProjectType()),
            () => this.coreImpl.getQuestionsForUserTask(func, platform),
        );
    }
    async executeUserTask(func: Func, answers?: ConfigMap): Promise<Result<any, FxError>> {
        return await this.runWithErrorHandling<QTreeNode | undefined>(
            "executeUserTask",
            true,
            err(error.NotSupportedProjectType()),
            () => this.coreImpl.executeUserTask(func, answers),
        );
    }
    async callFunc(func: Func, answer?: ConfigMap): Promise<Result<any, FxError>> {
        const stage = answer?.getString("stage");
        const checkAndConfig = !(stage === Stage.create);
        return await this.runWithErrorHandling("callFunc", checkAndConfig, ok({}), () =>
            this.coreImpl.callFunc(func, answer),
        );
    }
    async create(answers?: ConfigMap | undefined): Promise<Result<null, FxError>> {
        return await this.runWithErrorHandling<null>("create", false, ok(null), () => this.coreImpl.create(answers));
    }
    async update(answers?: ConfigMap | undefined): Promise<Result<null, FxError>> {
        return await this.runWithErrorHandling<null>("update", true, ok(null), () => this.coreImpl.update(answers));
    }
    async open(workspace?: string | undefined): Promise<Result<null, FxError>> {
        return this.runWithErrorHandling<null>("open", false, ok(null), () => this.coreImpl.open(workspace)); //open project readConfigs in open() logic!!!
    }
    async scaffold(answers?: ConfigMap | undefined): Promise<Result<null, FxError>> {
        return await this.runWithErrorHandling<null>("scaffold", true, ok(null), () => this.coreImpl.scaffold(answers));
    }
    async localDebug(answers?: ConfigMap | undefined): Promise<Result<null, FxError>> {
        return await this.runWithErrorHandling<null>("localDebug", true, err(error.NotSupportedProjectType()), () =>
            this.coreImpl.localDebug(answers),
        );
    }
    async provision(answers?: ConfigMap | undefined): Promise<Result<null, FxError>> {
        return await this.runWithErrorHandling<null>("provision", true, err(error.NotSupportedProjectType()), () =>
            this.coreImpl.provision(answers),
        );
    }
    async deploy(answers?: ConfigMap | undefined): Promise<Result<null, FxError>> {
        return await this.runWithErrorHandling<null>("deploy", true, err(error.NotSupportedProjectType()), () =>
            this.coreImpl.deploy(answers),
        );
    }
    async publish(): Promise<Result<null, FxError>> {
        return await this.runWithErrorHandling<null>("publish", true, err(error.NotSupportedProjectType()), () =>
            this.coreImpl.publish(),
        );
    }
    async createEnv(env: string): Promise<Result<null, FxError>> {
        return await this.runWithErrorHandling<null>("createEnv", true, err(error.NotSupportedProjectType()), () =>
            this.coreImpl.createEnv(env),
        );
    }
    async removeEnv(env: string): Promise<Result<null, FxError>> {
        return await this.runWithErrorHandling<null>("removeEnv", true, err(error.NotSupportedProjectType()), () =>
            this.coreImpl.removeEnv(env),
        );
    }
    async switchEnv(env: string): Promise<Result<null, FxError>> {
        return await this.runWithErrorHandling<null>("switchEnv", true, err(error.NotSupportedProjectType()), () =>
            this.coreImpl.switchEnv(env),
        );
    }
    async listEnvs(): Promise<Result<string[], FxError>> {
        return await this.runWithErrorHandling<string[]>("listEnvs", true, err(error.NotSupportedProjectType()), () =>
            this.coreImpl.listEnvs(),
        );
    }
}

export async function Default(): Promise<Result<CoreProxy, FxError>> {
    const result = await CoreProxy.getInstance().init();
    if (result.isErr()) {
        return err(result.error);
    }
    return ok(CoreProxy.getInstance());
}