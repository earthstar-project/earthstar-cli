# Earthstar command-line tool

Lets you inspect, modify and sync sqlite files holding [Earthstar](https://github.com/cinnamon-bun/earthstar) workspaces.  Each sqlite file holds exactly one workspace.

## Examples
Make a new file that will hold the `demo` workspace.  You generally have to do this step before any of the other commands, such as syncing.
```
earthstar create demo.sqlite demo
```

Create an author keypair
```
earthstar generate-author > author-keypair.json
```

Set a key
```
earthstar set demo.sqlite author-keypair.json key1 value1
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
earthstar sync demo.sqlite https://example.com/earthstar/
```

## Usage

Arguments:
* `<db>`: filename to an sqlite file
* `<workspace>`: any string
* `<authorFile>`: a JSON file in the format printed by `generate-author`
* `<key>`: any string
* `<value>`: any string
* `<url>`: HTTP address of an earthstar pub.  Must end in `/earthstar/`.

```
Usage: earthstar [options] [command]

Options:
  --unsigned                           Allow/create messages of type "unsigned.1" which do not
                                       have signatures.  This is insecure.  Only use it for
                                       testing.
  -h, --help                           display help for command

Commands:
  generate-author                      Generate and print a new author keypair
  create <db> <workspace>              Create a new database
  info <db>                            Report basic info about the database
  pairs <db>                           Show keys and values
  keys <db>                            List the keys
  items <db>                           List the items in a database including history items
  values <db>                          List the values in a database (sorted by their key)
  authors <db>                         List the authors in a database
  set <db> <authorFile> <key> <value>  Set a key to a value.  authorFile should be a JSON file.
  sync <dbOrUrl1> <dbOrUrl2>           Sync between two local files and/or remote servers.
                                       Urls should end in "/earthstar/"
  help [command]                       display help for command
```
