#!/usr/bin/env node

import { readFileSync } from 'fs';
import commander = require('commander');
import fetch from 'node-fetch';

import {
    IValidator,
    StorageSqlite,
    ValidatorEs2,
    generateAuthorKeypair,
} from 'earthstar';

//================================================================================
// HELPERS

/*
let syncLocalAndHttp = async (db : string, url : string) => {
    let es = new StorageSqlite({
        mode: 'open',
        workspace: null,
        validators: [ValidatorEs2],
        filename: db,
    });
    console.log('existing database workspace:', es.workspace);

    if (!url.endsWith('/')) { url = url + '/'; }
    if (!url.endsWith('/earthstar/')) {
        console.error('ERROR: url is expected to end with "/earthstar/"')
        return;
    }
    let urlWithWorkspace = url + es.workspace;

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
        let docs = await resp.json();
        let pullStats = {
            numIngested: 0,
            numIgnored: 0,
            numTotal: docs.length,
        };
        for (let doc of docs) {
            if (es.ingestDocument(doc)) { pullStats.numIngested += 1; }
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
            body:    JSON.stringify(es.items({ includeHistory: true })),
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('ERROR: could not connect to server');
        console.error(e.toString());
        return;
    }
    if (resp2.status === 404) {
        console.log('    server 404: server is not accepting new workspaces');
    } else if (resp2.status === 403) {
        console.log('    server 403: server is in readonly mode');
    } else {
        let pushStats = await resp2.json();
        console.log(JSON.stringify(pushStats, null, 2));
    }
};
*/

//================================================================================

let VALIDATORS = [ValidatorEs2];

let app = new commander.Command();

app
    .name('earthstar')
app
    .command('generate-author <shortname>')
    .description('Generate and print a new author keypair with the given 4-letter shortname')
    .action((shortname) => {
        // TODO: this check should happen in earthstar core, in generateAuthorKeypair
        if (shortname.length !== 4) {
            console.warn('ERROR: shortname must be exactly 4 lowercase letters.');
            process.exit(1);
        }
        console.log(JSON.stringify(generateAuthorKeypair(shortname), null, 2));
    });
app
    .command('create-workspace <dbFilename> <workspace>')
    .description('Create a new sqlite database file to hold a given workspace')
    .action((dbFilename, workspace) => {
        // TODO: verify workspace is parsable
        let storage = new StorageSqlite({
            mode: 'create',
            workspace: workspace,
            validators: VALIDATORS,
            filename: dbFilename,
        });
    });
app
    .command('info <dbFilename>')
    .description('Report basic info about the workspace')
    .action((dbFilename : string) => {
        let storage = new StorageSqlite({
            mode: 'open',
            workspace: null,
            validators: VALIDATORS,
            filename: dbFilename,
        });
        console.log(JSON.stringify({
            workspace: storage.workspace,
            num_authors: storage.authors().length,
            num_paths: storage.paths().length,
            num_documents_including_history: storage.documents({ includeHistory: true }).length
        }, null, 2));
    });
app
    .command('pairs <dbFilename>')
    .description('Show paths and values')
    .action((dbFilename : string) => {
        let storage = new StorageSqlite({
            mode: 'open',
            workspace: null,
            validators: VALIDATORS,
            filename: dbFilename,
        });
        for (let doc of storage.documents()) {
            console.log(doc.path);
            console.log('    ' + doc.value);
        }
    });
app
    .command('paths <dbFilename>')
    .description('List the paths')
    .action((dbFilename : string) => {
        let storage = new StorageSqlite({
            mode: 'open',
            workspace: null,
            validators: VALIDATORS,
            filename: dbFilename,
        });
        for (let path of storage.paths()) {
            console.log(path);
        }
    });
app
    .command('documents <dbFilename>')
    .description('List the documents in a workspace including history documents')
    .action((dbFilename : string) => {
        let storage = new StorageSqlite({
            mode: 'open',
            workspace: null,
            validators: VALIDATORS,
            filename: dbFilename,
        });
        for (let item of storage.documents({ includeHistory: true })) {
            console.log(JSON.stringify(item, null, 2));
        }
    });
app
    .command('values <dbFilename>')
    .description('List the values in a workspace (sorted by their path)')
    .action((dbFilename : string) => {
        let storage = new StorageSqlite({
            mode: 'open',
            workspace: null,
            validators: VALIDATORS,
            filename: dbFilename,
        });
        for (let value of storage.values()) {
            console.log(value);
        }
    });
app
    .command('authors <dbFilename>')
    .description('List the authors in a workspace')
    .action((dbFilename : string) => {
        let storage = new StorageSqlite({
            mode: 'open',
            workspace: null,
            validators: VALIDATORS,
            filename: dbFilename,
        });
        for (let author of storage.authors()) {
            console.log(author);
        }
    });
app
    .command('set <dbFilename> <authorFile> <key> <value>')
    .description('Set a value at a path.  authorFile should be a JSON file.')
    .action((dbFilename, authorFile, path, value) => {
        let storage = new StorageSqlite({
            mode: 'open',
            workspace: null,
            validators: VALIDATORS,
            filename: dbFilename,
        });
        let keypair = JSON.parse(readFileSync(authorFile, 'utf8'));
        let success = storage.set(
            keypair,
            {
                format: 'es.2',
                path: path,
                value,
            });
        if (!success) {
            console.error('ERROR: set failed');
        }
    });

/*
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
            // two local files
            let es1 = new StorageSqlite({
                mode: 'open',
                workspace: null,
                validators: VALIDATORS,
                filename: dbOrUrl1,
            });
            let es2 = new StorageSqlite({
                mode: 'open',
                workspace: null,
                validators: VALIDATORS,
                filename: dbOrUrl2,
            });
            if (es1.workspace !== es2.workspace) {
                console.error(`Can't sync because workspaces don't match: ${es1.workspace} and ${es2.workspace}`);
                process.exit(1);
            }
            let syncResults = es1.sync(es2);
            console.log(JSON.stringify(syncResults, null, 2));
        } else if (isUrl(dbOrUrl1) && isUrl(dbOrUrl2)) {
            // two urls
            let url1 = dbOrUrl1;
            let url2 = dbOrUrl2;
            console.error('NOT IMPLEMENTED YET: sync between two urls');
        }
    });
*/
app.parse(process.argv);



