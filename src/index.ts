#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import commander = require('commander');

import {
    StorageSqlite,
    ValidatorEs4,
    generateAuthorKeypair,
    syncLocalAndHttp,
    WriteResult,
    isErr,
    syncLocal,
} from 'earthstar';

//================================================================================
// HELPERS

let VALIDATORS = [ValidatorEs4];
let FORMAT = 'es.4';

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
        let keypairOrErr = generateAuthorKeypair(shortname);
        if (isErr(keypairOrErr)) {
            console.error(keypairOrErr.name, keypairOrErr.message);
            process.exit(1);
        }
        console.log(JSON.stringify(keypairOrErr, null, 2));
    });
app
    .command('create-workspace <dbFilename> <workspaceAddress>')
    .description('Create a new sqlite database file to hold a given workspace')
    .action((dbFilename, workspaceAddress) => {
        if (existsSync(dbFilename)) {
            console.error('ERROR: file already exists: ' + dbFilename);
            process.exit(1);
        }
        let err = ValidatorEs4._checkWorkspaceIsValid(workspaceAddress);
        if (isErr(err)) {
            console.error('ERROR: invalid workspace address');
            console.error(err.message);
            process.exit(1);
        }
        let storage = new StorageSqlite({
            mode: 'create',
            workspace: workspaceAddress,
            validators: VALIDATORS,
            filename: dbFilename,
        });
        storage.close();
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
            num_documents_including_history: storage.documents({ history: 'all' }).length
        }, null, 2));
        storage.close();
    });
app
    .command('pairs <dbFilename>')
    .description('Show paths and values')
    .action((dbFilename : string) => {
        let storage = obtainStorage(dbFilename);
        for (let doc of storage.documents()) {
            console.log(doc.path);
            console.log('    ' + doc.content);
        }
        storage.close();
    });
app
    .command('paths <dbFilename>')
    .description('List the paths')
    .action((dbFilename : string) => {
        let storage = obtainStorage(dbFilename);
        for (let path of storage.paths()) {
            console.log(path);
        }
        storage.close();
    });
app
    .command('documents <dbFilename>')
    .description('List the documents in a workspace including history documents')
    .action((dbFilename : string) => {
        let storage = obtainStorage(dbFilename);
        for (let item of storage.documents({ history: 'all' })) {
            console.log(JSON.stringify(item, null, 2));
        }
        storage.close();
    });
app
    .command('contents <dbFilename>')
    .description('List the contents for all documents in a workspace (sorted by their path)')
    .action((dbFilename : string) => {
        let storage = obtainStorage(dbFilename);
        for (let content of storage.contents()) {
            console.log(content);
        }
        storage.close();
    });
app
    .command('authors <dbFilename>')
    .description('List the authors in a workspace')
    .action((dbFilename : string) => {
        let storage = obtainStorage(dbFilename);
        for (let author of storage.authors()) {
            console.log(author);
        }
        storage.close();
    });
app
    .command('set <dbFilename> <authorFile> <key> <content>')
    .description('Set a value at a path.  authorFile should be a JSON file holding a keypair.')
    .action((dbFilename, authorFile, path, content) => {
        let storage = obtainStorage(dbFilename);
        let keypair = JSON.parse(readFileSync(authorFile, 'utf8'));
        let result = storage.set(
            keypair,
            {
                format: FORMAT,
                path: path,
                content: content,
            });
        if (result === WriteResult.Ignored) {
            console.warn('set was ignored');
        } else if (isErr(result)) {
            console.error('ERROR: set failed');
            console.error(result.message);
        } else {
            console.log('document was set.');
        }
        storage.close();
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
            let syncResults = await syncLocalAndHttp(storage, url);
            console.log(JSON.stringify(syncResults, null, 2));
            storage.close();
        } else if (!isUrl(dbOrUrl1) && isUrl(dbOrUrl2)) {
            // local and url
            let dbFilename = dbOrUrl1;
            let url = dbOrUrl2;
            let storage = obtainStorage(dbFilename);
            let syncResults = await syncLocalAndHttp(storage, url);
            console.log(JSON.stringify(syncResults, null, 2));
            storage.close();
        } else if (!isUrl(dbOrUrl1) && !isUrl(dbOrUrl2)) {
            // two local files
            let storage1 = obtainStorage(dbOrUrl1);
            let storage2 = obtainStorage(dbOrUrl2);
            if (storage1.workspace !== storage2.workspace) {
                console.error(`Can't sync because workspaces don't match: ${storage1.workspace} and ${storage2.workspace}`);
                process.exit(1);
            }
            let syncResults = syncLocal(storage1, storage2);
            console.log(JSON.stringify(syncResults, null, 2));
            storage1.close();
            storage2.close();
        } else if (isUrl(dbOrUrl1) && isUrl(dbOrUrl2)) {
            // two urls
            let url1 = dbOrUrl1;
            let url2 = dbOrUrl2;
            console.error('NOT IMPLEMENTED YET: sync between two URLs.  Instead you can sync Url 1 to a local file, then sync the file to Url 2.');
            process.exit(1);
        }
    });

app.parse(process.argv);
