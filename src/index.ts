#!/usr/bin/env node

import {readFileSync} from 'fs';
import commander = require('commander');
import fetch from 'node-fetch';
import {
    StoreMemory,
    ValidatorKw1,
    IStore,
    addSigilToKey,
    Keypair,
    Item,
    StoreSqlite,
    generateKeypair,
} from 'earthstar';

//================================================================================
// HELPERS

let syncLocalAndHttp = async (db : string, url : string) => {
    let kw = new StoreSqlite({
        mode: 'open',
        workspace: null,
        validators: [ValidatorKw1],
        filename: db,
    });
    console.log('existing database workspace:', kw.workspace);

    if (!url.endsWith('/')) { url = url + '/'; }
    if (!url.endsWith('/earthstar/')) {
        console.error('ERROR: url is expected to end with "/earthstar/"')
        return;
    }
    let urlWithWorkspace = url + kw.workspace;

    // pull from server
    // this can 404 the first time, because the server only creates workspaces
    // when we push them
    console.log('pulling from ' + urlWithWorkspace);
    let resp : any;
    try {
        resp = await fetch(urlWithWorkspace + '/items');
    } catch (e) {
        console.error('ERROR: could not connect to server');
        console.error(e.toString());
        return;
    }
    if (resp.status === 404) {
        console.log('    server 404: server does not know about this workspace yet');
    } else {
        let items = await resp.json();
        let pullStats = {
            numIngested: 0,
            numIgnored: 0,
            numTotal: items.length,
        };
        for (let item of items) {
            if (kw.ingestItem(item)) { pullStats.numIngested += 1; }
            else { pullStats.numIgnored += 1; }
        }
        console.log(JSON.stringify(pullStats, null, 2));
    }

    // push to server
    console.log('pushing to ' + urlWithWorkspace);
    let resp2 : any;
    try {
        resp2 = await fetch(urlWithWorkspace + '/items', {
            method: 'post',
            body:    JSON.stringify(kw.items({ includeHistory: true })),
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('ERROR: could not connect to server');
        console.error(e.toString());
        return;
    }
    let pushStats = await resp2.json();
    console.log(JSON.stringify(pushStats, null, 2));
};

//================================================================================

let app = new commander.Command();

app.version('0.0.1');
app
    .command('generate-author')
    .description('Generate and print a new author keypair')
    .action(() => {
        console.log(JSON.stringify(generateKeypair(), null, 2));
    });
app
    .command('create <db> <workspace>')
    .description('Create a new database')
    .action((db, workspace) => {
        let kw = new StoreSqlite({
            mode: 'create',
            workspace: workspace,
            validators: [ValidatorKw1],
            filename: db,
        });
    });
app
    .command('info <db>')
    .description('Report basic info about the database')
    .action((db : string) => {
        let kw = new StoreSqlite({
            mode: 'open',
            workspace: null,
            validators: [ValidatorKw1],
            filename: db,
        });
        console.log(JSON.stringify({
            workspace: kw.workspace,
            num_authors: kw.authors().length,
            num_keys: kw.keys().length,
            num_items_including_history: kw.items({ includeHistory: true }).length
        }, null, 2));
    });
app
    .command('pairs <db>')
    .description('Show keys and values')
    .action((db : string) => {
        let kw = new StoreSqlite({
            mode: 'open',
            workspace: null,
            validators: [ValidatorKw1],
            filename: db,
        });
        for (let item of kw.items()) {
            console.log(item.key);
            console.log('    ' + item.value);
        }
    });
app
    .command('keys <db>')
    .description('List the keys')
    .action((db : string) => {
        let kw = new StoreSqlite({
            mode: 'open',
            workspace: null,
            validators: [ValidatorKw1],
            filename: db,
        });
        for (let key of kw.keys()) {
            console.log(key);
        }
    });
app
    .command('items <db>')
    .description('List the items in a database including history items')
    .action((db : string) => {
        let kw = new StoreSqlite({
            mode: 'open',
            workspace: null,
            validators: [ValidatorKw1],
            filename: db,
        });
        for (let item of kw.items({ includeHistory: true })) {
            console.log(JSON.stringify(item, null, 2));
        }
    });
app
    .command('values <db>')
    .description('List the values in a database (sorted by their key)')
    .action((db : string) => {
        let kw = new StoreSqlite({
            mode: 'open',
            workspace: null,
            validators: [ValidatorKw1],
            filename: db,
        });
        for (let value of kw.values()) {
            console.log(value);
        }
    });
app
    .command('authors <db>')
    .description('List the authors in a database')
    .action((db : string) => {
        let kw = new StoreSqlite({
            mode: 'open',
            workspace: null,
            validators: [ValidatorKw1],
            filename: db,
        });
        for (let author of kw.authors()) {
            console.log(author);
        }
    });
app
    .command('set <db> <authorFile> <key> <value>')
    .description('Set a key to a value.  authorFile should be a JSON file.')
    .action((db, authorFile, key, value) => {
        let kw = new StoreSqlite({
            mode: 'open',
            workspace: null,
            validators: [ValidatorKw1],
            filename: db,
        });
        let keypair = JSON.parse(readFileSync(authorFile, 'utf8'));
        let success = kw.set({
            format: 'kw.1',
            key,
            value,
            author: addSigilToKey(keypair.public),
            authorSecret: keypair.secret,
        });
        if (!success) {
            console.error('ERROR: set failed');
        }
    });
app
    .command('sync <dbOrUrl1> <dbOrUrl2>')
    .description('Sync between two local files and/or remote servers.  Urls should end in "/earthstar/"')
    .action(async (dbOrUrl1 : string, dbOrUrl2 : string) => {
        let isUrl = (s : string) => s.startsWith('http://') || s.startsWith('https://');
        if (isUrl(dbOrUrl1) && !isUrl(dbOrUrl2)) {
            let url = dbOrUrl1;
            let db = dbOrUrl2;
            await syncLocalAndHttp(db, url);
        } else if (!isUrl(dbOrUrl1) && isUrl(dbOrUrl2)) {
            let db = dbOrUrl1;
            let url = dbOrUrl2;
            await syncLocalAndHttp(db, url);
        } else if (!isUrl(dbOrUrl1) && !isUrl(dbOrUrl2)) {
            let db1 = dbOrUrl1;
            let db2 = dbOrUrl2;
            console.error('NOT IMPLEMENTED YET: sync between two local files');
        } else if (isUrl(dbOrUrl1) && isUrl(dbOrUrl2)) {
            let url1 = dbOrUrl1;
            let url2 = dbOrUrl2;
            console.error('NOT IMPLEMENTED YET: sync between two urls');
        }
    });

app.parse(process.argv);



