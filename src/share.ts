import { Cliffy, distanceToNow, Earthstar } from "../deps.ts";
import { getCurrentIdentity, getIdentities } from "./identity.ts";
import * as path from "https://deno.land/std@0.131.0/path/mod.ts";
import home_dir from "https://deno.land/x/dir@v1.2.0/home_dir/mod.ts";
import { logSuccess, logWarning } from "./util.ts";
import { getDirAssociatedShare } from "https://deno.land/x/earthstar@v8.3.0/src/sync-fs/util.ts";
import { getServers } from "./servers.ts";
import { ensureDir } from "https://deno.land/std@0.132.0/fs/mod.ts";

const LS_SHARE_DIR_KEY = "shares_dir";

function openReplica(path: string) {
  const driver = new Earthstar.ReplicaDriverSqlite({
    filename: path,
    mode: "open",
    share: null,
  });

  return new Earthstar.Replica(
    driver.share,
    Earthstar.FormatValidatorEs4,
    driver,
  );
}

async function openShare(address: string) {
  const sharesDir = await getSharesDir();

  const sharePath = path.join(sharesDir, `${address}.sqlite`);

  return openReplica(sharePath);
}

async function setShareDir(message: string) {
  const newSharesDir = await Cliffy.Input.prompt({
    message,
    default: path.join(home_dir() || "", "Shares"),
    validate: async (input) => {
      try {
        const dirStat = await Deno.stat(input);

        return dirStat.isDirectory;
      } catch (err) {
        return err.message;
      }
    },
  });

  localStorage.setItem(LS_SHARE_DIR_KEY, newSharesDir);

  await ensureDir(newSharesDir);

  return newSharesDir;
}

async function getSharesDir(): Promise<string> {
  const sharesDir = localStorage.getItem(LS_SHARE_DIR_KEY);

  if (sharesDir) {
    try {
      await Deno.stat(sharesDir);

      return sharesDir;
    } catch {
      const newSharesDir = await setShareDir(
        "No directory for storing shares wasn't where it was expected to be. Where should it be?",
      );

      return newSharesDir;
    }
  }

  const newSharesDir = await setShareDir(
    "No directory for storing shares has been set yet. Where you would you like it?",
  );

  return newSharesDir;
}

async function findRootManifestDirUpwards(dir: string): Promise<string | null> {
  try {
    await Deno.stat(path.join(dir, ".es-fs-manifest"));

    return dir;
  } catch {
    const parentDir = path.resolve(dir, "..");

    if (parentDir === dir) {
      // We've reached the top, with nowhere to go.
      return null;
    }

    return findRootManifestDirUpwards(parentDir);
  }
}

async function getPeer() {
  const sharesDir = await getSharesDir();

  const peer = new Earthstar.Peer();

  for await (const dirEntry of Deno.readDir(sharesDir)) {
    if (dirEntry.isFile && dirEntry.name.endsWith(".sqlite")) {
      try {
        const replica = openReplica(path.join(sharesDir, dirEntry.name));

        peer.addReplica(replica);
      } catch (err) {
        logWarning(`Couldn't read ${dirEntry.name}:`);
        console.error(err);
      }
    }
  }

  return peer;
}

async function promptShare() {
  const peer = await getPeer();
  const shares = peer.shares();

  for (const replica of peer.replicas()) {
    await replica.close(false);
  }

  return Cliffy.Input.prompt({
    message: "Choose a share",
    suggestions: shares,
    validate: (input) => {
      return shares.includes(input);
    },
  });
}

async function promptPath(replica: Earthstar.Replica, allowNew?: boolean) {
  const docs = await replica.getLatestDocs();
  const paths = docs.map((doc) => doc.path);

  return Cliffy.Input.prompt({
    message: "Choose a path",
    list: true,
    suggestions: paths,
    validate: async (input) => {
      if (allowNew) {
        return true;
      }

      const res = await replica.getLatestDocAtPath(input);

      if (!res) {
        return "No such path exists.";
      }

      return true;
    },
  });
}

function logDoc(doc: Earthstar.Doc) {
  const docDate = new Date(doc.timestamp / 1000);

  const table = new Cliffy.Table();

  table.body(
    [
      ["Path", doc.path],
      ["Content", doc.content],
      ["Author", doc.author],
      [
        "Timestamp",
        `${doc.timestamp} (${distanceToNow(docDate, { addSuffix: true })})`,
      ],
      ["Signature", doc.signature],
      ["Content hash", doc.contentHash],
      ["Format", doc.format],
    ],
  ).border(true).maxColWidth(50)
    .render();
}

function registerAddShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "add <shareAddress>",
    new Cliffy.Command().description("Add a share by address.").action(
      async (
        _flags,
        shareAddress: string,
      ) => {
        const addressIsValidResult = Earthstar.checkShareIsValid(shareAddress);

        if (Earthstar.isErr(addressIsValidResult)) {
          logWarning(`Could not add ${shareAddress}`);
          console.error(`${addressIsValidResult}`);
          Deno.exit(1);
        }

        const dirPath = await getSharesDir();
        const dbPath = path.join(dirPath, `${shareAddress}.sqlite`);

        try {
          const driver = new Earthstar.ReplicaDriverSqlite({
            filename: dbPath,
            mode: "create",
            share: shareAddress,
          });

          logSuccess(`Added ${driver.share}`);

          await driver.close(false);
        } catch (err) {
          logWarning("Failed to persist share.");
          console.error(err);
          Deno.exit(1);
        }
      },
    ),
  );
}

function registerChangeDirShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "set-share-dir",
    new Cliffy.Command().description(
      "Change where earthstar-cli persists and looks for shares",
    ).action(
      async (_flags) => {
        const res = await setShareDir(
          "Where should earthstar persist and look for shares from now on?",
        );

        logSuccess(`Set share directory to ${res}`);
      },
    ),
  );
}

function registerLsShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "list",
    new Cliffy.Command().description("List all stored shares.")
      .option("-s, --suffix [type:boolean]", "Show address suffixes", {
        default: false,
      })
      .action(
        async ({ suffix }) => {
          const peer = await getPeer();
          const shareDir = await getSharesDir();

          if (peer.replicas().length === 0) {
            console.log("No known shares. Add some with earthstar shares add");
          }

          const rows: string[][] = [];

          for await (const replica of peer.replicas()) {
            const address = replica.share;

            const parsed = Earthstar.parseShareAddress(
              address,
            ) as Earthstar.ParsedAddress;

            const docCount = await replica.getLatestDocs();

            if (suffix) {
              rows.push([
                address,
                `${docCount.length}`,
                path.join(
                  shareDir,
                  `${parsed.address}.sqlite`,
                ),
              ]);
            } else {
              rows.push([
                `+${parsed.name}`,
                `${docCount.length}`,
                path.join(
                  shareDir,
                  `${parsed.name}.***.sqlite`,
                ),
              ]);
            }
          }

          console.log("All shares stored at:", shareDir);

          new Cliffy.Table().header([
            "Address",
            "Docs",
            "Filepath",
          ]).body(rows).border(true).render();
        },
      ),
  );
}

function registerSetShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "set",
    new Cliffy.Command().description("Set a document's contents.")
      .option("--idAddress [type:string]", "Identity address to use", {
        depends: ["idSecret"],
        required: false,
      })
      .option("--idSecret [type:string]", "Identity secret to use", {
        depends: ["idAddress"],
        required: false,
      })
      .option("--share [type:string]", "Share address", {
        required: false,
      })
      .option("--path [type:string]", "Document path", {
        required: false,
      })
      .option("--content [type:string]", "Document content", {
        required: false,
      })
      .action(
        async (
          { idAddress, idSecret, share, path, content },
        ) => {
          let keypair: Earthstar.AuthorKeypair | null = null;

          if (idAddress && idSecret) {
            const keypair = {
              address: idAddress,
              secret: idSecret,
            };

            const isValidRes = await Earthstar.Crypto.checkAuthorKeypairIsValid(
              keypair,
            );

            if (Earthstar.isErr(isValidRes)) {
              logWarning("A valid keypair was not provided.");
              console.error(isValidRes);
              Deno.exit(1);
            }
          } else {
            const currentIdentity = getCurrentIdentity();

            if (currentIdentity) {
              const secret = getIdentities()[currentIdentity];

              keypair = {
                address: currentIdentity,
                secret,
              };
            }
          }

          if (keypair === null) {
            logWarning(
              "Could not get the identity to set the document with",
            );
            Deno.exit(1);
          }

          const address = share || await promptShare();
          const replica = await openShare(address);
          const pathToUse = path || await promptPath(replica, true);
          const contentToUse = content || await Cliffy.Input.prompt({
            message: "Enter document content",
          });

          const res = await replica.set(keypair, {
            content: contentToUse,
            path: pathToUse,
            format: "es.4",
          });

          if (res.kind === "failure") {
            logWarning("Could not set the document.");
            console.error(res.reason);
            await replica.close(false);
            Deno.exit(1);
          }

          if (res.kind === "success") {
            logSuccess("Successfully wrote document.");
            logDoc(res.doc);
          }

          await replica.close(false);
          Deno.exit(0);
        },
      ),
  );
}

function registerPathsShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "paths",
    new Cliffy.Command().description("Get the paths of this share's documents.")
      .option("--share [type:string]", "Share address", {
        required: false,
      })
      .action(
        async ({ share }) => {
          const address = share || await promptShare();

          const replica = await openShare(address);

          const latestDocs = await replica.getLatestDocs();

          const paths = latestDocs.map((doc) => doc.path);

          for (const path of paths) {
            console.log(path);
          }

          await replica.close(false);
        },
      ),
  );
}

function registerGetLatestShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "latest",
    new Cliffy.Command().description(
      "Get the latest document at a share's path.",
    ).option("--share [type:string]", "Share address", {
      required: false,
    })
      .option("--path [type:string]", "Document path", {
        required: false,
      })
      .action(
        async ({ share, path }) => {
          const address = share || await promptShare();
          const replica = await openShare(address);
          const pathToUse = path || await promptPath(replica);
          const latestDoc = await replica.getLatestDocAtPath(pathToUse);

          if (!latestDoc) {
            console.log(`No document exists at ${pathToUse}`);
            await replica.close(false);
            Deno.exit(1);
          }

          logDoc(latestDoc);
          await replica.close(false);
        },
      ),
  );
}

function registerContentShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "contents",
    new Cliffy.Command().description(
      "Get the contents of the latest document at this share's path",
    )
      .option("--share [type:string]", "Share address", {
        required: false,
      })
      .option("--path [type:string]", "Document path", {
        required: false,
      })
      .action(
        async ({ share, path }) => {
          const address = share || await promptShare();
          const replica = await openShare(address);
          const pathToUse = path || await promptPath(replica);
          const latestDoc = await replica.getLatestDocAtPath(pathToUse);

          if (!latestDoc) {
            console.log(`No document exists at ${pathToUse}`);
            await replica.close(false);
            Deno.exit(1);
          }

          console.log(latestDoc.content);
          await replica.close(false);
        },
      ),
  );
}

function registerSyncShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "sync",
    new Cliffy.Command().description(
      "Sync this document with a known replica servers or a local Earthstar database..",
    ).option(
      "--dbPath [type:string]",
      "The path of a Sqlite Earthstar database to sync",
      {
        conflicts: ["serverUrl"],
      },
    ).option(
      "--serverUrl [type:string]",
      "The path of a Sqlite Earthstar database to sync",
      {
        conflicts: ["dbPath"],
      },
    )
      .action(
        async (
          { dbPath, serverUrl }: { dbPath: string; serverUrl: string },
        ) => {
          const peer = await getPeer();

          const servers = getServers();

          if (!dbPath && !serverUrl && servers.length === 0) {
            console.log("No known replica servers to sync with.");
            Deno.exit(0);
          }

          const thingsToSyncWith: (string | Earthstar.Peer)[] = [];

          if (dbPath) {
            const otherReplica = openReplica(dbPath);
            const otherPeer = new Earthstar.Peer();
            otherPeer.addReplica(otherReplica);
            thingsToSyncWith.push(otherPeer);
          } else if (serverUrl) {
            thingsToSyncWith.push(serverUrl);
          } else {
            thingsToSyncWith.push(...servers);
          }

          peer.syncerStatuses.bus.on("changed", (_key) => {
            const rows = [];

            for (
              const [connection, statuses] of peer.syncerStatuses.entries()
            ) {
              rows.push([new Cliffy.Cell(connection).colSpan(3)]);
              rows.push(["Share", "Pulled", "New"]);

              Object.keys(statuses).forEach((shareAddress) => {
                const { ingestedCount, pulledCount } = (statuses)[shareAddress];

                const { name } = Earthstar.parseShareAddress(shareAddress);

                rows.push([
                  `+${name}`,
                  `${pulledCount}`,
                  `${ingestedCount}`,
                ]);
              });
            }

            Cliffy.tty.clearTerminal();

            if (dbPath) {
              console.log(
                `Syncing with ${dbPath}...`,
              );
            } else if (serverUrl) {
              console.log(
                `Syncing with ${serverUrl}...`,
              );
            } else {
              console.log(
                `Syncing with ${thingsToSyncWith.length} peer${
                  thingsToSyncWith.length > 1 ? "s" : ""
                }...`,
              );
            }

            new Cliffy.Table().border(true).body(rows).render();
          });

          try {
            await peer.syncUntilCaughtUp(thingsToSyncWith);

            logSuccess("Synced.");

            Deno.exit(0);
          } catch (err) {
            logWarning("Something went wrong when trying to sync!");
            console.error(err);
            Deno.exit(1);
          }
        },
      ),
  );
}

function registerFsSyncShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "sync-files",
    new Cliffy.Command().description(
      "Sync a share with a filesystem directory.",
    )
      .option("--share [type:string]", "Share address", {
        required: false,
      })
      .option(
        "--dirPath [type:string]",
        "The path of the directory to sync with",
        {
          required: false,
        },
      ).option("--idAddress [type:string]", "Identity address to use", {
        depends: ["idSecret"],
        required: false,
      })
      .option("--idSecret [type:string]", "Identity secret to use", {
        depends: ["idAddress"],
        required: false,
      })
      .option(
        "--allowUnsyncedDirWithFiles [type:boolean]",
        "Whether to allow syncing with a directory with existing files but which has never been synced with a share before.",
        {
          required: false,
          default: false,
        },
      )
      .option(
        "--overwriteFilesAtOwnedPaths [type:boolean]",
        "Whether to force overwrite files at paths the provided identity doesn't own.",
        {
          required: false,
        },
      )
      .action(
        async (
          {
            idAddress,
            idSecret,
            allowUnsyncedDirWithFiles,
            share,
            dirPath,
            overwriteFilesAtOwnedPaths,
          },
        ) => {
          let keypair: Earthstar.AuthorKeypair | null = null;

          if (idAddress && idSecret) {
            const keypair = {
              address: idAddress,
              secret: idSecret,
            };

            const isValidRes = await Earthstar.Crypto.checkAuthorKeypairIsValid(
              keypair,
            );

            if (Earthstar.isErr(isValidRes)) {
              logWarning("A valid keypair was not provided.");
              console.error(isValidRes.message);
              Deno.exit(1);
            }
          } else {
            const currentIdentity = getCurrentIdentity();

            if (currentIdentity) {
              const secret = getIdentities()[currentIdentity];

              keypair = {
                address: currentIdentity,
                secret,
              };
            }
          }

          if (keypair === null) {
            logWarning(
              "Could not get the identity to set the document with",
            );
            Deno.exit(1);
          }

          let dirToSyncWith = dirPath || Deno.cwd();

          // Use dirPath flag if provided.

          // If not, then...
          // Check if the current directory has a manifest.
          // If it does, use this directory.
          // If it doesn't, traverse upwards until one is found.
          // If none is found, use this directory.

          if (!dirPath) {
            try {
              await Deno.stat(".es-fs-manifest");
            } catch {
              const parentWithManifest = await findRootManifestDirUpwards(
                Deno.cwd(),
              );

              if (parentWithManifest) {
                dirToSyncWith = parentWithManifest;
              }
            }
          }

          const associatedShare = await getDirAssociatedShare(dirToSyncWith);

          const address = associatedShare || share || await promptShare();
          const replica = await openShare(address);

          const { name } = Earthstar.parseShareAddress(replica.share);

          try {
            await Earthstar.syncReplicaAndFsDir({
              keypair,
              allowDirtyDirWithoutManifest: allowUnsyncedDirWithFiles,
              replica,
              dirPath: dirToSyncWith,
              overwriteFilesAtOwnedPaths: !!overwriteFilesAtOwnedPaths,
            });

            logSuccess(`Synced +${name} with ${path.resolve(dirToSyncWith)}`);
          } catch (err) {
            logWarning(`Could not sync +${name} with ${dirToSyncWith}`);
            console.error(err.message);
          }
        },
      ),
  );
}

function registerRemoveShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "remove",
    new Cliffy.Command().description(
      "Remove a share from stored shares.",
    ).option("--share [type:string]", "Share address", {
      required: false,
    })
      .action(
        async ({ share }) => {
          const address = share || await promptShare();
          const sharesDir = await getSharesDir();
          const sharePath = path.join(sharesDir, `${address}.sqlite`);

          const isSure = await Cliffy.Confirm.prompt(
            `The local replica of ${address} will be erased and forgotten. Are you sure you want to do this?`,
          );

          if (!isSure) {
            Deno.exit(0);
          }

          try {
            await Deno.remove(sharePath);
            logSuccess(`Removed ${address}`);
          } catch (err) {
            logWarning(
              `Something wefnt wrong when trying to remove ${address}`,
            );
            console.error(err);
          }
        },
      ),
  );
}

export function registerShareCommands(cmd: Cliffy.Command) {
  const shareCommand = new Cliffy.Command().description(
    "Manage Earthstar shares.",
  ).action(() => {
    shareCommand.showHelp();
  });

  registerAddShareCommand(shareCommand);
  registerLsShareCommand(shareCommand);
  registerRemoveShareCommand(shareCommand);
  registerSetShareCommand(shareCommand);
  registerPathsShareCommand(shareCommand);
  registerGetLatestShareCommand(shareCommand);
  registerContentShareCommand(shareCommand);
  registerSyncShareCommand(shareCommand);
  registerChangeDirShareCommand(shareCommand);
  registerFsSyncShareCommand(shareCommand);

  cmd.command(
    "shares",
    shareCommand,
  );
}
