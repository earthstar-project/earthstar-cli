#!/bin/sh

rm foo.sqlite foo2.sqlite fooo.json bar.sqlite

node build/index.js create-workspace foo.sqlite +foo.b123456
node build/index.js create-workspace foo2.sqlite +foo.b123456
node build/index.js create-workspace bar.sqlite +bar.b123456
node build/index.js generate-author fooo > fooo.json
node build/index.js set foo.sqlite fooo.json /test/path "Test value"
echo
echo "=== contents of foo.sqlite"
node build/index.js documents foo.sqlite
echo
echo "=== syncing"
node build/index.js sync foo.sqlite foo2.sqlite
echo
echo "=== contents of foo2.sqlite"
node build/index.js documents foo2.sqlite
echo
echo "=== sync with mismatched workspace"
node build/index.js sync foo.sqlite bar.sqlite
echo
