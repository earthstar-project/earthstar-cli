import { Cliffy } from "../deps.ts";

export function registerUpgradeCommand(cmd: Cliffy.Command) {
  const currentVersion = cmd.getVersion();

  cmd.command(
    "upgrade",
    new Cliffy.Command().description(
      "Upgrade the Earthstar CLI to the latest version.",
    ).option("--version [type:string]", "The version to install").action(
      async ({ version }: { version: string }) => {
        const { latest, versions } = await getVersions();

        if (currentVersion === latest && !version) {
          console.log("You have the latest version of the Earthstar CLI.");
          Deno.exit(0);
        }

        if (version && !versions.includes(version)) {
          console.log(`The requested version (${version}) was not found.`);
          Deno.exit(1);
        }

        const process = Deno.run({
          cmd: [
            Deno.execPath(),
            "install",
            "--allow-read",
            "--allow-write",
            "--allow-net",
            "--allow-run",
            "--allow-env",
            "--no-check",
            "--unstable",
            "-f",
            "--location",
            "https://earthstar-project.org",
            "-n",
            "earthstar",
            `https://deno.land/x/earthstar_cli@${
              version ? version : latest
            }/src/main.ts`,
          ],
        });
        await process.status();
      },
    ),
  );
}

export async function getVersions(): Promise<
  { latest: string; versions: string[] }
> {
  const aborter = new AbortController();
  const timer = setTimeout(() => aborter.abort(), 2500);
  const response = await fetch(
    "https://cdn.deno.land/earthstar_cli/meta/versions.json",
    { signal: aborter.signal },
  );
  if (!response.ok) {
    throw new Error(
      "couldn't fetch the latest version - try again after sometime",
    );
  }
  const data = await response.json();
  clearTimeout(timer);
  return data;
}
