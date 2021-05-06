# Setting up your environment

## Prerequisites

- Git
- Node 10.x or higher

## Building SDK

1. Clone this repo locally. (`git clone https://github.com/OfficeDev/TeamsFx.git`)
2. Open a terminal and move into your local copy. (`cd TeamsFx`)
3. Because the monorepo is managed by Lerna, you need to bootstrap at the first time. (`npm run setup` or `npm install && npm run bootstrap`) All dependencies will be installed.
4. Build the SDK package. (`cd packages/sdk && npm run build`)

## Supporting Browser and NodeJS

1. If a new class behaves differently under two environments. Create a new file named xxx.browser.ts that works only in browser and xxx.ts that works only in NodeJS.
2. Add a new mapping in package.json file. (browser field)
3. Keep the exported functions and public ones of class consistent in 2 files.

For example:

```typescript
// onBehalfOfUserCredential.browser.ts
export class OnBehalfOfUserCredential implements TokenCredential {
...
  async getToken(
    scopes: string | string[],
    options?: GetTokenOptions
  ): Promise<AccessToken | null> {
    // browser version implementation.
  }
}

// onBehalfOfUserCredential.ts
export class OnBehalfOfUserCredential implements TokenCredential {
...
  async getToken(
    scopes: string | string[],
    options?: GetTokenOptions
  ): Promise<AccessToken | null> {
    // nodejs version implementation.
  }
}
```

Please check [onBehalfOfUserCredential.browser.ts](src/credential/onBehalfOfUserCredential.browser.ts) and [onBehalfOfUserCredential.ts](src/credential/onBehalfOfUserCredential.ts) to see the details.

### Using isNode method

Use xxx.browser.ts if the functionality has great difference and use `isNode` if it only differs a little in 2 environments.

E.g. In [configurationProvider.ts](src/core/configurationProvider.ts), logic of method `loadConfiguration()` has only little difference between browser and nodejs environment. We can use the isNode to detect the environment in runtime.

## Before Creating a Pull Request

1. Use eslint plugin to check whether there is any error or warning that breaks the rule. (`npm run lint`)
2. Make sure modified functions are covered by tests. (`npm run test`)
3. Add comment for public class/method. Please check [comment template](API_COMMENT.md) for details.

## Add Tests

Add tests under test/ folder. The filename should end with .spec.ts.

- test/unit/: unit tests for both browser and NodeJS.
- test/unit/browser/: unit tests for browser only.
- test/unit/node/: unit tests for NodeJS only.
- test/integration/browser/: integration tests for browser only.
- test/integration/node/: integration tests for NodeJS only.
- test/e2e/: end to end tests.

## Local Debug

Use [npm-link](https://docs.npmjs.com/cli/v7/commands/npm-link) to test the SDK iteratively without having to continually rebuild.

```bash
cd packages/sdk              # go into the SDK package directory
npm link                     # create global link
cd ../test-project-using-sdk # go into some other package directory.
npm link @microsoft/teamsfx  # link-install the package
```

Run `npm build` under `packages/sdk` after any updates of SDK.