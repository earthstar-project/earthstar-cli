import { Cliffy } from "../deps.ts";

import { registerIdentityCommand } from "./identity.ts";
import { registerServerCommands } from "./servers.ts";
import { registerShareCommands } from "./share.ts";

const mainCommand = new Cliffy.Command()
  .name("earthstar")
  .version("8.2.1").description(
    "Sync, view, and write documents to Earthstar shares.",
  ).action(() => {
    mainCommand.showHelp();
  }).command("completions", new Cliffy.CompletionsCommand());

registerIdentityCommand(mainCommand);
registerShareCommands(mainCommand);
registerServerCommands(mainCommand);

await mainCommand.parse(Deno.args);
