import { Cliffy, Earthstar } from "../deps.ts";
import { logSuccess, logWarning } from "./util.ts";

const LS_IDENTITIES_KEY = "identities";
const LS_CURRENT_IDENTITY_KEY = "current_identity";

export function getIdentities(): Record<string, string> {
  const result = localStorage.getItem(LS_IDENTITIES_KEY);
  return result ? JSON.parse(result) : {};
}

function setIdentities(identities: Record<string, string>): void {
  localStorage.setItem(LS_IDENTITIES_KEY, JSON.stringify(identities));
}

function addIdentity(identity: Earthstar.AuthorKeypair) {
  const identities = getIdentities();
  const next = { ...identities, [identity.address]: identity.secret };
  setIdentities(next);
}

function removeIdentity(address: string): boolean {
  const identities = getIdentities();

  if (identities[address]) {
    delete identities[address];
    setIdentities(identities);

    return true;
  }

  return false;
}

export function getCurrentIdentity(): string | null {
  return localStorage.getItem(LS_CURRENT_IDENTITY_KEY);
}

function setCurrentIdentity(address: string): boolean {
  const identities = getIdentities();

  if (identities[address]) {
    localStorage.setItem(LS_CURRENT_IDENTITY_KEY, address);

    return true;
  }

  return false;
}

function clearCurrentIdentity() {
  localStorage.removeItem(LS_CURRENT_IDENTITY_KEY);

  return true;
}

export function registerIdentityCommand(cmd: Cliffy.Command) {
  cmd.command(
    "identity",
    new Cliffy.Command()
      .description("Manage identities used to sign documents.")
      .command(
        "ls",
        new Cliffy.Command()
          .description("List all saved identities")
          .action(() => {
            const addresses = Object.keys(getIdentities());

            if (addresses.length === 0) {
              console.log("No identities have been saved.");
              Deno.exit();
            }

            const currentIdentity = getCurrentIdentity();

            const rows = addresses.map((address) => {
              return [address, address === currentIdentity ? "Yes" : ""];
            });

            new Cliffy.Table().header(["Address", "Selected"]).border(true)
              .body(
                rows,
              ).render();
          }),
      )
      .command(
        "generate <shortname>",
        new Cliffy.Command()
          .description("Generate a new identity")
          .option("-a, --add [type:boolean]", "Add to saved identities", {
            default: true,
          })
          .option("-c, --current [type:boolean]", "Set as current identity", {
            depends: ["add"],
            default: false,
          })
          .action(
            async (
              { add, current }: { add: boolean; current: boolean },
              name: string,
            ) => {
              const result = await Earthstar.Crypto.generateAuthorKeypair(name);

              if (Earthstar.isErr(result)) {
                console.log(`${result}`);
                Deno.exit(1);
              }

              if (add) {
                addIdentity(result);
              }

              if (current) {
                setCurrentIdentity(result.address);
              }

              if (!add) {
                const encoded = new TextEncoder().encode(
                  (result as Earthstar.AuthorKeypair).address + "\n" +
                    (result as Earthstar.AuthorKeypair).secret + "\n",
                );

                await Deno.stdout.write(encoded);
                Deno.stdout.close();
              } else {
                const { name } = Earthstar.parseAuthorAddress(result.address);

                logSuccess(`Added @${name} to stored identities.`);
              }
            },
          ),
      ).command(
        "switch",
        new Cliffy.Command()
          .description("Set the current identity")
          .action(async () => {
            const identities = Object.keys(getIdentities());

            const address: string = await Cliffy.Select.prompt({
              message: "Select which identity to use to sign documents",
              options: [...identities, "None"],
            });

            if (address !== "None") {
              setCurrentIdentity(address);
            } else {
              clearCurrentIdentity();
            }

            Deno.exit(0);
          }),
      ).command(
        "add <address> <secret>",
        new Cliffy.Command()
          .description("Add an existing identity")
          .option("-c, --current [type:boolean]", "Set as current identity", {
            default: false,
          })
          .action(
            async ({ current }: { current: boolean }, address, secret) => {
              const keypair: Earthstar.AuthorKeypair = { address, secret };

              const result = await Earthstar.Crypto.checkAuthorKeypairIsValid(
                keypair,
              );

              if (Earthstar.isErr(result)) {
                logWarning("Could not add identity.");
                console.log(`${result.message}`);
                Deno.exit(1);
              }

              addIdentity(keypair);

              if (current) {
                setCurrentIdentity(address);
              }

              logSuccess(`Added ${address}`);

              Deno.exit(0);
            },
          ),
      ).command(
        "remove",
        new Cliffy.Command()
          .description("Remove a known identity")
          .option("--idAddress [type:string]", "The address to remove", {
            required: false,
          })
          .action(async ({ idAddress }) => {
            const identities = getIdentities();

            const address = idAddress || await Cliffy.Select.prompt({
              message: "Choose which identity to remove",
              options: Object.keys(identities),
            });

            const currentIdentity = getCurrentIdentity();

            if (!identities[address]) {
              console.log(`No known identity with the address ${address}`);
              return Deno.exit(0);
            }

            const isSure = await Cliffy.Confirm.prompt(
              "This identity and its secret will be forgotten. Are you sure you want to do this?",
            );

            if (!isSure) {
              return Deno.exit(0);
            }
            removeIdentity(address);

            if (address === currentIdentity) {
              clearCurrentIdentity();
            }

            logSuccess(`Removed ${address}`);

            Deno.exit(0);
          }),
      ),
  );
}
