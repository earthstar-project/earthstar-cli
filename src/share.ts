import {
  Cliffy,
  distanceToNow,
  Earthstar,
  formatDuration,
  intervalToDuration,
  throttle,
} from "../deps.ts";
import { getCurrentIdentity, getIdentities } from "./identity.ts";
import * as path from "https://deno.land/std@0.131.0/path/mod.ts";
import home_dir from "https://deno.land/x/dir@v1.2.0/home_dir/mod.ts";
import { logEmphasis, logSuccess, logWarning } from "./util.ts";
import { getDirAssociatedShare } from "https://deno.land/x/earthstar@v9.3.3/src/sync-fs/util.ts";
import { getServers } from "./servers.ts";
import { ensureDir } from "https://deno.land/std@0.132.0/fs/mod.ts";

const LS_SHARE_DIR_KEY = "shares_dir";

async function openReplica(shareAddress: string) {
  const sharesDir = await getSharesDir();
  const shareDir = path.join(sharesDir, shareAddress);

  return new Earthstar.Replica(
    {
      driver: new Earthstar.ReplicaDriverFs(shareAddress, shareDir),
    },
  );
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
    if (
      dirEntry.isDirectory &&
      !Earthstar.isErr(Earthstar.parseShareAddress(dirEntry.name))
    ) {
      try {
        const replica = await openReplica(dirEntry.name);

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

function logDoc(doc: Earthstar.DocEs5) {
  const docDate = new Date(doc.timestamp / 1000);

  const table = new Cliffy.Table();

  table.body(
    [
      ["Path", doc.path],
      ["Text", doc.text],
      ["Author", doc.author],
      [
        "Timestamp",
        `${doc.timestamp} (${distanceToNow(docDate, { addSuffix: true })})`,
      ],
      ["Signature", doc.signature],
      ["Text hash", doc.textHash],
      ...(doc.attachmentHash && doc.attachmentSize
        ? [["Attachment hash", doc.attachmentHash], [
          "Attachment size",
          doc.attachmentSize,
        ]]
        : []),
      ["Format", doc.format],
    ],
  ).border(true).maxColWidth(50)
    .render();
}

function registerGenerateShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "generate <name>",
    new Cliffy.Command().description(
      "Generate a new share address using a human readable name.",
    ).option(
      "-a, --add [type:boolean]",
      "Add to saved shares",
      {
        default: true,
      },
    ).action(
      async (
        { add },
        name: string,
      ) => {
        const result = Earthstar.generateShareAddress(name);

        if (Earthstar.isErr(result)) {
          logWarning("Could not generate share address.");
          console.error(result);
          Deno.exit(1);
        }

        logSuccess("Generated share address.");

        if (!add) {
          console.log(result);
          Deno.exit(0);
        }

        try {
          const replica = await openReplica(result);

          logSuccess(`Added ${replica.share}`);

          await replica.close(false);
          Deno.exit(0);
        } catch (err) {
          logWarning("Failed to persist share.");
          console.error(err);
          Deno.exit(1);
        }
      },
    ),
  );
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

        try {
          const replica = await openReplica(shareAddress);

          logSuccess(`Added ${replica.share}`);

          await replica.close(false);
          Deno.exit(0);
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
                  `+${parsed.name}.***`,
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

          Deno.exit(0);
        },
      ),
  );
}

// TODO: Set attachment with path.
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
      .option("--text [type:string]", "Document text", {
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
          const replica = await openReplica(address);
          const pathToUse = path || await promptPath(replica, true);
          const contentToUse = content || await Cliffy.Input.prompt({
            message: "Enter document content",
          });

          const res = await replica.set(keypair, {
            text: contentToUse,
            path: pathToUse,
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

          const replica = await openReplica(address);

          const latestDocs = await replica.getLatestDocs();

          const paths = latestDocs.map((doc) => doc.path);

          for (const path of paths) {
            console.log(path);
          }

          await replica.close(false);
          Deno.exit(0);
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
          const replica = await openReplica(address);
          const pathToUse = path || await promptPath(replica);
          const latestDoc = await replica.getLatestDocAtPath(pathToUse);

          if (!latestDoc) {
            console.log(`No document exists at ${pathToUse}`);
            await replica.close(false);
            Deno.exit(1);
          }

          logDoc(latestDoc);
          await replica.close(false);
          Deno.exit(0);
        },
      ),
  );
}

function registerTextShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "text",
    new Cliffy.Command().description(
      "Get the text of the latest document at this share's path",
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
          const replica = await openReplica(address);
          const pathToUse = path || await promptPath(replica);
          const latestDoc = await replica.getLatestDocAtPath(pathToUse);

          if (!latestDoc) {
            console.log(`No document exists at ${pathToUse}`);
            await replica.close(false);
            Deno.exit(1);
          }

          console.log(latestDoc.text);
          await replica.close(false);
          Deno.exit(0);
        },
      ),
  );
}

function registerSyncShareCommand(cmd: Cliffy.Command) {
  cmd.command(
    "sync",
    new Cliffy.Command().description(
      "Sync this document with a known replica servers or a local Earthstar database.",
    ).option(
      "--dbPath [type:string]",
      "The path of a Earthstar share data directory to sync",
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

          const thingsToSyncWith = new Map<string, string | Earthstar.Peer>();

          if (dbPath) {
            const otherReplica = await openReplica(dbPath);
            const otherPeer = new Earthstar.Peer();
            otherPeer.addReplica(otherReplica);
            thingsToSyncWith.set(dbPath, otherPeer);
          } else if (serverUrl) {
            thingsToSyncWith.set(serverUrl, serverUrl);
          } else {
            for (const server of servers) {
              thingsToSyncWith.set(server, server);
            }
          }

          try {
            console.log("Syncing...");

            const startTime = new Date();

            const syncers = new Map<
              string,
              Earthstar.Syncer<unknown, unknown>
            >();

            for (const [description, target] of thingsToSyncWith) {
              const syncer = peer.sync(target);

              syncers.set(description, syncer);
            }

            const syncPromises = [];

            const statuses = new Map<string, Earthstar.SyncerStatus>();

            const updateRender = () => {
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
                  `Syncing with ${thingsToSyncWith.size} peer${
                    thingsToSyncWith.size > 1 ? "s" : ""
                  }...`,
                );
              }

              for (
                const [description, status] of statuses
              ) {
                Object.keys(status).forEach((shareAddress) => {
                  const { docs, attachments } = status[shareAddress];

                  const shareRows = [];

                  const { name } = Earthstar.parseShareAddress(shareAddress);
                  shareRows.push([
                    new Cliffy.Cell(`+${name} ↔ ${description}`).colSpan(3)
                      .align("center"),
                  ]);

                  const activeAttachments = attachments.filter((attachment) =>
                    attachment.status !== "missing_attachment"
                  );
                  const isAlreadySynced = docs.requested === 0 &&
                    activeAttachments.length === 0;

                  if (isAlreadySynced) {
                    shareRows.push([
                      new Cliffy.Cell("Already in sync.")
                        .colSpan(3),
                    ]);

                    new Cliffy.Table().border(true).body(shareRows).minColWidth(
                      20,
                    )
                      .maxColWidth(50)
                      .render();
                    return;
                  }

                  if (docs.requested === 0) {
                    shareRows.push([
                      new Cliffy.Cell("Documents already synced.")
                        .colSpan(3),
                    ]);
                  } else {
                    shareRows.push([new Cliffy.Cell("Documents").colSpan(3)]);
                    shareRows.push([
                      new Cliffy.Cell("Received").colSpan(2),
                      new Cliffy.Cell(`${docs.received} / ${docs.received}`)
                        .colSpan(1).align("right"),
                    ]);
                  }

                  if (attachments.length > 0) {
                    shareRows.push([new Cliffy.Cell("Attachments").colSpan(3)]);
                  }

                  for (const attachmentReport of activeAttachments) {
                    const row = [new Cliffy.Cell(
                      `${
                        attachmentReport.kind === "download" ? "⬇" : "⬆"
                      } ${attachmentReport.path}`,
                    ).colSpan(2)];

                    let content: string;

                    switch (attachmentReport.status) {
                      case "failed":
                        content = "Failed";
                        break;
                      case "ready":
                        content = "Waiting";
                        break;
                      case "missing_attachment":
                        content = "Other peer does not have this";
                        break;
                      default:
                        content = `${
                          formatBytes(attachmentReport.bytesLoaded, 1)
                        } / ${formatBytes(attachmentReport.totalBytes, 1)}`;
                        break;
                    }

                    row.push(
                      new Cliffy.Cell(content).colSpan(1).align("right"),
                    );

                    shareRows.push(row);
                  }

                  new Cliffy.Table().border(true).body(shareRows).minColWidth(
                    20,
                  )
                    .maxColWidth(50)
                    .render();
                });
              }
            };

            for (const [description, syncer] of syncers) {
              syncPromises.push(syncer.isDone());

              const throttledUpdate = throttle(
                (status: any) => {
                  console.log(status);

                  statuses.set(description, status);

                  // Call render.
                  updateRender();
                },
                17,
              );

              syncer.onStatusChange((status) => {
                // Update some object of statuses.
                throttledUpdate(status);
              });
            }

            await Promise.all(syncPromises);

            const endTime = new Date();

            const duration = intervalToDuration({
              start: startTime,
              end: endTime,
            });

            const formatted = formatDuration(duration);

            logSuccess(
              `Synced in ${
                formatted === ""
                  ? `${endTime.getTime() - startTime.getTime()}ms`
                  : formatted
              }`,
            );

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
      "Sync a share's contents to the filesystem. This command will search for the closest directory which has been synced before and sync from there, working upwards the file directory tree. If no previously synced directory is found and the current working directory is empty, the current working directory will be synced.",
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
          const replica = await openReplica(address);

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
            Deno.exit(0);
          } catch (err) {
            logWarning(
              `Could not sync +${name} with ${path.resolve(dirToSyncWith)}`,
            );

            console.error(err.message);

            if (err.message.indexOf("can't write to path /") !== -1) {
              logEmphasis(
                "If you're fine with this file being overwritten by the one from the replica, you can resolve this problem with the --overwriteFilesAtOwnedPaths flag.",
              );
            }

            Deno.exit(1);
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
          const sharePath = path.join(sharesDir, `${address}`);

          const isSure = await Cliffy.Confirm.prompt(
            `The local replica of ${address} will be erased and forgotten. Are you sure you want to do this?`,
          );

          if (!isSure) {
            Deno.exit(0);
          }

          try {
            await Deno.remove(sharePath, { recursive: true });
            logSuccess(`Removed ${address}`);
            Deno.exit(0);
          } catch (err) {
            logWarning(
              `Something wefnt wrong when trying to remove ${address}`,
            );
            console.error(err);
            Deno.exit(1);
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

  registerGenerateShareCommand(shareCommand);
  registerAddShareCommand(shareCommand);
  registerLsShareCommand(shareCommand);
  registerRemoveShareCommand(shareCommand);
  registerSetShareCommand(shareCommand);
  registerPathsShareCommand(shareCommand);
  registerGetLatestShareCommand(shareCommand);
  registerTextShareCommand(shareCommand);
  registerSyncShareCommand(shareCommand);
  registerChangeDirShareCommand(shareCommand);
  registerFsSyncShareCommand(shareCommand);

  cmd.command(
    "shares",
    shareCommand,
  );
}

function formatBytes(bytes: number, decimals: number) {
  if (bytes == 0) return "0 Bytes";
  const k = 1024,
    dm = decimals || 2,
    sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
