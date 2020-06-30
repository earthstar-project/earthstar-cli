#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import commander = require('commander');

import {
    StorageSqlite,
    ValidatorEs3,
    generateAuthorKeypair,
    syncLocalAndHttp,
    IStorage,
    parseWorkspaceAddress,
} from 'earthstar';

//================================================================================
// HELPERS

let VALIDATORS = [ValidatorEs3];
let FORMAT = 'es.3';

let obtainStorage = (db : string) : StorageSqlite =>
    new StorageSqlite({
        mode: 'open',
        workspace: null,
        validators: VALIDATORS,
        filename: db,
    });

//================================================================================

let app = new commander.Command();

app
    .name('earthstar')
app
    .command('generate-author <shortname>')
    .description('Generate and print a new author keypair with the given 4-letter shortname')
    .action((shortname) => {
        // TODO: remove this once earthstar 2.0.1 is published - it checks for you
        if (shortname.length !== 4) {
            console.warn('ERROR: shortname must be exactly 4 lowercase letters.');
            process.exit(1);
        }
        console.log(JSON.stringify(generateAuthorKeypair(shortname), null, 2));
    });
app
    .command('create-workspace <dbFilename> <workspaceAddress>')
    .description('Create a new sqlite database file to hold a given workspace')
    .action((dbFilename, workspaceAddress) => {
        if (existsSync(dbFilename)) {
            console.warn('ERROR: file already exists: ' + dbFilename);
            process.exit(1);
        }
        let { workspaceParsed, err } = parseWorkspaceAddress(workspaceAddress);
        if (err || workspaceParsed === null) {
            console.warn('ERROR: invalid workspace address');
            console.warn(err);
            process.exit(1);
        }
        let storage = new StorageSqlite({
            mode: 'create',
            workspace: workspaceAddress,
            validators: VALIDATORS,
            filename: dbFilename,
        });
        console.log(`Created new file ${dbFilename} holding workspace ${workspaceAddress}`);
    });
app
    .command('info <dbFilename>')
    .description('Report basic info about the workspace')
    .action((dbFilename : string) => {
        let storage = obtainStorage(dbFilename);
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
        let storage = obtainStorage(dbFilename);
        for (let doc of storage.documents()) {
            console.log(doc.path);
            console.log('    ' + doc.value);
        }
    });
app
    .command('paths <dbFilename>')
    .description('List the paths')
    .action((dbFilename : string) => {
        let storage = obtainStorage(dbFilename);
        for (let path of storage.paths()) {
            console.log(path);
        }
    });
app
    .command('documents <dbFilename>')
    .description('List the documents in a workspace including history documents')
    .action((dbFilename : string) => {
        let storage = obtainStorage(dbFilename);
        for (let item of storage.documents({ includeHistory: true })) {
            console.log(JSON.stringify(item, null, 2));
        }
    });
app
    .command('values <dbFilename>')
    .description('List the values in a workspace (sorted by their path)')
    .action((dbFilename : string) => {
        let storage = obtainStorage(dbFilename);
        for (let value of storage.values()) {
            console.log(value);
        }
    });
app
    .command('authors <dbFilename>')
    .description('List the authors in a workspace')
    .action((dbFilename : string) => {
        let storage = obtainStorage(dbFilename);
        for (let author of storage.authors()) {
            console.log(author);
        }
    });
app
    .command('set <dbFilename> <authorFile> <key> <value>')
    .description('Set a value at a path.  authorFile should be a JSON file holding a keypair.')
    .action((dbFilename, authorFile, path, value) => {
        let storage = obtainStorage(dbFilename);
        let keypair = JSON.parse(readFileSync(authorFile, 'utf8'));
        let success = storage.set(
            keypair,
            {
                format: FORMAT,
                path: path,
                value,
            });
        if (!success) {
            console.error('ERROR: set failed');
        }
    });

app
    .command('sync <dbOrUrl1> <dbOrUrl2>')
    .description('Sync between two local files and/or remote servers.')
    .action(async (dbOrUrl1 : string, dbOrUrl2 : string) => {
        let isUrl = (s : string) => s.startsWith('http://') || s.startsWith('https://');
        if (isUrl(dbOrUrl1) && !isUrl(dbOrUrl2)) {
            // url and local
            let url = dbOrUrl1;
            let dbFilename = dbOrUrl2;
            let storage = obtainStorage(dbFilename);
            await syncLocalAndHttp(storage, url);
        } else if (!isUrl(dbOrUrl1) && isUrl(dbOrUrl2)) {
            // local and url
            let dbFilename = dbOrUrl1;
            let url = dbOrUrl2;
            let storage = obtainStorage(dbFilename);
            await syncLocalAndHttp(storage, url);
        } else if (!isUrl(dbOrUrl1) && !isUrl(dbOrUrl2)) {
            // two local files
            let storage1 = obtainStorage(dbOrUrl1);
            let storage2 = obtainStorage(dbOrUrl2);
            if (storage1.workspace !== storage2.workspace) {
                console.error(`Can't sync because workspaces don't match: ${storage1.workspace} and ${storage2.workspace}`);
                process.exit(1);
            }
            let syncResults = storage1.sync(storage2);
            console.log(JSON.stringify(syncResults, null, 2));
        } else if (isUrl(dbOrUrl1) && isUrl(dbOrUrl2)) {
            // two urls
            let url1 = dbOrUrl1;
            let url2 = dbOrUrl2;
            console.error('NOT IMPLEMENTED YET: sync between two URLs.  Instead you can sync Url 1 to a local file, then sync the file to Url 2.');
            process.exit(1);
        }
    });

app.parse(process.argv);



