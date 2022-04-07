import { Cliffy } from "../deps.ts";

import { registerIdentityCommand } from "./identity.ts";
import { registerServerCommands } from "./servers.ts";
import { registerShareCommands } from "./share.ts";

const mainCommand = new Cliffy.Command()
  .name("earthstar")
  .version("7.0.0").description(
    "Sync, view, and write data to Earthstar shares.",
  ).command("completions", new Cliffy.CompletionsCommand());

registerIdentityCommand(mainCommand);
registerShareCommands(mainCommand);
registerServerCommands(mainCommand);

await mainCommand.parse(Deno.args);
