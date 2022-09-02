import { Cliffy } from "../deps.ts";

import { registerIdentityCommand } from "./identity.ts";
import { registerServerCommands } from "./servers.ts";
import { registerShareCommands } from "./share.ts";
import { registerUpgradeCommand } from "./upgrade.ts";

const mainCommand = new Cliffy.Command()
  .name("earthstar")
  .version("v9.0.0").description(
    "Sync, view, and write documents to Earthstar shares.",
  ).action(() => {
    mainCommand.showHelp();
  });

registerIdentityCommand(mainCommand);
registerShareCommands(mainCommand);
registerServerCommands(mainCommand);
registerUpgradeCommand(mainCommand);

mainCommand.command("completions", new Cliffy.CompletionsCommand());

await mainCommand.parse(Deno.args);
