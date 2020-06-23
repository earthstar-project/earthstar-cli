# Earthstar command-line tool

Lets you inspect, modify and sync sqlite files holding [Earthstar](https://github.com/cinnamon-bun/earthstar) workspaces.  Each sqlite file holds exactly one workspace.

## Examples

Let's make a new workspace called `//demo.123456`.  Workspaces have this format:

```
"//" WORKSPACE_NAME "." RANDOM_CHARS

WORKSPACE_NAME: 1 to 15 lower-case letters
RANDOM_CHARS: 1 to 44 letters or numbers
```

Make a new database file that will hold the `//demo.123456` workspace.  You generally have to do this step before any of the other commands, such as syncing.
```
earthstar create-database demo.sqlite //demo.123456
```

Create an author identity for "suzy".  The name has to be 4 lowercase letters.
```
earthstar generate-author suzy > author-keypair.json
cat author-keypair.json
----
  {
    "address": "@suzy.BvWCCQJfGVNQ1q1VFATBvAwfX4N8bQXWXxvFsViLa85P",
    "secret": "3P1BisPyTs2EGMSHpXKHLbeoZewrYePfETbf19gi8E6z"
  }
```

Save a document (a string) at a path
```
earthstar set demo.sqlite author-keypair.json /test/path "Test value"
```

See the documents in a workspace
```
earthstar pairs demo.sqlite
----
/test/path
    Test value
```

```
earthstar documents demo.sqlite
----
  {
    "format": "es.2",
    "workspace": "//demo.123456",
    "path": "/test/path",
    "value": "Test value",
    "author": "@suzy.BvWCCQJfGVNQ1q1VFATBvAwfX4N8bQXWXxvFsViLa85P",
    "timestamp": 1592936759163000,
    "signature": (... redacted for length ...)
  }
----
```

Sync two sqlite files with each other.  Both must already exist and have the same workspace.
```
earthstar create-workspace demo2.sqlite //demo.123456  # make another one to sync with
earthstar sync demo.sqlite demo2.sqlite
```

Sync with an [earthstar-pub](https://github.com/cinnamon-bun/earthstar-pub) server
```
earthstar sync demo.sqlite https://cinnamon-bun-earthstar-pub3.glitch.me
```

## Usage

Arguments:
* `<dbFilename>`: filename to an sqlite file
* `<workspace>`: a workspace address like `//gardening.ac9eEIhf9332He0afwf`
* `<authorFile>`: a JSON file in the format printed by `generate-author` containing an author's private key
* `<path>`: an Earthstar path, starting with a slash
* `<value>`: any string
* `<url>`: HTTP address of an earthstar pub.

```
Usage: earthstar [options] [command]

Options:
  -h, --help                                   display help for command

Commands:
  generate-author <shortname>                  Generate and print a new author keypair with
                                               the given 4-letter shortname
  create-workspace <dbFilename> <workspace>    Create a new sqlite database file to hold a
                                               given workspace
  info <dbFilename>                            Report basic info about the workspace
  pairs <dbFilename>                           Show paths and values
  paths <dbFilename>                           List the paths
  documents <dbFilename>                       List the documents in a workspace including
                                               history documents
  values <dbFilename>                          List the values in a workspace (sorted by
                                               their path)
  authors <dbFilename>                         List the authors in a workspace
  set <dbFilename> <authorFile> <key> <value>  Set a value at a path.  authorFile should be
                                               a JSON file.
  help [command]                               display help for command
```
