#!/bin/sh

rm foo.sqlite foo2.sqlite foo.json

node build/index.js create-workspace foo.sqlite //demo.123456
node build/index.js create-workspace foo2.sqlite //demo.123456
node build/index.js generate-author fooo > foo.json
node build/index.js set foo.sqlite foo.json /test/path "Test value"
echo
echo "contents of foo.sqlite"
node build/index.js documents foo.sqlite
echo
echo "syncing"
node build/index.js sync foo.sqlite foo2.sqlite
echo
echo "contents of foo2.sqlite"
node build/index.js documents foo2.sqlite
echo
