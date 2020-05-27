# Earthstar command-line tool

Lets you modify and sync sqlite files holding [Earthstar](https://github.com/cinnamon-bun/earthstar) databases.

```
Usage: index [options] [command]

Options:
  -V, --version                        output the version number
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
