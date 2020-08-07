# Earthstar command-line tool

Lets you inspect, modify and sync [Earthstar](https://github.com/cinnamon-bun/earthstar) workspaces as sqlite files on your local disk.  Each sqlite file holds exactly one workspace.

You can learn more about workspaces and other Earthstar concepts in the [docs](https://github.com/cinnamon-bun/earthstar/blob/master/docs/vocabulary.md).

## Install

```sh
npm install --global earthstar-cli
```

Note that this installs a command called just `earthstar`, not `earthstar-cli`.

## Examples

Let's make a new **workspace** called `+demo.123456`.  Workspaces have this format:

```
WORKSPACE_ADDRESS: "+" WORKSPACE_NAME "." RANDOM_CHARS

WORKSPACE_NAME: 1 to 15 lower-case letters
RANDOM_CHARS: 1 to 53 upper- or lower-case letters or numbers
```

Make a new database file that will hold the `+demo.123456` workspace.  All the other commands expect a database to already exist -- you have to create one first.

```sh
earthstar create-database demo.sqlite +demo.123456
```

Create an **author** identity starting with `suzy`.  The name must be 4 lowercase letters.  We'll save it in a JSON file.  (This will make a different identity every ime you run it, but they will all start with `suzy`).

```
earthstar generate-author suzy > author-keypair.json

cat author-keypair.json
---
  {
    "address": "@suzy.bjzee56v2hd6mv5r5ar3xqg3x3oyugf7fejpxnvgquxcubov4rntq",
    "secret": "b6jd7p43h7kk77zjhbrgoknsrzpwewqya35yh4t3hvbmqbatkbh2a"
  }
```

Save a **value** at a **path**, thus creating a **document**.  We'll use the author identity we just created.

```
earthstar set demo.sqlite author-keypair.json /test/path "Test value"
```

Print out the documents in a workspace

```
earthstar pairs demo.sqlite
----
/test/path
    Test value

earthstar documents demo.sqlite
----
  {
    "format": "es.3",
    "workspace": "+demo.123456",
    "path": "/test/path",
    "value": "Test value",
    "author": "@suzy.bjzee56.... redacted for length",
    "timestamp": 1592936759163000,
    "signature": (... redacted for length ...)
  }
```

Sync two sqlite files with each other.  Both must already exist and have the same workspace.  (You can't sync documents across different workspaces).

```sh
# make another database to sync with
earthstar create-workspace demo2.sqlite +demo.123456

# sync
earthstar sync demo.sqlite demo2.sqlite

# print the contents of the second one to verify it worked
earthstar pairs demo2.sqlite
```

Sync with an [earthstar-pub](https://github.com/cinnamon-bun/earthstar-pub) server on the internet.  (This example server might take a moment to start up if it hasn't been used for a while)

```
earthstar sync demo.sqlite https://earthstar-demo-pub-v5-a.glitch.me/
```

Now visit https://earthstar-demo-pub-v5-a.glitch.me/workspace/+demo.123456 to see your data on the server.  (Pub servers exist to help with syncing, not to publish things to the internet, but for this demo you can view the content through the web.)

## Usage

Arguments:
* `<dbFilename>`: filename to an sqlite file
* `<workspaceAddress>`: a workspace address like `+gardening.ac9eEIhf9332He0afwf`
* `<authorFile>`: a JSON file in the format printed by `generate-author` containing an author's private key
* `<path>`: an Earthstar path, starting with a slash
* `<value>`: any string
* `<url>`: HTTP address of an earthstar pub.

```
Usage: earthstar [options] [command]

Options:
  -h, --help                                        display help for command

Commands:
  generate-author <shortname>                       Generate and print a new author keypair
                                                    with the given 4-letter shortname
  create-workspace <dbFilename> <workspaceAddress>  Create a new sqlite database file to hold
                                                    a given workspace
  info <dbFilename>                                 Report basic info about the workspace
  pairs <dbFilename>                                Show paths and values
  paths <dbFilename>                                List the paths
  documents <dbFilename>                            List the documents in a workspace
                                                    including history documents
  values <dbFilename>                               List the values in a workspace (sorted by
                                                    their path)
  authors <dbFilename>                              List the authors in a workspace
  set <dbFilename> <authorFile> <key> <value>       Set a value at a path.  authorFile should
                                                    be a JSON file holding a keypair.
  sync <dbOrUrl1> <dbOrUrl2>                        Sync between two local files and/or
                                                    remote servers.
  help [command]                                    display help for command
```
