# Earthstar CLI

A complete command-line suite for everything Earthstar. Manage identities, back
up shares on your computer, and sync with replica servers over the internet.

- `earthstar identities` - Generate and manage Earthstar identities.
- `earthstar shares` - Create, sync, and interact with shares.
- `earthstar servers` - Add and remove replica servers you want to sync with.
- `earthstar upgrade` - Upgrade the CLI to the latest version.

This tool also provides a special filesystem synchronisation feature, allowing
you to use your filesystem as a way to view and modify share data. More on that
below!

## Installation

In time we will have pre-compiled binaries of this tool. Until then, you'll need
to have Deno installed
([instructions here](https://deno.land/manual/getting_started/installation)).

> If you had the previous Node version of the CLI installed, make sure to
> uninstall it using `npm uninstall -g earthstar-cli`.

Once Deno is installed, run the following command in your terminal:

`deno install --allow-read --allow-write --allow-net --allow-run --allow-env --no-check --unstable -f --location https://earthstar-project.org -n earthstar https://deno.land/x/earthstar_cli/src/main.ts`

There are a few permission flags there. Here is what they are for:

- `--allow-read` - Reading Earthstar databases on the filesystem, filesystem
  sync.
- `--allow-write` - Writing Earthstar databases to the filesystem, filesystem
  sync.
- `--allow-net` - Synchronising with remote servers, checking for latest CLI
  version.
- `--allow-run` - Running the upgrade script.
- `--allow-env` - Gets your HOME path when suggesting where to store your
  shares.

You will see a message once installation is complete.

> If you ever want to uninstall, run `deno uninstall earthstar`.

## `earthstar identities`

Create new Earthstar identities or save existing ones, as well as set a current
identity which is used by default for commands which write data to shares.

- `list` - List all saved identities.
- `switch` - Switch the identity used by default for setting data.
- `generate <shortname>` - Generate a new identity with a shortname.
- `add <address> <secret>` - Manually add an existing identity with a address
  and secret.
- `remove` - Forget an identity.
- `info` - Display an identity's public address and/or secret.

Extra flags can be found for each of these commands by using the `--help` flag.

## `earthstar shares`

Manage, create, modify, and sync your Earthstar shares. Take it one step
further, and view and modify their contents through your filesystem!

Your shares are saved locally as Sqlite databases in a directory of your choice,
making them fully functional even when you're offline.

- `generate <name>` - Generate a new share address using a shortname you
  provide.
- `add <shareAddress>` - Add an existing share using its public address.
- `list` - List all known shares.
- `remove` - Forget a known share.
- `set` - Write data to a path on a share.
- `paths` - List all document paths on a share.
- `latest` - Display the latest document at a given path.
- `contents` - Get the latest content at a given path.
- `sync` - Sync your shares with known replica servers OR a local share
  database.
- `sync-files` - Bidirectionally synchronise a share's documents with a
  directory on your filesystem.
- `set-share-dir` - Set the filesystem directory where your share data is
  stored.

Extra flags can be found for each of these commands by using the `--help` flag.

## `earthstar servers`

Manage a list of replica servers you know and trust, and which will be synced
with when you run `earthstar shares sync`.

Even if you have many shares, replica servers will only have knowledge of those
they knew of beforehand. Your shares will never be leaked to replica servers
that don't know about them already.

- `list` - List known replica servers
- `add <url>` - Add a replica server by its URL.
- `remove` - Forget a replica server.

Extra flags can be found for each of these commands by using the `--help` flag.

## Filesystem synchronisation

`earthstar shares sync-files` synchronises a share with a directory,
representing a share's documents as files on your computer. If you modify those
files, those modifications can be synchronised _back_ to the share, and synced
with other peers!

This makes it possible for you to interact with share documents with the tools
you already know and use.

- Synchronise a knowledgebase of markdown files across different machines and
  users (e.g. Obsidian)
- Create websites with your friends (and serve it from one of your replica
  servers!)
- Start a sneakernet of funny images you pass by USB key, synced from one
  computer to the next.

There are some caveats:

- **Earthstar's current maximum size for documents is 4 megabytes**. If you try
  to sync a document larger than this, sync will throw a warning. This limit
  will be addressed in the near future.
- Binary files will be encoded to base64, increasing their size by ~30%. This
  will also be addressed in the near future.
- Writing to certain 'owned' paths may not be permitted, throwing an error when
  you try to sync. If you don't care about losing the local data, you can use
  the `--overwriteFilesAtOwnedPaths` flag.
