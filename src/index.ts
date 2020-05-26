import {readFileSync} from 'fs';
import commander = require('commander');
import {
    StoreMemory,
    ValidatorKw1,
    IStore,
    addSigilToKey,
    Keypair,
    Item,
    StoreSqlite,
    generateKeypair,
} from 'keywing';

//================================================================================
// KEYWING SETUP

let workspace = 'test';
let kw = new StoreMemory([ValidatorKw1], workspace);
//let keypair : Keypair = keywing.generateKeypair();
let keypair : Keypair = {
    public: 'Ki6aDqWS5O5pQlmrQWv2kT97abIWCC0wqbMrwoqoZq0=',
    secret: 'VSdYKDZzl2A4Cm7AW5GGgGWv3MtNKszf7bOcvgW/LRo='
}
let author = addSigilToKey(keypair.public);

kw.set({
    format: 'kw.1',
    key: 'wiki/kittens',
    value: 'Kittens are small mammals.',
    author: author,
    authorSecret: keypair.secret,
});
kw.set({
    format: 'kw.1',
    key: `~${author}/about/name`,
    value: 'Example Sam',
    author: author,
    authorSecret: keypair.secret,
});
kw.set({
    format: 'kw.1',
    key: `~${author}/about/details`,
    value: 'I am an example author',
    author: author,
    authorSecret: keypair.secret,
});

//================================================================================

let app = new commander.Command();

app.version('0.0.1');
app
    .command('generate-author')
    .description('')
    .action(() => {
        console.log(JSON.stringify(generateKeypair(), null, 2));
    });
app
    .command('stats <db>')
    .description('Report basic info about the database.')
    .action((db : string) => {
        let kw = new StoreSqlite([ValidatorKw1], workspace, db);
        console.log(JSON.stringify({
            workspace: kw.workspace,
            num_authors: kw.authors().length,
            num_keys: kw.keys().length,
            num_items_including_history: kw.items({ includeHistory: true }).length
        }, null, 2));
    });
app
    .command('pairs <db>')
    .description('Show the keys and values.')
    .action((db : string) => {
        let kw = new StoreSqlite([ValidatorKw1], workspace, db);
        for (let item of kw.items()) {
            console.log(item.key);
            console.log('    ' + item.value);
        }
    });
app
    .command('keys <db>')
    .description('List the keys in a database')
    .action((db : string) => {
        let kw = new StoreSqlite([ValidatorKw1], workspace, db);
        for (let key of kw.keys()) {
            console.log(key);
        }
    });
app
    .command('items <db>')
    .description('List the items in a database')
    .action((db : string) => {
        let kw = new StoreSqlite([ValidatorKw1], workspace, db);
        for (let item of kw.items({ includeHistory: true })) {
            console.log(JSON.stringify(item, null, 2));
        }
    });
app
    .command('values <db>')
    .description('List the values in a database (sorted by their key)')
    .action((db : string) => {
        let kw = new StoreSqlite([ValidatorKw1], workspace, db);
        for (let value of kw.values()) {
            console.log(value);
        }
    });
app
    .command('authors <db>')
    .description('List the authors in a database')
    .action((db : string) => {
        let kw = new StoreSqlite([ValidatorKw1], workspace, db);
        for (let author of kw.authors()) {
            console.log(author);
        }
    });
app
    .command('set <db> <authorFile> <key> <value>')
    .description('Set a key to a value.  authorFile should be a JSON file.')
    .action((db, authorFile, key, value) => {
        let kw = new StoreSqlite([ValidatorKw1], workspace, db);
        let keypair = JSON.parse(readFileSync(authorFile, 'utf8'));
        let success = kw.set({
            format: 'kw.1',
            key,
            value,
            author: addSigilToKey(keypair.public),
            authorSecret: keypair.secret,
        });
        if (!success) {
            console.log('ERROR: set failed');
        }
    });

app.parse(process.argv);



