# Earthstar command-line tool

Lets you inspect, modify and sync sqlite files holding [Earthstar](https://github.com/cinnamon-bun/earthstar) workspaces.  Each sqlite file holds exactly one workspace.

## Examples
Make a new file that will hold the `demo` workspace.  You generally have to do this step before any of the other commands, such as syncing.
```
earthstar create-database demo.sqlite demo
```

Create an author keypair
```
earthstar generate-author suzy > author-keypair.json
```

Set a path
```
earthstar set demo.sqlite author-keypair.json path1 value1
```

See what's in a workspace
```
earthstar pairs demo.sqlite
----
key1
    value1
```

Sync two sqlite files with each other.  Both must already exist and have the same workspace.
```
earthstar create demo2.sqlite demo  # make another one to sync with
earthstar sync demo.sqlite demo2.sqlite
```

Sync with an earthstar-pub.
```
earthstar sync demo.sqlite https://example.com
```

## Usage

Arguments:
* `<dbFilename>`: filename to an sqlite file
* `<workspace>`: a workspace address like `//gardening.ac9eEIhf9332He0afwf`
* `<authorFile>`: a JSON file in the format printed by `generate-author`
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
