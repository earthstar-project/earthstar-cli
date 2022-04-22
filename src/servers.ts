import { Cliffy } from "../deps.ts";
import { logSuccess, logWarning } from "./util.ts";

const LS_SERVERS_KEY = "servers";

export function getServers(): string[] {
  const result = localStorage.getItem(LS_SERVERS_KEY);
  return result ? JSON.parse(result) : [];
}

function setServers(servers: string[]): void {
  localStorage.setItem(LS_SERVERS_KEY, JSON.stringify(servers));
}

function addServer(server: string) {
  const url = new URL(server);

  const servers = getServers();

  if (servers.includes(url.toString())) {
    throw new Error(`Already know about ${server}`);
  }

  const next = [...servers, url.toString()];

  setServers(next);
}

function removeServer(address: string): boolean {
  const servers = getServers();

  const nextServers = servers.filter((server) => server !== address);

  setServers(nextServers);

  return servers.length !== nextServers.length;
}

function registerListServerCommand(cmd: Cliffy.Command) {
  cmd.command(
    "list",
    new Cliffy.Command().description(
      "List known replica servers.",
    )
      .action(
        () => {
          const servers = getServers();

          new Cliffy.Table().body(servers.map((server) => [server])).border(
            true,
          ).render();

          Deno.exit(0);
        },
      ),
  );
}

function registerAddServerCommand(cmd: Cliffy.Command) {
  cmd.command(
    "add <url>",
    new Cliffy.Command().description(
      "Add a URL to the list of known replica servers.",
    )
      .action(
        (_flags, url: string) => {
          try {
            addServer(url);
            logSuccess(`Added ${url} to known replica servers.`);
            Deno.exit(0);
          } catch (err) {
            console.log(err.message);
            logWarning(`Couldn't add ${url}`);
            Deno.exit(1);
          }
        },
      ),
  );
}

function registerRemoveServerCommand(cmd: Cliffy.Command) {
  cmd.command(
    "remove",
    new Cliffy.Command().description(
      "Remove a known replica server.",
    ).option("--server [type:string]", "Replica server URL", {
      required: false,
    })
      .action(
        async ({ server }) => {
          const servers = getServers();

          const serverToRemove = server || await Cliffy.Select.prompt({
            message: "Choose a server to remove",
            options: servers,
          });

          const removed = removeServer(serverToRemove);

          if (removed) {
            logSuccess(`Removed ${serverToRemove} from known replica servers.`);
          } else {
            logWarning(
              `Nothing was removed. Didn't know about ${serverToRemove} to begin with.`,
            );
          }

          Deno.exit(0);
        },
      ),
  );
}

export function registerServerCommands(cmd: Cliffy.Command) {
  const serverCommand = new Cliffy.Command().description(
    "Manage known replica servers.",
  ).action(() => {
    serverCommand.showHelp();
  });

  registerListServerCommand(serverCommand);
  registerAddServerCommand(serverCommand);
  registerRemoveServerCommand(serverCommand);

  cmd.command(
    "servers",
    serverCommand,
  );
}
