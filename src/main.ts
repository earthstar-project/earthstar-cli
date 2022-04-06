import { Cliffy } from "../deps.ts";

import { registerIdentityCommand } from "./identity.ts";
import { registerShareCommands } from "./share.ts";

const mainCommand = new Cliffy.Command()
  .name("earthstar")
  .version("2.0.0").description(
    "Sync, view, and write data to Earthstar shares.",
  ).command("completions", new Cliffy.CompletionsCommand());

registerIdentityCommand(mainCommand);
registerShareCommands(mainCommand);

await mainCommand.parse(Deno.args);
